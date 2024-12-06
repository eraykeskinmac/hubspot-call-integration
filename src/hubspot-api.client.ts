import axios from "axios";
import { config } from "./config";
import { HubspotAssociationsHelper } from "./hubspot-associations.helper";
import {
  CallEngagementParams,
  ErrorLog,
  HubspotContact,
} from "./types/hubspot.types";
import { PhoneUtils } from "./utils/phone-utils";

export class HubspotApiClient {
  private readonly baseUrl: string;
  private readonly accessToken: string;
  private readonly associationsHelper: HubspotAssociationsHelper;
  private errorLogs: ErrorLog[] = [];

  constructor(accessToken: string) {
    this.baseUrl = config.hubspotApiBaseUrl;
    this.accessToken = accessToken;
    this.associationsHelper = new HubspotAssociationsHelper(
      this.baseUrl,
      this.accessToken
    );
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
            associations: ["company"],
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

  async createCallEngagement(params: CallEngagementParams) {
    try {
      // Check for existing call
      const existingCall = await this.findCallByUUID(params.callUuid);
      if (existingCall) {
        console.log(`Bu çağrı zaten kaydedilmiş (UUID: ${params.callUuid})`);
        return { success: false, reason: "duplicate" };
      }

      // Get contact and company info
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

      if (contact?.associations?.companies?.results?.length > 0) {
        const companyId = contact.associations.companies.results[0].id;
        const companyResponse = await this.getCompanyById(companyId);
        if (companyResponse) {
          companyInfo = {
            companyId,
            companyName: companyResponse.properties.name,
          };
        }
      }

      // Create call record
      const callData = {
        properties: {
          hs_call_direction: "INBOUND",
          hs_call_duration: params.callDuration,
          hs_call_from_number:
            PhoneUtils.formatInternationalNumber(params.fromNumber) ||
            params.fromNumber,
          hs_call_recording_url: params.recordingUrl,
          hs_call_status: this.mapCallStatus(params.callStatus),
          hs_call_title: `Call with ${
            contact ? this.getContactDisplayName(contact) : params.toNumber
          } - Santral`,
          hs_call_to_number:
            PhoneUtils.formatInternationalNumber(params.toNumber) ||
            params.toNumber,
          hs_timestamp: params.callTimestamp,
          hs_call_body:
            params.notes ||
            this.generateCallNote({
              ...params,
              contactName: contact
                ? this.getContactDisplayName(contact)
                : params.toNumber,
              companyName: companyInfo?.companyName,
            }),
        },
      };

      // Create call record
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

      // Create associations using the helper
      if (contact || companyInfo) {
        const associationResults =
          await this.associationsHelper.createCallAssociations({
            callId,
            contactId: contact?.id,
            companyId: companyInfo?.companyId,
          });

        if (
          associationResults.contactAssociation?.status === "SUCCESS" &&
          contact
        ) {
          console.log(
            `✓ Contact ile ilişkilendirildi: ${this.getContactDisplayName(
              contact
            )}`
          );
        }

        if (
          associationResults.companyAssociation?.status === "SUCCESS" &&
          companyInfo
        ) {
          console.log(
            `✓ Company ile ilişkilendirildi: ${companyInfo.companyName}`
          );
        }
      }

      return {
        success: true,
        callId,
        contactId: contact?.id,
        contactName: contact ? this.getContactDisplayName(contact) : undefined,
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

  private getContactDisplayName(contact: HubspotContact): string {
    return `${contact.properties.firstname || ""} ${
      contact.properties.lastname || ""
    }`.trim();
  }

  private async getCompanyById(companyId: string) {
    try {
      const response = await axios.get(
        `${this.baseUrl}/crm/v3/objects/companies/${companyId}`,
        {
          headers: {
            Authorization: `Bearer ${this.accessToken}`,
          },
        }
      );
      return response.data;
    } catch (error) {
      this.logError("getCompanyById", error, { companyId });
      return null;
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

  private generateCallNote(params: {
    callUuid: string;
    fromNumber: string;
    toNumber: string;
    contactName: string;
    companyName?: string;
    callDuration: number;
    callStatus: string;
    recordingUrl?: string;
    callTimestamp: number;
  }): string {
    return `Santral Çağrı Detayları

DETAYLAR
--------
• UUID: ${params.callUuid}
• Arayan: ${params.fromNumber}
• Aranan: ${params.contactName}${
      params.companyName ? ` (${params.companyName})` : ""
    }
• Alıcı No: ${params.toNumber}
• Başlangıç: ${new Date(params.callTimestamp).toLocaleString()}
• Süre: ${Math.floor(params.callDuration / 60)} dakika ${
      params.callDuration % 60
    } saniye
• Durum: ${params.callStatus}
${
  params.recordingUrl
    ? `• Ses Kaydı: ${params.recordingUrl}`
    : "• Ses Kaydı Yok"
}`;
  }
}
