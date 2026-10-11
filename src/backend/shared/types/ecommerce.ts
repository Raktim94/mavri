export type EcommercePlatform = 'shopify' | 'woocommerce' | 'generic';

export interface EcommerceIntegration {
  id: number;
  name: string;
  platform: EcommercePlatform;
  webhookSecretEncrypted: string;
  businessId: number;
  currencyId: number;
  bankId?: number | null;
  layoutId?: number | null;
  styleProfilesId?: number | null;
  defaultTaxRate: number;
  autoIssue: boolean;
  isActive: boolean;
  lastEventAt?: string | null;
  createdByUserId?: number | null;
  createdAt: string;
  updatedAt: string;
}

export interface PublicEcommerceIntegration {
  id: number;
  name: string;
  platform: EcommercePlatform;
  businessId: number;
  currencyId: number;
  bankId?: number | null;
  layoutId?: number | null;
  styleProfilesId?: number | null;
  defaultTaxRate: number;
  autoIssue: boolean;
  isActive: boolean;
  lastEventAt?: string | null;
  webhookUrl: string;
  createdAt: string;
  updatedAt: string;
}

export interface EcommerceOrderRecord {
  id: number;
  integrationId: number;
  externalOrderId: string;
  invoiceId?: number | null;
  status: 'received' | 'processed' | 'failed' | 'skipped';
  errorMessage?: string | null;
  rawPayloadHash?: string | null;
  receivedAt: string;
  processedAt?: string | null;
}

// The shape every platform adapter normalizes a webhook payload down to,
// before it ever touches invoice-building logic. Keeping this one flat,
// platform-agnostic type is what lets Shopify, WooCommerce and a future
// "generic" JSON webhook all share the same order -> invoice pipeline.
export interface NormalizedOrder {
  externalOrderId: string;
  orderNumber?: string;
  currencyCode?: string;
  customer: {
    name: string;
    email?: string;
    phone?: string;
    address?: string;
    countryCode?: string;
    vatCode?: string;
  };
  lineItems: {
    sku?: string;
    name: string;
    quantity: number;
    unitPriceMajor: number; // e.g. 19.99, in the order's currency major unit
  }[];
  shippingMajor?: number;
  taxRatePercent?: number;
  notes?: string;
}
