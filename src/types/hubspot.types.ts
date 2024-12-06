// src/types/hubspot.types.ts

export interface HubspotContact {
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

export interface ErrorLog {
  timestamp: string;
  error: string;
  context: {
    method: string;
    params?: any;
    response?: any;
  };
}

export interface AssociationInput {
  fromObjectType: string;
  toObjectType: string;
  fromObjectId: string;
  toObjectId: string;
  associationType: string;
}

export interface AssociationRequest {
  from: {
    id: string;
  };
  to: {
    id: string;
  };
  types?: Array<{
    associationCategory: string;
    associationTypeId: number;
  }>;
}

export interface BatchAssociationResult {
  status: "SUCCESS" | "ERROR";
  message?: string;
  inputs: AssociationRequest;
}

// Default association request türü
export interface DefaultAssociationRequest {
  from: {
    id: string;
  };
  to: {
    id: string;
  };
}

export interface BatchAssociationResult {
  status: "SUCCESS" | "ERROR";
  message?: string;
  inputs: AssociationRequest;
}

export interface CallEngagementParams {
  contactId?: string;
  fromNumber: string;
  toNumber: string;
  callDuration: number;
  recordingUrl: string;
  callStatus: string;
  callTimestamp: number;
  callUuid: string;
  notes?: string;
}
