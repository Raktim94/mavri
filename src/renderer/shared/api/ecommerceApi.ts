// The e-commerce integration API is web-only by design: a Shopify/WooCommerce
// webhook needs a publicly reachable URL to call, which only exists when
// this app is running as the self-hosted web server (Docker), not the
// offline Electron desktop app. So this talks to the REST API directly
// rather than going through the Electron-IPC `getApi()` abstraction used
// everywhere else — there is deliberately no Electron equivalent to add.
export type EcommercePlatform = 'shopify' | 'woocommerce' | 'generic';

const baseUrl = (): string => {
  if (typeof window === 'undefined') return '';
  return (import.meta.env.VITE_API_URL as string) || window.location.origin;
};

export interface PublicEcommerceIntegration {
  id: number;
  name: string;
  platform: EcommercePlatform;
  businessId: number;
  currencyId: number;
  bankId?: number | null;
  defaultTaxRate: number;
  autoIssue: boolean;
  isActive: boolean;
  lastEventAt?: string | null;
  webhookUrl: string;
  createdAt: string;
}

export interface CreateIntegrationPayload {
  name: string;
  platform: EcommercePlatform;
  businessId: number;
  currencyId: number;
  bankId?: number;
  defaultTaxRate?: number;
  autoIssue?: boolean;
}

export interface CreateIntegrationResult {
  webhookSecret: string;
  webhookUrl: string;
  integration: { id: number; name: string; platform: EcommercePlatform };
}

interface ApiResponse<T> {
  success: boolean;
  data?: T;
  key?: string;
  message?: string;
}

export const listEcommerceIntegrations = async (): Promise<ApiResponse<PublicEcommerceIntegration[]>> => {
  const res = await fetch(`${baseUrl()}/api/ecommerce/integrations`, { credentials: 'include' });
  return res.json();
};

export const createEcommerceIntegration = async (
  payload: CreateIntegrationPayload
): Promise<ApiResponse<CreateIntegrationResult>> => {
  const res = await fetch(`${baseUrl()}/api/ecommerce/integrations`, {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });
  return res.json();
};

export const deactivateEcommerceIntegration = async (id: number): Promise<ApiResponse<undefined>> => {
  const res = await fetch(`${baseUrl()}/api/ecommerce/integrations/${id}/deactivate`, {
    method: 'POST',
    credentials: 'include'
  });
  return res.json();
};

export const deleteEcommerceIntegration = async (id: number): Promise<ApiResponse<undefined>> => {
  const res = await fetch(`${baseUrl()}/api/ecommerce/integrations/${id}`, {
    method: 'DELETE',
    credentials: 'include'
  });
  return res.json();
};
