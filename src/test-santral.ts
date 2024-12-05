// src/test-santral.ts

import SantralHubspotSync from "./santral-sync";

async function testSync() {
  try {
    console.log("🚀 Santral-Hubspot Senkronizasyon Testi\n");
    const sync = new SantralHubspotSync();

    // Test senaryoları
    const tests = [
      {
        name: "Son 1 saat",
        startDate: new Date(Date.now() - 60 * 60 * 1000), // 1 saat önce
        endDate: new Date(),
      },
      {
        name: "Son 24 saat",
        startDate: new Date(Date.now() - 24 * 60 * 60 * 1000), // 24 saat önce
        endDate: new Date(),
      },
      {
        name: "Dün",
        startDate: new Date(Date.now() - 48 * 60 * 60 * 1000), // 48 saat önce
        endDate: new Date(Date.now() - 24 * 60 * 60 * 1000), // 24 saat önce
      },
    ];

    // Kullanıcıdan seçim al
    console.log("Test senaryoları:");
    tests.forEach((test, index) => {
      console.log(`${index + 1}. ${test.name}`);
      console.log(
        `   ${test.startDate.toLocaleString()} - ${test.endDate.toLocaleString()}`
      );
    });

    // Test seçeneğini komut satırından al
    const testIndex = process.argv[2] ? parseInt(process.argv[2]) - 1 : 0;
    const selectedTest = tests[testIndex] || tests[0];

    console.log(`\n🕒 Seçilen test: ${selectedTest.name}`);
    console.log(`Başlangıç: ${selectedTest.startDate.toLocaleString()}`);
    console.log(`Bitiş: ${selectedTest.endDate.toLocaleString()}\n`);

    // Senkronizasyonu başlat
    console.log("Senkronizasyon başlıyor...\n");
    await sync.syncCalls(selectedTest.startDate, selectedTest.endDate);
  } catch (error) {
    console.error("\n❌ Test sırasında hata:", error);
  }
}

// Testi çalıştır
console.log("=".repeat(50));
testSync().finally(() => {
  console.log("\n✨ Test tamamlandı.");
  console.log("=".repeat(50));
});
