export interface PresetMeta {
  id: number;
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
  signatureSize?: number;
  signatureType?: string;
  signatureName?: string;
  isArchived: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface Preset extends PresetMeta {
  signatureData?: Uint8Array | null;
}

export interface PresetWeb extends PresetMeta {
  signatureData?: string | null;
}

export interface PresetAddMeta {
  name: string;
  businessId?: number;
  clientId?: number;
  currencyId?: number;
  bankId?: number;
  styleProfilesId?: number;
  customerNotes?: string;
  thanksNotes?: string;
  termsConditionNotes?: string;
  language?: string;
  signatureSize?: number;
  signatureType?: string;
  signatureName?: string;
  isArchived: boolean;
}

export interface PresetAdd extends PresetAddMeta {
  signatureData?: Uint8Array | null;
}

export interface PresetUpdate extends PresetAdd {
  id: number;
}

export interface PresetAddWeb extends PresetAddMeta {
  signatureData?: string | null;
}

export interface PresetUpdateWeb extends PresetAddWeb {
  id: number;
}

export interface PresetFromData {
  id?: number;
  name: string;
  businessId?: number;
  clientId?: number;
  currencyId?: number;
  bankId?: number;
  styleProfilesId?: number;
  customerNotes?: string;
  thanksNotes?: string;
  termsConditionNotes?: string;
  language?: string;
  signatureData?: Uint8Array | null;
  signatureSize?: number;
  signatureType?: string;
  signatureName?: string;
  isArchived: boolean;
}
