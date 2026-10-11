export type EcommercePlatform = 'shopify' | 'woocommerce' | 'generic';

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

const INTEGRATIONS_PATH = '/api/ecommerce/integrations';

const apiOrigin = (): string => {
  if (typeof window === 'undefined') return '';
  return (import.meta.env.VITE_API_URL as string) || window.location.origin;
};

const requestJson = async <T>(path: string, init?: RequestInit): Promise<ApiResponse<T>> => {
  const res = await fetch(`${apiOrigin()}${path}`, { credentials: 'include', ...init });
  return res.json();
};

export const listEcommerceIntegrations = async (): Promise<ApiResponse<PublicEcommerceIntegration[]>> => {
  return requestJson<PublicEcommerceIntegration[]>(INTEGRATIONS_PATH);
};

export const createEcommerceIntegration = async (
  payload: CreateIntegrationPayload
): Promise<ApiResponse<CreateIntegrationResult>> => {
  return requestJson<CreateIntegrationResult>(INTEGRATIONS_PATH, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });
};

export const deactivateEcommerceIntegration = async (id: number): Promise<ApiResponse<undefined>> => {
  return requestJson<undefined>(`${INTEGRATIONS_PATH}/${id}/deactivate`, { method: 'POST' });
};

export const deleteEcommerceIntegration = async (id: number): Promise<ApiResponse<undefined>> => {
  return requestJson<undefined>(`${INTEGRATIONS_PATH}/${id}`, { method: 'DELETE' });
};
