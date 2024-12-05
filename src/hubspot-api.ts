// src/hubspot-api.ts

import axios from "axios";
import { config } from "./config";
import { PhoneUtils } from "./utils/phone-utils";

interface HubspotContact {
  id: string;
  properties: {
    phone?: string;
    mobilephone?: string;
    firstname?: string;
    lastname?: string;
    company?: string;
  };
  associations?: {
    companies?: {
      results: Array<{
        id: string;
      }>;
    };
  };
}

interface ErrorLog {
  timestamp: string;
  error: string;
  context: {
    method: string;
    params?: any;
    response?: any;
  };
}

export class HubspotApiClient {
  private readonly baseUrl: string;
  private readonly accessToken: string;
  private errorLogs: ErrorLog[] = [];

  constructor(accessToken: string) {
    this.baseUrl = config.hubspotApiBaseUrl;
    this.accessToken = accessToken;
  }

  private logError(method: string, error: any, params?: any) {
    const errorLog: ErrorLog = {
      timestamp: new Date().toISOString(),
      error: error.message || JSON.stringify(error),
      context: {
        method,
        params,
        response: error.response?.data,
      },
    };

    this.errorLogs.push(errorLog);
    console.error(`[${errorLog.timestamp}] ${method} Error:`, errorLog);
  }

  getErrorLogs(): ErrorLog[] {
    return this.errorLogs;
  }

  clearErrorLogs() {
    this.errorLogs = [];
  }

  async findContactByPhone(
    phoneNumber: string
  ): Promise<HubspotContact | null> {
    try {
      const formattedNumber = PhoneUtils.formatInternationalNumber(phoneNumber);
      if (!formattedNumber) {
        console.log(`❌ Geçersiz telefon numarası formatı: ${phoneNumber}`);
        return null;
      }

      const numberVariants = [
        formattedNumber, // +905321234567
        formattedNumber.replace(/^\+/, ""), // 905321234567
        formattedNumber.slice(3), // 5321234567
        "0" + formattedNumber.slice(3), // 05321234567
      ].filter(Boolean);

      console.log("Denenen telefon formatları:", numberVariants);

      for (const format of numberVariants) {
        console.log(`${format} formatı deneniyor...`);

        await new Promise((resolve) => setTimeout(resolve, 300));

        const response = await axios.post(
          `${this.baseUrl}/crm/v3/objects/contacts/search`,
          {
            filterGroups: [
              {
                filters: [
                  {
                    propertyName: "phone",
                    operator: "CONTAINS_TOKEN",
                    value: format,
                  },
                ],
              },
              {
                filters: [
                  {
                    propertyName: "mobilephone",
                    operator: "CONTAINS_TOKEN",
                    value: format,
                  },
                ],
              },
            ],
            properties: [
              "phone",
              "mobilephone",
              "firstname",
              "lastname",
              "company",
            ],
            limit: 1,
          },
          {
            headers: {
              Authorization: `Bearer ${this.accessToken}`,
              "Content-Type": "application/json",
            },
          }
        );

        if (response.data.total > 0) {
          const contact = response.data.results[0];
          console.log("✓ Contact bulundu:", {
            id: contact.id,
            phone: contact.properties.phone,
            mobilephone: contact.properties.mobilephone,
            firstname: contact.properties.firstname,
            lastname: contact.properties.lastname,
          });
          return contact;
        }
      }

      return null;
    } catch (error) {
      this.logError("findContactByPhone", error, { phoneNumber });
      if (axios.isAxiosError(error)) {
        console.error("API Hatası:", error.response?.data);
      }
      throw error;
    }
  }

  async findCallByUUID(callUuid: string): Promise<boolean> {
    try {
      const response = await axios.post(
        `${this.baseUrl}/crm/v3/objects/calls/search`,
        {
          filterGroups: [
            {
              filters: [
                {
                  propertyName: "hs_call_body",
                  operator: "CONTAINS_TOKEN",
                  value: callUuid,
                },
              ],
            },
          ],
        },
        {
          headers: {
            Authorization: `Bearer ${this.accessToken}`,
            "Content-Type": "application/json",
          },
        }
      );

      return response.data.total > 0;
    } catch (error) {
      this.logError("findCallByUUID", error, { callUuid });
      console.error("Çağrı arama hatası:", error);
      return false;
    }
  }

  private mapCallStatus(santralStatus: string): string {
    const statusMap: { [key: string]: string } = {
      Vazgeçildi: "CANCELED",
      Başarılı: "COMPLETED",
      Meşgul: "BUSY",
      Cevapsız: "NO_ANSWER",
      Reddedildi: "FAILED",
      Başarısız: "FAILED",
      Kuyrukta: "QUEUED",
      Çalıyor: "RINGING",
      Beklemede: "HOLD",
    };

    return statusMap[santralStatus] || "COMPLETED";
  }

  async createCallEngagement(params: {
    contactId?: string;
    fromNumber: string;
    toNumber: string;
    callDuration: number;
    recordingUrl: string;
    callStatus: string;
    callTimestamp: number;
    callUuid: string;
    notes?: string;
  }) {
    try {
      // Çağrı kontrolü
      const existingCall = await this.findCallByUUID(params.callUuid);
      if (existingCall) {
        console.log(`Bu çağrı zaten kaydedilmiş (UUID: ${params.callUuid})`);
        return { success: false, reason: "duplicate" };
      }

      // Contact bilgilerini al
      let contact = null;
      let companyInfo = null;

      if (params.contactId) {
        contact = await this.getContactWithAssociations(params.contactId);
      } else {
        contact = await this.findContactByPhone(params.toNumber);
        if (contact) {
          params.contactId = contact.id;
        }
      }

      // Company bilgisini al
      if (contact?.associations?.companies?.results?.length > 0) {
        const companyId = contact.associations.companies.results[0].id;
        const companyResponse = await axios.get(
          `${this.baseUrl}/crm/v3/objects/companies/${companyId}`,
          {
            headers: {
              Authorization: `Bearer ${this.accessToken}`,
            },
          }
        );
        companyInfo = {
          companyId,
          companyName: companyResponse.data.properties.name,
        };
      }

      const contactName = contact
        ? `${contact.properties.firstname || ""} ${
            contact.properties.lastname || ""
          }`.trim()
        : params.toNumber;

      const formattedFromNumber =
        PhoneUtils.formatInternationalNumber(params.fromNumber) ||
        params.fromNumber;
      const formattedToNumber =
        PhoneUtils.formatInternationalNumber(params.toNumber) ||
        params.toNumber;

      // Call kaydını oluştur
      const callData = {
        properties: {
          hs_call_direction: "INBOUND",
          hs_call_duration: params.callDuration,
          hs_call_from_number: formattedFromNumber,
          hs_call_recording_url: params.recordingUrl,
          hs_call_status: this.mapCallStatus(params.callStatus),
          hs_call_title: `Call with ${contactName} - Santral`,
          hs_call_to_number: formattedToNumber,
          hs_timestamp: params.callTimestamp,
          hs_call_body:
            params.notes ||
            this.generateCallNote({
              ...params,
              contactName,
              companyName: companyInfo?.companyName,
              fromNumber: formattedFromNumber,
              toNumber: formattedToNumber,
            }),
        },
      };

      // Çağrı kaydını oluştur
      const callResponse = await axios.post(
        `${this.baseUrl}/crm/v3/objects/calls`,
        callData,
        {
          headers: {
            Authorization: `Bearer ${this.accessToken}`,
            "Content-Type": "application/json",
          },
        }
      );

      const callId = callResponse.data.id;
      console.log("✓ Çağrı kaydı oluşturuldu:", callId);

      // İlişkilendirmeleri yap
      if (contact) {
        await this.associateCall(callId, contact.id);
        console.log(`✓ Contact ile ilişkilendirildi: ${contactName}`);
      }

      if (companyInfo) {
        await this.associateCallWithCompany(callId, companyInfo.companyId);
        console.log(
          `✓ Company ile ilişkilendirildi: ${companyInfo.companyName}`
        );
      }

      return {
        success: true,
        callId,
        contactId: contact?.id,
        contactName,
        companyId: companyInfo?.companyId,
        companyName: companyInfo?.companyName,
      };
    } catch (error) {
      this.logError("createCallEngagement", error, {
        contactId: params.contactId,
        callUuid: params.callUuid,
      });
      throw error;
    }
  }

  private async getContactWithAssociations(contactId: string) {
    try {
      const response = await axios.get(
        `${this.baseUrl}/crm/v3/objects/contacts/${contactId}?associations=company`,
        {
          headers: {
            Authorization: `Bearer ${this.accessToken}`,
            "Content-Type": "application/json",
          },
        }
      );
      return response.data;
    } catch (error) {
      this.logError("getContactWithAssociations", error, { contactId });
      return null;
    }
  }

  private generateCallNote(params: any): string {
    const fromNumber = PhoneUtils.formatPhoneNumberForDisplay(
      params.fromNumber
    );
    const toNumber = PhoneUtils.formatPhoneNumberForDisplay(params.toNumber);

    return `Santral Çağrı Detayları

DETAYLAR
--------
• UUID: ${params.callUuid}
• Arayan: ${fromNumber}
• Aranan: ${params.contactName}${
      params.companyName ? ` (${params.companyName})` : ""
    }
• Alıcı No: ${toNumber}
• Başlangıç: ${new Date(params.callTimestamp).toLocaleString()}
• Süre: ${Math.floor(params.callDuration / 60)} dakika ${
      params.callDuration % 60
    } saniye
${
  params.recordingUrl
    ? `• Ses Kaydı: ${params.recordingUrl}`
    : "• Ses Kaydı Yok"
}`;
  }

  async updateCallNotes(callUuid: string, notes: string): Promise<boolean> {
    try {
      const response = await axios.post(
        `${this.baseUrl}/crm/v3/objects/calls/search`,
        {
          filterGroups: [
            {
              filters: [
                {
                  propertyName: "hs_call_body",
                  operator: "CONTAINS_TOKEN",
                  value: callUuid,
                },
              ],
            },
          ],
        },
        {
          headers: {
            Authorization: `Bearer ${this.accessToken}`,
            "Content-Type": "application/json",
          },
        }
      );

      if (response.data.total === 0) {
        return false;
      }

      const callId = response.data.results[0].id;

      await axios.patch(
        `${this.baseUrl}/crm/v3/objects/calls/${callId}`,
        {
          properties: {
            hs_call_body: notes,
          },
        },
        {
          headers: {
            Authorization: `Bearer ${this.accessToken}`,
            "Content-Type": "application/json",
          },
        }
      );

      return true;
    } catch (error) {
      this.logError("updateCallNotes", error, { callUuid });
      console.error("Not güncelleme hatası:", error);
      return false;
    }
  }

  private async associateCall(callId: string, contactId: string) {
    try {
      const data = {
        associationSpec: {
          associationCategory: "HUBSPOT_DEFINED",
          associationTypeId: 194, // Call to Contact association type
        },
      };

      await axios.put(
        `${this.baseUrl}/crm/v3/objects/calls/${callId}/associations/contacts/${contactId}`,
        data,
        {
          headers: {
            Authorization: `Bearer ${this.accessToken}`,
            "Content-Type": "application/json",
          },
        }
      );
      console.log("✓ Call-Contact ilişkisi kuruldu");
    } catch (error) {
      this.logError("associateCall", error, { callId, contactId });
      throw error;
    }
  }

  private async associateCallWithCompany(callId: string, companyId: string) {
    try {
      const data = {
        associationSpec: {
          associationCategory: "HUBSPOT_DEFINED",
          associationTypeId: 220, // Call to Company association type
        },
      };

      await axios.put(
        `${this.baseUrl}/crm/v3/objects/calls/${callId}/associations/companies/${companyId}`,
        data,
        {
          headers: {
            Authorization: `Bearer ${this.accessToken}`,
            "Content-Type": "application/json",
          },
        }
      );
      console.log("✓ Call-Company ilişkisi kuruldu");
    } catch (error) {
      this.logError("associateCallWithCompany", error, { callId, companyId });
      console.warn("Company ilişkilendirme hatası:", error);
    }
  }
}
