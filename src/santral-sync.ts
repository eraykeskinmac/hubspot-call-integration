import CallApiClient from "./call-api";
import { HubspotApiClient } from "./hubspot-api";
import { config } from "./config";

// Interface tanımlamaları
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

interface HubspotContact {
  id: string;
  properties: {
    phone?: string;
    mobilephone?: string;
    firstname?: string;
    lastname?: string;
    company?: string;
  };
}

interface SyncStats {
  total: number;
  processed: number;
  success: number;
  failed: number;
  skipped: number;
  errors: Array<{
    callUuid: string;
    number: string;
    error: string;
    timestamp: string;
  }>;
}

class SantralHubspotSync {
  private callApi: CallApiClient;
  private hubspotApi: HubspotApiClient;
  private stats: SyncStats = {
    // stats'i initialize ediyoruz
    total: 0,
    processed: 0,
    success: 0,
    failed: 0,
    skipped: 0,
    errors: [],
  };

  constructor() {
    this.callApi = new CallApiClient(config.santralApiKey);
    this.hubspotApi = new HubspotApiClient(config.hubspotAccessToken);
    this.resetStats();
  }

  private resetStats() {
    this.stats = {
      total: 0,
      processed: 0,
      success: 0,
      failed: 0,
      skipped: 0,
      errors: [],
    };
  }

  getStats(): SyncStats {
    return this.stats;
  }

  async syncCalls(startDate?: Date, endDate?: Date) {
    try {
      const defaultStartDate = new Date();
      defaultStartDate.setHours(defaultStartDate.getHours() - 24);

      const callsResponse: ApiResponse = await this.callApi.getCallRecords({
        start_stamp_from: startDate || defaultStartDate,
        start_stamp_to: endDate || new Date(),
        limit: 100,
      });

      if (!callsResponse.success || !callsResponse.data) {
        throw new Error("Santral API hatası: " + callsResponse.error);
      }

      this.stats.total = callsResponse.data.cdrs.length;
      console.log(`${this.stats.total} çağrı bulundu.`);

      for (const call of callsResponse.data.cdrs) {
        try {
          this.stats.processed++;
          const destinationNumber = call.destination_number.split(" ")[0];
          console.log(
            `\nİşleniyor: ${destinationNumber} [${this.stats.processed}/${this.stats.total}]`
          );

          const contact = await this.hubspotApi.findContactByPhone(
            destinationNumber
          );

          if (!contact) {
            console.log(`❌ ${destinationNumber} için contact bulunamadı`);
            this.stats.skipped++;
            continue;
          }

          const existingCall = await this.hubspotApi.findCallByUUID(
            call.call_uuid
          );
          if (existingCall) {
            console.log(`ℹ️ Bu çağrı zaten kaydedilmiş`);
            this.stats.skipped++;
            continue;
          }

          await this.processCall(call, contact);
          this.stats.success++;
        } catch (error) {
          this.handleCallProcessError(call, error);
        }
      }

      // Senkronizasyon özeti
      this.printSyncSummary();
    } catch (error) {
      console.error("Senkronizasyon hatası:", error);
      throw error;
    }
  }

  private async processCall(call: CallRecord, contact?: HubspotContact) {
    const [hours, minutes, seconds] = call.duration.split(":").map(Number);
    const durationInSeconds = hours * 3600 + minutes * 60 + seconds;

    const callNote = this.generateCallNote(call);

    const result = await this.hubspotApi.createCallEngagement({
      // contactId'yi varsa gönder
      ...(contact && { contactId: contact.id }),
      fromNumber: call.caller_id_number.split(" ")[0],
      toNumber: call.destination_number.split(" ")[0],
      callDuration: durationInSeconds,
      recordingUrl:
        call.recording_present === "true"
          ? `https://api.bulutsantralim.com/recording/${call.call_uuid}`
          : "",
      callStatus: call.result,
      callTimestamp: new Date(call.start_stamp).getTime(),
      callUuid: call.call_uuid,
      notes: callNote,
    });

    if (result.success) {
      console.log(`✓ Çağrı kaydı oluşturuldu (ID: ${result.callId})`);
      if (result.contactId) {
        console.log(`✓ Contact ile ilişkilendirildi (ID: ${result.contactId})`);
        if (result.companyId) {
          console.log(`✓ Company ile ilişkilendirildi (${result.companyName})`);
        }
      }
    } else {
      throw new Error(`Çağrı kaydı oluşturulamadı: ${result.reason}`);
    }
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
  }
}

export default SantralHubspotSync;
