export interface Preset {
  id?: number;
  name: string;
  businessId?: number;
  businessName?: string;
  clientId?: number;
  clientName?: string;
  currencyId?: number;
  currencyCode?: string;
  currencySymbol?: string;
  bankId?: number;
  bankName?: string;
  styleProfilesId?: number;
  styleProfileName?: string;
  customerNotes?: string;
  thanksNotes?: string;
  termsConditionNotes?: string;
  language?: string;
  signatureData?: Uint8Array;
  signatureSize?: number;
  signatureType?: string;
  signatureName?: string;
  isArchived: boolean;
  createdAt: string;
  updatedAt: string;
}
