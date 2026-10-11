export interface Client {
  id: number;
  name: string;
  shortName: string;
  address?: string;
  email?: string;
  phone?: string;
  code?: string;
  additional?: string;
  description?: string;
  vatCode?: string;
  countryCode?: string;
  peppolEndpointId?: string;
  peppolEndpointSchemeId?: string;
  buyerReference?: string;
  taxExempt?: boolean;
  taxExemptionCertificate?: string;
  isArchived: boolean;
  invoiceCount: number;
  quotesCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface ClientAdd {
  name: string;
  shortName: string;
  address?: string;
  email?: string;
  phone?: string;
  code?: string;
  additional?: string;
  description?: string;
  vatCode?: string;
  countryCode?: string;
  peppolEndpointId?: string;
  peppolEndpointSchemeId?: string;
  buyerReference?: string;
  taxExempt?: boolean;
  taxExemptionCertificate?: string;
  isArchived: boolean;
}

export interface ClientUpdate extends ClientAdd {
  id: number;
}

export interface ClientFromData {
  id?: number;
  name: string;
  shortName: string;
  address?: string;
  email?: string;
  phone?: string;
  code?: string;
  additional?: string;
  description?: string;
  vatCode?: string;
  countryCode?: string;
  peppolEndpointId?: string;
  peppolEndpointSchemeId?: string;
  buyerReference?: string;
  taxExempt?: boolean;
  taxExemptionCertificate?: string;
  isArchived: boolean;
}
