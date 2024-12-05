import { parsePhoneNumber, CountryCode } from "libphonenumber-js";

export class PhoneUtils {
  static formatInternationalNumber(phoneNumber: string): string | null {
    try {
      // Numarayı temizle
      let cleanNumber = phoneNumber.replace(/[\s\(\)\-]/g, "");

      // + ile başlıyorsa direkt parse et
      if (cleanNumber.startsWith("+")) {
        const parsedNumber = parsePhoneNumber(cleanNumber);
        if (parsedNumber?.isValid()) {
          return parsedNumber.format("E.164");
        }
      }

      // Yaygın ülke kodları listesi
      const commonCountryCodes = [
        "TR",
        "US",
        "GB",
        "DE",
        "FR",
        "IT",
        "ES",
        "NL",
        "BE",
        "CH",
        "AT",
        "SE",
        "NO",
        "DK",
        "FI",
        "RU",
        "UA",
        "PL",
        "CZ",
        "HU",
        "RO",
        "BG",
        "GR",
        "PT",
        "IE",
      ] as CountryCode[];

      // Önce yaygın ülke kodlarını dene
      for (const countryCode of commonCountryCodes) {
        try {
          // 0 ile başlıyorsa kaldır
          const numberToTry = cleanNumber.startsWith("0")
            ? cleanNumber.substring(1)
            : cleanNumber;

          const parsedNumber = parsePhoneNumber(numberToTry, countryCode);
          if (parsedNumber?.isValid()) {
            console.log(
              `Numara geçerli: ${parsedNumber.format("E.164")} (${countryCode})`
            );
            return parsedNumber.format("E.164");
          }
        } catch (e) {
          continue;
        }
      }

      // Direkt parse etmeyi dene
      try {
        // 0 ile başlıyorsa +90 ekle (Türkiye varsayılan)
        if (cleanNumber.startsWith("0")) {
          const withTurkeyCode = "+90" + cleanNumber.substring(1);
          const parsedNumber = parsePhoneNumber(withTurkeyCode);
          if (parsedNumber?.isValid()) {
            return parsedNumber.format("E.164");
          }
        }

        // Direkt numarayı parse etmeyi dene
        const parsedNumber = parsePhoneNumber(cleanNumber);
        if (parsedNumber?.isValid()) {
          return parsedNumber.format("E.164");
        }
      } catch (e) {
        // Parse hatalarını yok say
      }

      console.warn(`Geçerli telefon formatı bulunamadı: ${phoneNumber}`);
      return null;
    } catch (error) {
      console.error("Numara formatlanırken hata:", error);
      return null;
    }
  }

  static isValidPhoneNumber(phoneNumber: string): boolean {
    const formattedNumber = this.formatInternationalNumber(phoneNumber);
    return formattedNumber !== null;
  }

  static formatPhoneNumberForDisplay(phoneNumber: string): string {
    const formatted = this.formatInternationalNumber(phoneNumber);
    if (!formatted) return phoneNumber;

    try {
      const parsed = parsePhoneNumber(formatted);
      return parsed.formatInternational();
    } catch {
      return phoneNumber;
    }
  }
}
