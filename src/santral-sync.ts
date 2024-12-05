import CallApiClient from "./call-api";
import { HubspotApiClient } from "./hubspot-api";
import { config } from "./config";

interface CallRecord {
  call_uuid: string;
  caller_id_number: string;
  destination_number: string;
  start_stamp: string;
  duration: string;
  result: string;
  recording_present: string;
  queue?: string;
  queue_wait_seconds?: string;
}

interface ApiResponse {
  success: boolean;
  data?: {
    cdrs: CallRecord[];
    pagination: {
      page: number;
      total_count: number;
      total_pages: number;
      limit: number;
    };
  };
  error?: string;
}

interface SyncStats {
  total: number;
  processed: number;
  success: number;
  failed: number;
  skipped: number;
  contactMatched: number;
  companyMatched: number;
  errors: Array<{
    callUuid: string;
    number: string;
    error: string;
    timestamp: string;
  }>;
}

export class SantralHubspotSync {
  private callApi: CallApiClient;
  private hubspotApi: HubspotApiClient;
  private stats: SyncStats = {
    total: 0,
    processed: 0,
    success: 0,
    failed: 0,
    skipped: 0,
    contactMatched: 0,
    companyMatched: 0,
    errors: [],
  };

  constructor() {
    this.callApi = new CallApiClient(config.santralApiKey);
    this.hubspotApi = new HubspotApiClient(config.hubspotAccessToken);
  }

  private resetStats() {
    this.stats = {
      total: 0,
      processed: 0,
      success: 0,
      failed: 0,
      skipped: 0,
      contactMatched: 0,
      companyMatched: 0,
      errors: [],
    };
  }

  getStats(): SyncStats {
    return this.stats;
  }

  async syncCalls(startDate?: Date, endDate?: Date) {
    try {
      this.resetStats();

      // Default son 24 saat
      const defaultStartDate = new Date();
      defaultStartDate.setHours(defaultStartDate.getHours() - 24);

      // Santral API'den çağrıları al
      const callsResponse = await this.callApi.getCallRecords({
        start_stamp_from: startDate || defaultStartDate,
        start_stamp_to: endDate || new Date(),
        limit: 100,
      });

      if (!callsResponse.success || !callsResponse.data) {
        throw new Error("Santral API hatası: " + callsResponse.error);
      }

      this.stats.total = callsResponse.data.cdrs.length;
      console.log(`${this.stats.total} çağrı bulundu.`);

      // Her çağrı için işlem yap
      for (const call of callsResponse.data.cdrs) {
        try {
          this.stats.processed++;
          const destinationNumber = call.destination_number.split(" ")[0];
          console.log(
            `\nİşleniyor: ${destinationNumber} [${this.stats.processed}/${this.stats.total}]`
          );

          // Çağrıyı işle ve sonucu al
          const result = await this.processCall(call);

          if (result.success) {
            this.stats.success++;
            if (result.contactMatched) this.stats.contactMatched++;
            if (result.companyMatched) this.stats.companyMatched++;
          }
        } catch (error) {
          this.handleCallProcessError(call, error);
        }
      }

      // Özet raporu yazdır
      this.printSyncSummary();

      return { stats: this.stats };
    } catch (error) {
      console.error("Senkronizasyon hatası:", error);
      throw error;
    }
  }

  private async processCall(call: CallRecord): Promise<{
    success: boolean;
    contactMatched?: boolean;
    companyMatched?: boolean;
  }> {
    const destinationNumber = call.destination_number.split(" ")[0];

    // Önce contact'ı bul
    const contact = await this.hubspotApi.findContactByPhone(destinationNumber);

    if (!contact) {
      console.log(`❌ ${destinationNumber} için contact bulunamadı`);
      this.stats.skipped++;
      return { success: true };
    }

    // Var olan çağrıyı kontrol et
    const existingCall = await this.hubspotApi.findCallByUUID(call.call_uuid);
    if (existingCall) {
      console.log(`ℹ️ Bu çağrı zaten kaydedilmiş`);
      this.stats.skipped++;
      return { success: true };
    }

    // Çağrı notunu hazırla
    const callNote = this.generateCallNote(call);

    // Çağrıyı Hubspot'a kaydet
    const result = await this.hubspotApi.createCallEngagement({
      contactId: contact.id,
      fromNumber: call.caller_id_number.split(" ")[0],
      toNumber: destinationNumber,
      callDuration: this.calculateDuration(call.duration),
      recordingUrl: this.getRecordingUrl(call),
      callStatus: call.result,
      callTimestamp: this.getTimestamp(call.start_stamp),
      callUuid: call.call_uuid,
      notes: callNote,
    });

    if (result.success) {
      console.log(`✓ Çağrı kaydı oluşturuldu (ID: ${result.callId})`);
      if (result.contactId) {
        console.log(`✓ Contact ile ilişkilendirildi: ${result.contactName}`);
      }
      if (result.companyId) {
        console.log(`✓ Company ile ilişkilendirildi: ${result.companyName}`);
      }
    }

    return {
      success: result.success,
      contactMatched: !!result.contactId,
      companyMatched: !!result.companyId,
    };
  }

  private generateCallNote(call: CallRecord): string {
    return `Santral Çağrı Kaydı

DETAYLAR
--------
• UUID: ${call.call_uuid}
• Başlangıç: ${call.start_stamp}
• Süre: ${call.duration}
• Durum: ${call.result}
• Kuyruk: ${call.queue || "Yok"}
• Bekleme Süresi: ${call.queue_wait_seconds || "0"} saniye
${
  call.recording_present === "true" ? "• Ses Kaydı Mevcut" : "• Ses Kaydı Yok"
}`;
  }

  private calculateDuration(duration: string): number {
    const [hours, minutes, seconds] = duration.split(":").map(Number);
    return hours * 3600 + minutes * 60 + seconds;
  }

  private getRecordingUrl(call: CallRecord): string {
    return call.recording_present === "true"
      ? `https://api.bulutsantralim.com/recording/${call.call_uuid}`
      : "";
  }

  private getTimestamp(dateString: string): number {
    return new Date(dateString).getTime();
  }

  private handleCallProcessError(call: CallRecord, error: any) {
    console.error(`❌ ${call.destination_number} işlenirken hata:`, error);

    this.stats.failed++;
    this.stats.errors.push({
      callUuid: call.call_uuid,
      number: call.destination_number,
      error: error.message || JSON.stringify(error),
      timestamp: new Date().toISOString(),
    });
  }

  private printSyncSummary() {
    console.log("\n" + "=".repeat(50));
    console.log("📊 Senkronizasyon Özeti");
    console.log("=".repeat(50));
    console.log(`Toplam Çağrı: ${this.stats.total}`);
    console.log(`İşlenen: ${this.stats.processed}`);
    console.log(`Başarılı: ${this.stats.success}`);
    console.log(`Contact Eşleşen: ${this.stats.contactMatched}`);
    console.log(`Company Eşleşen: ${this.stats.companyMatched}`);
    console.log(`Başarısız: ${this.stats.failed}`);
    console.log(`Atlanan: ${this.stats.skipped}`);

    if (this.stats.errors.length > 0) {
      console.log("\n❌ Hatalar:");
      this.stats.errors.forEach((error, index) => {
        console.log(`\n${index + 1}. Hata`);
        console.log(`Numara: ${error.number}`);
        console.log(`UUID: ${error.callUuid}`);
        console.log(`Hata: ${error.error}`);
        console.log(`Zaman: ${error.timestamp}`);
      });
    }

    // Başarı oranı
    const successRate = ((this.stats.success / this.stats.total) * 100).toFixed(
      2
    );
    const matchRate = (
      (this.stats.contactMatched / this.stats.total) *
      100
    ).toFixed(2);
    console.log(`\nBaşarı Oranı: ${successRate}%`);
    console.log(`Eşleşme Oranı: ${matchRate}%`);
  }
}

export default SantralHubspotSync;
