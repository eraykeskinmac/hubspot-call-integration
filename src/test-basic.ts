// src/test-basic.ts

import { config } from "./config";
import { HubspotApiClient } from "./hubspot-api";

async function testBasic() {
  try {
    console.log("🚀 Basit Test Başlıyor...\n");

    const hubspotClient = new HubspotApiClient(config.hubspotAccessToken);

    // 1. Contact'ı bul
    console.log("1. Contact aranıyor...");
    const contact = await hubspotClient.findContactByPhone("535 791 58 77");

    if (!contact) {
      throw new Error("Contact bulunamadı!");
    }

    console.log("\n✓ Contact bulundu:", {
      id: contact.id,
      name: `${contact.properties.firstname} ${contact.properties.lastname}`,
      phone: contact.properties.phone
    });

    // 2. Sadece kayıtları oluştur
    console.log("\n2. Kayıtlar oluşturuluyor...");

    const result = await hubspotClient.createCallEngagement({
      contactId: contact.id,
      fromNumber: "02124440444",
      toNumber: contact.properties.phone || "",
      callDuration: 150,
      recordingUrl: "",
      callStatus: "COMPLETED",
      callTimestamp: Date.now(),
      notes: "Test amaçlı oluşturulmuş çağrı kaydı"
    });

    if (result.success) {
      console.log("\n✅ Kayıtlar başarıyla oluşturuldu!");
      console.log("\nOluşturulan ID'ler:");
      console.log(`• Call ID: ${result.callId}`);
      console.log(`• Note ID: ${result.noteId}`);
      console.log(`• Contact ID: ${result.contactId}`);
    }

  } catch (error) {
    console.error("\n❌ Hata:", error);
  }
}

testBasic().finally(() => {
  console.log("\nTest tamamlandı.");
});