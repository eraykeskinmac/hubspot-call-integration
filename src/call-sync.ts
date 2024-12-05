import { RecordingApiClient } from "./recording-api";
import { HubspotApiClient } from "./hubspot-api";

export async function syncCallToHubspot(params: {
  callUuid: string;
  callerNumber: string;
  destinationNumber: string;
  startTime: string;
  duration: string;
  status: string;
  recordingPresent: boolean;
  santralApiKey: string;
  hubspotApiKey: string;
}) {
  const {
    callUuid,
    callerNumber,
    destinationNumber,
    startTime,
    duration,
    status,
    recordingPresent,
    santralApiKey,
    hubspotApiKey,
  } = params;

  const recordingClient = new RecordingApiClient(santralApiKey);
  const hubspotClient = new HubspotApiClient(hubspotApiKey);

  try {
    // 1. Contact'ı bul
    const contact = await hubspotClient.findContactByPhone(destinationNumber);

    if (!contact) {
      console.log(`Contact bulunamadı: ${destinationNumber}`);
      return;
    }

    // 2. Ses kaydı URL'ini al
    let recordingUrl = "";
    if (recordingPresent) {
      const recordingResult = await recordingClient.getRecordingUrl(callUuid);
      if (recordingResult.success && recordingResult.url) {
        recordingUrl = recordingResult.url;
      }
    }

    // 3. Süreyi saniyeye çevir
    const [hours, minutes, seconds] = duration.split(":").map(Number);
    const durationInSeconds = hours * 3600 + minutes * 60 + seconds;

    // 4. Hubspot'a kaydet
    await hubspotClient.createCallEngagement({
      contactId: contact.id,
      fromNumber: callerNumber,
      toNumber: destinationNumber,
      callDuration: durationInSeconds,
      recordingUrl,
      callStatus: status,
      callTimestamp: new Date(startTime).getTime(),
      notes: `
        Çağrı Detayları:
        - UUID: ${callUuid}
        - Süre: ${duration}
        - Sonuç: ${status}
        - Ses Kaydı: ${recordingPresent ? "Var" : "Yok"}
      `,
    });

    console.log(`Çağrı başarıyla Hubspot'a kaydedildi. Contact: ${contact.id}`);
  } catch (error) {
    console.error("Senkronizasyon hatası:", error);
    throw error;
  }
}
