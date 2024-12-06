import colors from "colors/safe";
import SantralHubspotSync from "./santral-hubspot-sync";

async function testSync() {
  try {
    console.log("\n" + "=".repeat(50));
    console.log(
      colors.blue("🚀 Santral-Hubspot Senkronizasyon Testi Başlatılıyor\n")
    );
    console.log("=".repeat(50) + "\n");

    const sync = new SantralHubspotSync();

    const testCases = [
      {
        name: "Son 1 saat",
        description: "Son 1 saatteki çağrıları senkronize et",
        startDate: new Date(Date.now() - 60 * 60 * 1000),
        endDate: new Date(),
      },
      {
        name: "Son 24 saat",
        description: "Son 24 saatteki çağrıları senkronize et",
        startDate: new Date(Date.now() - 24 * 60 * 60 * 1000),
        endDate: new Date(),
      },
      {
        name: "Özel tarih aralığı",
        description: "Belirli bir tarih aralığını senkronize et",
        startDate: new Date(Date.now() - 48 * 60 * 60 * 1000), // 48 saat önce
        endDate: new Date(Date.now() - 24 * 60 * 60 * 1000), // 24 saat önce
      },
    ];

    // Test senaryolarını listele
    console.log(colors.yellow("📋 Test Senaryoları:"));
    testCases.forEach((test, index) => {
      console.log(`\n${index + 1}. ${colors.green(test.name)}`);
      console.log(`   ${test.description}`);
      console.log(
        `   ${colors.gray("Başlangıç")}: ${test.startDate.toLocaleString()}`
      );
      console.log(
        `   ${colors.gray("Bitiş")}: ${test.endDate.toLocaleString()}`
      );
    });

    // Kullanıcıdan seçim al veya default değeri kullan
    const testIndex = process.argv[2] ? parseInt(process.argv[2]) - 1 : 0;
    const selectedTest = testCases[testIndex] || testCases[0];

    // Seçilen testi göster
    console.log("\n" + "=".repeat(50));
    console.log(colors.green(`\n🎯 Seçilen Test: ${selectedTest.name}`));
    console.log(
      colors.gray(`Başlangıç: ${selectedTest.startDate.toLocaleString()}`)
    );
    console.log(
      colors.gray(`Bitiş: ${selectedTest.endDate.toLocaleString()}\n`)
    );

    // Test başlangıç zamanı
    const startTime = Date.now();

    // Senkronizasyonu başlat
    console.log(colors.blue("🔄 Senkronizasyon başlatılıyor...\n"));
    const syncResult = await sync.syncCalls(
      selectedTest.startDate,
      selectedTest.endDate
    );

    // Test sonuçları
    const endTime = Date.now();
    const duration = (endTime - startTime) / 1000;

    console.log("\n" + "=".repeat(50));
    console.log(colors.yellow("\n📊 Test Sonuçları"));
    console.log("=".repeat(50));

    const stats = syncResult.stats;
    console.log(`\n${colors.blue("📞 Çağrı İstatistikleri:")}`);
    console.log(`• Toplam Çağrı: ${colors.cyan(stats.total.toString())}`);
    console.log(`• İşlenen: ${colors.cyan(stats.processed.toString())}`);
    console.log(`• Başarılı: ${colors.green(stats.success.toString())}`);
    console.log(
      `• Contact İlişkilendirilen: ${colors.green(
        stats.contactMatched.toString()
      )}`
    );
    console.log(
      `• Company İlişkilendirilen: ${colors.green(
        stats.companyMatched.toString()
      )}`
    );
    console.log(`• Başarısız: ${colors.red(stats.failed.toString())}`);
    console.log(`• Atlanan: ${colors.yellow(stats.skipped.toString())}`);

    if (stats.errors.length > 0) {
      console.log(`\n${colors.red("❌ Hatalar:")}`);
      stats.errors.forEach((error, index) => {
        console.log(`\n${index + 1}. Hata Detayı`);
        console.log(`• Numara: ${error.number}`);
        console.log(`• UUID: ${error.callUuid}`);
        console.log(`• Hata: ${error.error}`);
        console.log(`• Zaman: ${error.timestamp}`);
      });
    }

    // Süre bilgisi
    console.log(
      `\n⏱️  İşlem süresi: ${colors.cyan(duration.toFixed(2))} saniye`
    );

    // Başarı oranı
    const successRate = ((stats.success / stats.total) * 100).toFixed(2);
    const matchRate = ((stats.contactMatched / stats.total) * 100).toFixed(2);
    console.log(`\n📈 Başarı Oranı: ${colors.green(successRate + "%")}`);
    console.log(`📈 Eşleşme Oranı: ${colors.green(matchRate + "%")}`);
  } catch (error) {
    console.error(colors.red("\n❌ Test sırasında hata:"), error);
  }
}

// Ana fonksiyon
async function run() {
  console.log(colors.cyan("=".repeat(50)));
  await testSync().finally(() => {
    console.log(colors.green("\n✨ Test tamamlandı."));
    console.log(colors.cyan("=".repeat(50)));
  });
}

// Testi çalıştır
run();
