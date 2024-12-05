// src/test-complete.ts

import { config } from "./config";
import { HubspotApiClient } from "./hubspot-api";
import axios, { AxiosError } from "axios";

async function testCompleteFlow() {
  try {
    console.log("🚀 Santral - Hubspot Entegrasyon Testi\n");

    const hubspotClient = new HubspotApiClient(config.hubspotAccessToken);
    const contactPhone = "535 791 58 77";

    // 1. Contact'ı bul
    console.log("1. Contact aranıyor...");
    const contact = await hubspotClient.findContactByPhone(contactPhone);

    if (!contact) {
      throw new Error("Contact bulunamadı!");
    }

    console.log("✓ Contact bulundu:", {
      id: contact.id,
      name: `${contact.properties.firstname} ${contact.properties.lastname}`,
      phone: contact.properties.phone,
    });

    // Timestamp'i insan tarafından okunabilir formata çevir
    const now = new Date();
    const timestamp = now.getTime();
    const formattedDate = now.toLocaleString("tr-TR");

    // 2. Test çağrısı oluştur
    console.log("\n2. Çağrı kaydı ve notları oluşturuluyor...");
    const result = await hubspotClient.createCallEngagement({
      contactId: contact.id,
      fromNumber: "02124440444",
      toNumber: contact.properties.phone || contactPhone,
      callDuration: 150, // 2.5 dakika
      recordingUrl: "",
      callStatus: "COMPLETED",
      callTimestamp: timestamp,
      notes: `📞 Test Çağrı Kaydı

ÇAĞRI DETAYLARI
--------------
• Tarih/Saat: ${formattedDate}
• Santral Numarası: 02124440444
• Aranan Numara: ${contact.properties.phone}
• Konuşma Süresi: 2.5 dakika
• Durum: Başarılı

Bu kayıt, Santral-Hubspot entegrasyonu testi için oluşturulmuştur.
Test tarihi: ${formattedDate}`,
    });

    console.log("\n✅ Test başarıyla tamamlandı!");
    console.log("\nOluşturulan Kayıtlar:");
    console.log("---------------------");
    console.log(`• Çağrı ID: ${result.callId}`);
    console.log(`• Not ID: ${result.noteId}`);

    console.log("\n📋 Hubspot'ta Kontrol Listesi:");
    console.log("---------------------------");
    console.log("1. Contacts > All Contacts'a gidin");
    console.log(
      `2. "${contact.properties.firstname} ${contact.properties.lastname}" contact'ını açın`
    );
    console.log("3. Timeline sekmesine bakın");
    console.log("4. Activities sekmesinde şunları kontrol edin:");
    console.log("   - Calls bölümünde yeni çağrı kaydı");
    console.log("   - Notes bölümünde çağrıya ait detaylı not");
    console.log("\n5. CRM > Calls menüsünde çağrı kaydını kontrol edin");

    // Oluşturulan kayıtları doğrula
    console.log("\n🔍 Kayıtları Doğrulama:");
    console.log("---------------------");

    if (result.callId) {
      console.log("✓ Çağrı kaydı başarıyla oluşturuldu");
    }

    if (result.noteId) {
      console.log("✓ Çağrı notu başarıyla oluşturuldu");
    }

    if (result.success) {
      console.log("✓ Tüm ilişkilendirmeler tamamlandı");
    }
  } catch (error) {
    console.error("\n❌ Hata Oluştu!");
    console.error("---------------");

    if (error instanceof AxiosError && error.response) {
      console.error("API Hata Detayı:", {
        durum: error.response.status,
        mesaj: error.response.data.message || error.response.data,
        url: error.config?.url,
        metod: error.config?.method,
      });
    } else if (error instanceof Error) {
      console.error("Hata Mesajı:", error.message);
    } else {
      console.error("Beklenmeyen Hata:", error);
    }
  }
}

// Process hata yakalayıcıları
process.on("unhandledRejection", (error) => {
  console.error("\n💥 İşlenmeyen Promise Hatası:", error);
});

process.on("uncaughtException", (error) => {
  console.error("\n💥 Yakalanmayan Hata:", error);
  process.exit(1);
});

// Testi çalıştır
console.log("=".repeat(50));
console.log("🔧 Hubspot Santral Entegrasyon Testi Başlıyor");
console.log("=".repeat(50), "\n");

testCompleteFlow().finally(() => {
  console.log("\n" + "=".repeat(50));
  console.log("✨ Test Tamamlandı");
  console.log("=".repeat(50));
});
