// src/utils/phone-utils.ts

import { parsePhoneNumber, CountryCode } from "libphonenumber-js";

export class PhoneUtils {
  static formatInternationalNumber(phoneNumber: string): string | null {
    try {
      // Numarayı temizle
      let cleanNumber = phoneNumber.replace(/[\s\(\)\-]/g, "");

      // URL encoded içeriği decode et
      cleanNumber = decodeURIComponent(cleanNumber);

      // + ile başlıyorsa direkt parse et
      if (cleanNumber.startsWith("+")) {
        const parsedNumber = parsePhoneNumber(cleanNumber);
        if (parsedNumber?.isValid()) {
          return parsedNumber.format("E.164");
        }
      }

      // 0 ile başlıyorsa ve 11 haneliyse (Türkiye numarası)
      if (cleanNumber.startsWith("0") && cleanNumber.length === 11) {
        const withTurkeyCode = "+90" + cleanNumber.substring(1);
        try {
          const parsedNumber = parsePhoneNumber(withTurkeyCode);
          if (parsedNumber?.isValid()) {
            return parsedNumber.format("E.164");
          }
        } catch (e) {
          // Parse hatasını yoksay
        }
      }

      // 90 ile başlıyorsa ve 12 haneliyse (Türkiye numarası)
      if (cleanNumber.startsWith("90") && cleanNumber.length === 12) {
        const withPlusSign = "+" + cleanNumber;
        try {
          const parsedNumber = parsePhoneNumber(withPlusSign);
          if (parsedNumber?.isValid()) {
            return parsedNumber.format("E.164");
          }
        } catch (e) {
          // Parse hatasını yoksay
        }
      }

      // Diğer format denemeleri
      const numberVariants = [
        cleanNumber,
        cleanNumber.startsWith("0") ? cleanNumber.substring(1) : cleanNumber,
        cleanNumber.startsWith("90") ? cleanNumber.substring(2) : cleanNumber,
        cleanNumber.startsWith("+90") ? cleanNumber.substring(3) : cleanNumber,
      ];

      for (const variant of numberVariants) {
        try {
          const parsedNumber = parsePhoneNumber(variant, "TR");
          if (parsedNumber?.isValid()) {
            return parsedNumber.format("E.164");
          }
        } catch (e) {
          continue;
        }
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
