export interface BusinessMeta {
  id: number;
  name: string;
  shortName: string;
  role?: string;
  address?: string;
  email?: string;
  phone?: string;
  website?: string;
  additional?: string;
  description?: string;
  vatCode?: string;
  countryCode?: string;
  code?: string;
  peppolEndpointId?: string;
  peppolEndpointSchemeId?: string;
  paymentInformation?: string;
  fileSize?: number;
  fileType?: string;
  fileName?: string;
  invoiceCount: number;
  quotesCount: number;
  createdAt: string;
  updatedAt: string;
  isArchived: boolean;
}

export interface Business extends BusinessMeta {
  logo?: Uint8Array | null;
}

export interface BusinessWeb extends BusinessMeta {
  logo?: string | null;
}

export interface BusinessAddMeta {
  name: string;
  shortName: string;
  role?: string;
  address?: string;
  email?: string;
  phone?: string;
  website?: string;
  additional?: string;
  description?: string;
  vatCode?: string;
  countryCode?: string;
  code?: string;
  peppolEndpointId?: string;
  peppolEndpointSchemeId?: string;
  paymentInformation?: string;
  fileSize?: number;
  fileType?: string;
  fileName?: string;
  isArchived: boolean;
}

export interface BusinessAdd extends BusinessAddMeta {
  logo?: Uint8Array | null;
}

export interface BusinessAddWeb extends BusinessAddMeta {
  logo?: string | null;
}

export interface BusinessUpdate extends BusinessAdd {
  id: number;
}

export interface BusinessUpdateWeb extends BusinessAddWeb {
  id: number;
}

export interface BusinessFromData {
  id?: number;
  logo?: Uint8Array;
  name: string;
  shortName: string;
  role?: string;
  address?: string;
  email?: string;
  phone?: string;
  website?: string;
  additional?: string;
  description?: string;
  vatCode?: string;
  countryCode?: string;
  code?: string;
  peppolEndpointId?: string;
  peppolEndpointSchemeId?: string;
  paymentInformation?: string;
  fileSize?: number;
  fileType?: string;
  fileName?: string;
  isArchived: boolean;
}
