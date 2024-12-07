import axios from "axios";
import {
  AssociationInput,
  BatchAssociationResult,
  AssociationRequest,
  DefaultAssociationRequest,
} from "./types/hubspot.types";

export class HubspotAssociationsHelper {
  private readonly baseUrl: string;
  private readonly accessToken: string;

  constructor(baseUrl: string, accessToken: string) {
    this.baseUrl = baseUrl;
    this.accessToken = accessToken;
  }

  async createBatchAssociations(
    associations: AssociationInput[]
  ): Promise<BatchAssociationResult[]> {
    try {
      const batchSize = 100;
      const results: BatchAssociationResult[] = [];

      const groupedAssociations = associations.reduce((acc, curr) => {
        const key = `${curr.fromObjectType}-${curr.toObjectType}`;
        if (!acc[key]) {
          acc[key] = [];
        }
        acc[key].push(curr);
        return acc;
      }, {} as { [key: string]: AssociationInput[] });

      for (const [key, groupAssociations] of Object.entries(
        groupedAssociations
      )) {
        const [fromObjectType, toObjectType] = key.split("-");

        for (let i = 0; i < groupAssociations.length; i += batchSize) {
          const batch = groupAssociations.slice(i, i + batchSize);

          // Method 1: Use batch/create endpoint
          const requestData = {
            inputs: batch.map(
              (association) =>
                ({
                  from: {
                    id: association.fromObjectId,
                  },
                  to: {
                    id: association.toObjectId,
                  },
                  types: [
                    {
                      associationCategory: "HUBSPOT_DEFINED",
                      associationTypeId: parseInt(association.associationType),
                    },
                  ],
                } as AssociationRequest)
            ),
          };

          try {
            const url = `${this.baseUrl}/crm/v4/associations/${fromObjectType}/${toObjectType}/batch/create`;

            console.log("Trying batch/create endpoint:", {
              url,
              data: JSON.stringify(requestData, null, 2),
            });

            const response = await axios.post(url, requestData, {
              headers: {
                Authorization: `Bearer ${this.accessToken}`,
                "Content-Type": "application/json",
              },
            });

            if (response.data.results) {
              results.push(...response.data.results);
              continue;
            }
          } catch (error: any) {
            console.log(
              "batch/create failed, trying batch/associate/default..."
            );

            try {
              const defaultAssocUrl = `${this.baseUrl}/crm/v4/associations/${fromObjectType}/${toObjectType}/batch/associate/default`;
              const defaultAssocData = {
                inputs: batch.map(
                  (association) =>
                    ({
                      from: { id: association.fromObjectId },
                      to: { id: association.toObjectId },
                    } as DefaultAssociationRequest)
                ),
              };

              console.log("Trying batch/associate/default endpoint:", {
                url: defaultAssocUrl,
                data: JSON.stringify(defaultAssocData, null, 2),
              });

              const defaultResponse = await axios.post(
                defaultAssocUrl,
                defaultAssocData,
                {
                  headers: {
                    Authorization: `Bearer ${this.accessToken}`,
                    "Content-Type": "application/json",
                  },
                }
              );

              if (defaultResponse.data.results) {
                results.push(...defaultResponse.data.results);
              }
            } catch (defaultError: any) {
              console.log(
                "Both batch methods failed, trying individual associations..."
              );

              for (const association of batch) {
                try {
                  const individualUrl = `${this.baseUrl}/crm/v4/objects/${fromObjectType}/${association.fromObjectId}/associations/default/${toObjectType}/${association.toObjectId}`;

                  console.log("Trying individual association:", individualUrl);

                  await axios.put(individualUrl, null, {
                    headers: {
                      Authorization: `Bearer ${this.accessToken}`,
                      "Content-Type": "application/json",
                    },
                  });

                  results.push({
                    status: "SUCCESS",
                    inputs: {
                      from: { id: association.fromObjectId },
                      to: { id: association.toObjectId },
                    },
                  });
                } catch (individualError: any) {
                  console.error("Individual association failed:", {
                    error:
                      individualError.response?.data || individualError.message,
                    status: individualError.response?.status,
                  });
                  throw individualError;
                }
              }
            }
          }
        }
      }

      return results;
    } catch (error) {
      console.error("Association process error:", error);
      throw error;
    }
  }

  async createCallAssociations(params: {
    callId: string;
    contactId?: string;
    companyId?: string;
  }): Promise<{
    contactAssociation?: BatchAssociationResult;
    companyAssociation?: BatchAssociationResult;
  }> {
    const associations: AssociationInput[] = [];

    if (params.contactId) {
      associations.push({
        fromObjectType: "calls",
        toObjectType: "contacts",
        fromObjectId: params.callId,
        toObjectId: params.contactId,
        associationType: "219",
      });
    }

    if (params.companyId) {
      associations.push({
        fromObjectType: "calls",
        toObjectType: "companies",
        fromObjectId: params.callId,
        toObjectId: params.companyId,
        associationType: "220",
      });
    }

    if (associations.length === 0) {
      return {};
    }

    try {
      const results = await this.createBatchAssociations(associations);

      // Daha güvenli kontroller ekleyelim
      const contactAssociation = results?.find((result) => {
        try {
          return result?.inputs?.to?.id === params.contactId;
        } catch (e) {
          return false;
        }
      });

      const companyAssociation = results?.find((result) => {
        try {
          return result?.inputs?.to?.id === params.companyId;
        } catch (e) {
          return false;
        }
      });

      // Log results for debugging
      console.log("Association results:", {
        resultsLength: results?.length,
        results: JSON.stringify(results, null, 2),
        contactAssociation: contactAssociation ? "found" : "not found",
        companyAssociation: companyAssociation ? "found" : "not found",
      });

      return {
        contactAssociation,
        companyAssociation,
      };
    } catch (error) {
      console.error("Create call associations error:", error);

      // Add more detailed error logging
      if (error instanceof Error) {
        console.error({
          message: error.message,
          stack: error.stack,
          params: {
            callId: params.callId,
            contactId: params.contactId,
            companyId: params.companyId,
          },
        });
      }

      throw error;
    }
  }
}
