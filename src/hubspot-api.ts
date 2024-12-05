import axios from "axios";
import { config } from "./config";

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

  // Hata loglama metodu
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

  // Hata loglarını alma metodu
  getErrorLogs(): ErrorLog[] {
    return this.errorLogs;
  }

  // Hata loglarını temizleme
  clearErrorLogs() {
    this.errorLogs = [];
  }

  async findContactByPhone(
    phoneNumber: string
  ): Promise<HubspotContact | null> {
    try {
      const phoneFormats = [
        phoneNumber,
        phoneNumber.replace(/\s/g, ""),
        phoneNumber.replace(/[^\d]/g, ""),
        phoneNumber.replace(/^\+/, ""),
        phoneNumber.replace(/^0/, ""),
        phoneNumber.replace(/^\+90/, ""),
        phoneNumber.replace(/^90/, ""),
      ].filter(Boolean);

      console.log("Denenen telefon formatları:", phoneFormats);

      for (const format of phoneFormats) {
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
            properties: ["phone", "mobilephone", "firstname", "lastname"],
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
                  operator: "CONTAINS_TOKEN", // CONTAINS yerine CONTAINS_TOKEN kullanıyoruz
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

  async createCallEngagement(params: {
    contactId?: string; // Artık opsiyonel
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
      // Önce çağrının daha önce kaydedilip kaydedilmediğini kontrol et
      const existingCall = await this.findCallByUUID(params.callUuid);
      if (existingCall) {
        console.log(`Bu çağrı zaten kaydedilmiş (UUID: ${params.callUuid})`);
        return { success: false, reason: "duplicate" };
      }

      // Eğer contactId verilmediyse, toNumber'a göre contact'ı bulmaya çalış
      let contactId = params.contactId;
      if (!contactId) {
        const contact = await this.findContactByPhone(params.toNumber);
        if (contact) {
          contactId = contact.id;
          console.log(
            `✓ Contact bulundu: ${contact.properties.firstname} ${contact.properties.lastname}`
          );
        }
      }

      // Contact varsa detaylarını al
      let contact = null;
      let companyInfo = null;
      if (contactId) {
        contact = await this.getContactWithAssociations(contactId);
        if (contact) {
          companyInfo = await this.getAssociatedCompanyInfo(contact);
        }
      }

      const contactName = contact
        ? `${contact.properties.firstname || ""} ${
            contact.properties.lastname || ""
          }`.trim()
        : params.toNumber;

      // Çağrı kaydını oluştur
      const callData = {
        properties: {
          hs_call_direction: "INBOUND",
          hs_call_duration: params.callDuration,
          hs_call_from_number: params.fromNumber,
          hs_call_recording_url: params.recordingUrl,
          hs_call_status: "COMPLETED",
          hs_call_title: `Call with ${contactName} - Santral`,
          hs_call_to_number: params.toNumber,
          hs_timestamp: params.callTimestamp,
          hs_call_body:
            params.notes ||
            this.generateCallNote({
              ...params,
              contactName,
              companyName: companyInfo?.companyName,
            }),
        },
      };

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

      // Contact varsa ilişkilendirmeleri yap
      if (contactId) {
        await this.createAssociations(
          callId,
          contactId,
          companyInfo?.companyId
        );
      }

      return {
        success: true,
        callId,
        contactId,
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

  private async getAssociatedCompanyInfo(contact: any) {
    if (!contact.associations?.companies?.results?.length) {
      return null;
    }

    try {
      const companyId = contact.associations.companies.results[0].id;
      const response = await axios.get(
        `${this.baseUrl}/crm/v3/objects/companies/${companyId}`,
        {
          headers: {
            Authorization: `Bearer ${this.accessToken}`,
          },
        }
      );

      return {
        companyId,
        companyName: response.data.properties.name,
      };
    } catch (error) {
      this.logError("getAssociatedCompanyInfo", error, {
        contactId: contact.id,
      });
      return null;
    }
  }

  private async prepareCallData(params: any) {
    const contactName = `${params.contact.properties.firstname || ""} ${
      params.contact.properties.lastname || ""
    }`.trim();

    return {
      properties: {
        hs_call_direction: "INBOUND",
        hs_call_duration: params.callDuration,
        hs_call_from_number: params.fromNumber,
        hs_call_recording_url: params.recordingUrl,
        hs_call_status: "COMPLETED",
        hs_call_title: `Call with ${contactName} - Santral`,
        hs_call_to_number: params.toNumber,
        hs_timestamp: params.callTimestamp,
        hs_call_body:
          params.notes ||
          this.generateCallNote({
            ...params,
            contactName,
            companyName: params.companyInfo?.companyName,
          }),
      },
    };
  }

  private generateCallNote(params: any): string {
    return `Santral Çağrı Detayları\n
Arayan: ${params.fromNumber}
Aranan: ${params.contactName}${
      params.companyName ? ` (${params.companyName})` : ""
    }
UUID: ${params.callUuid}
Süre: ${Math.floor(params.callDuration / 60)} dakika ${
      params.callDuration % 60
    } saniye
${params.recordingUrl ? `\nSes Kaydı: ${params.recordingUrl}` : ""}`;
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
                  operator: "CONTAINS_TOKEN", // Burayı da güncelliyoruz
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

  private async createAssociations(
    callId: string,
    contactId: string,
    companyId?: string
  ) {
    try {
      // Contact ilişkilendirmesi
      await this.associateCall(callId, contactId);

      // Company ilişkilendirmesi (eğer varsa)
      if (companyId) {
        await this.associateCallWithCompany(callId, companyId);
      }
    } catch (error) {
      this.logError("createAssociations", error, {
        callId,
        contactId,
        companyId,
      });
      // İlişkilendirme hatası kritik değil, devam et
      console.error("İlişkilendirme işlemi başarısız:", error);
    }
  }

  private async associateCall(callId: string, contactId: string) {
    try {
      const data = {
        to: [
          {
            id: contactId,
            associationTypes: [
              {
                associationCategory: "USER_DEFINED",
                associationTypeId: 1,
              },
            ],
          },
        ],
      };

      await axios.put(
        `${this.baseUrl}/crm/v4/objects/calls/${callId}/associations/contacts`,
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
      console.warn("İlişkilendirme hatası:", error);
      throw error;
    }
  }

  private async associateCallWithCompany(callId: string, companyId: string) {
    try {
      const data = {
        to: [
          {
            id: companyId,
            associationTypes: [
              {
                associationCategory: "USER_DEFINED",
                associationTypeId: 1,
              },
            ],
          },
        ],
      };

      await axios.put(
        `${this.baseUrl}/crm/v4/objects/calls/${callId}/associations/companies`,
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
