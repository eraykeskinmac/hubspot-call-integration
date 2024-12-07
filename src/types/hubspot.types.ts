// src/types/hubspot.types.ts

// Contact interfaces
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

// Error logging interfaces
export interface ErrorLog {
  timestamp: string;
  error: string;
  context: {
    method: string;
    params?: any;
    response?: any;
  };
}

// Association interfaces
export interface AssociationInput {
  fromObjectType: string;
  toObjectType: string;
  fromObjectId: string;
  toObjectId: string;
  associationType: string;
}

export interface AssociationType {
  associationCategory: "HUBSPOT_DEFINED" | "USER_DEFINED";
  associationTypeId: number;
}

export interface AssociationRequest {
  from: {
    id: string;
    type?: string;
  };
  to: {
    id: string;
    type?: string;
  };
  types?: AssociationType[];
}

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
  result?: {
    associationId?: string;
  };
}

// Call engagement interfaces
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

// Response interfaces
export interface AssociationResponse {
  results?: BatchAssociationResult[];
  status?: string;
  message?: string;
}

export interface CallAssociationResponse {
  contactAssociation?: BatchAssociationResult;
  companyAssociation?: BatchAssociationResult;
}

// Constants
export const HUBSPOT_ASSOCIATION_TYPES = {
  CALL_TO_CONTACT: 219,
  CALL_TO_COMPANY: 220,
} as const;
