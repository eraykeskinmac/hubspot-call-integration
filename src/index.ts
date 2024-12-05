import { syncCallToHubspot } from "./call-sync";
import { config } from "./config";
import { HubspotApiClient } from "./hubspot-api";
import { RecordingApiClient } from "./recording-api";

async function processCallRecord(callRecord: any) {
  try {
    // Çağrı verilerini hazırla
    const callData = {
      callUuid: callRecord.call_uuid,
      callerNumber: callRecord.caller_id_number.split(" ")[0], // Parantez içindeki kısmı temizle
      destinationNumber: callRecord.destination_number.split(" ")[0], // Parantez içindeki kısmı temizle
      startTime: callRecord.start_stamp,
      duration: callRecord.duration,
      status: callRecord.result,
      recordingPresent: callRecord.recording_present === "true",
      santralApiKey: config.santralApiKey,
      hubspotApiKey: config.hubspotAccessToken,
    };

    console.log("Çağrı senkronizasyonu başlıyor:", callData);

    // Senkronizasyonu gerçekleştir
    await syncCallToHubspot(callData);

    console.log("Çağrı senkronizasyonu tamamlandı");
  } catch (error) {
    console.error("Çağrı işlenirken hata:", error);
  }
}

async function main() {
  try {
    // Örnek bir çağrı kaydı
    const exampleCallRecord = {
      call_uuid: "6fe1b133-ebf3-45f4-84bd-ad88c69349bf",
      caller_id_number: "1002 (905318865036)",
      destination_number: "05382752273",
      start_stamp: "2024-11-05 11:34:51 +0300",
      duration: "00:02:02",
      result: "Cevaplandı",
      recording_present: "true",
    };

    // Tek bir çağrı kaydını işle
    await processCallRecord(exampleCallRecord);

    // Çoklu çağrı kayıtlarını işlemek için örnek
    const multipleCallRecords = [
      {
        call_uuid: "636bc6c5-e3a1-4f4e-beaf-2864e7eb0e61",
        caller_id_number: "1004 (905396323755)",
        destination_number: "08502974933",
        start_stamp: "2024-11-06 13:43:08 +0300",
        duration: "00:00:00",
        result: "Ulaşılamıyor",
        recording_present: "false",
      },
      {
        call_uuid: "589450a7-bb52-41e9-afc8-6a7699d5dd56",
        caller_id_number: "02124440444",
        destination_number: "905396323725",
        start_stamp: "2024-11-06 10:07:51 +0300",
        duration: "00:00:06",
        result: "Cevaplandı",
        recording_present: "false",
      },
    ];

    // Çoklu çağrıları işle
    console.log("\nÇoklu çağrılar işleniyor...");
    for (const callRecord of multipleCallRecords) {
      await processCallRecord(callRecord);
    }
  } catch (error) {
    console.error("Ana işlem sırasında hata:", error);
  }
}

// CLI argümanlarını kontrol et
if (process.argv.includes("--debug")) {
  // Debug modu
  const hubspotClient = new HubspotApiClient(config.hubspotAccessToken);
  const recordingClient = new RecordingApiClient(config.santralApiKey);

  // API bağlantılarını test et
  console.log("API bağlantıları test ediliyor...");

  Promise.all([
    hubspotClient
      .findContactByPhone("05382752273")
      .then((contact) =>
        console.log(
          "Hubspot bağlantısı başarılı:",
          contact ? "Contact bulundu" : "Contact bulunamadı"
        )
      )
      .catch((err) => console.error("Hubspot bağlantı hatası:", err)),

    recordingClient
      .getRecordingUrl("6fe1b133-ebf3-45f4-84bd-ad88c69349bf")
      .then((result) =>
        console.log(
          "Santral bağlantısı başarılı:",
          result.success ? "URL alındı" : "Hata"
        )
      )
      .catch((err) => console.error("Santral bağlantı hatası:", err)),
  ]).then(() => console.log("Test tamamlandı"));
} else {
  // Normal çalıştırma
  main().catch((error) => {
    console.error("Program çalışırken hata oluştu:", error);
    process.exit(1);
  });
}

// Hata yakalama
process.on("unhandledRejection", (error) => {
  console.error("İşlenmeyen Promise hatası:", error);
  process.exit(1);
});

process.on("uncaughtException", (error) => {
  console.error("İşlenmeyen hata:", error);
  process.exit(1);
});
