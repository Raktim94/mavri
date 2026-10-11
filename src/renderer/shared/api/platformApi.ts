import { gzip } from 'pako';
import type { DatabaseType } from '../enums/databaseType';
import type { DBInitType } from '../enums/dbInitType';
import type { EInvoice } from '../enums/einvoice';
import type { InvoiceType } from '../enums/invoiceType';
import type { BankAdd, BankUpdate, BankUpdateWeb, BankWeb } from '../types/bank';
import type { BusinessAdd, BusinessUpdate, BusinessWeb } from '../types/business';
import type { Category, CategoryAdd, CategoryUpdate } from '../types/category';
import type { Client, ClientAdd, ClientUpdate } from '../types/client';
import type { Currency, CurrencyAdd, CurrencyUpdate } from '../types/currency';
import type { ExportMeta } from '../types/exportMeta';
import type { FilterData } from '../types/filter';
import type {
  CustomFieldMeta,
  InvoiceAdd,
  InvoiceAttachment,
  InvoiceAttachmentWeb,
  InvoiceUpdate,
  InvoiceWeb,
  NextSequenceData
} from '../types/invoice';
import type { Item, ItemAdd, ItemUpdate } from '../types/item';
import type { Layout, LayoutAdd, LayoutUpdate } from '../types/layouts';
import type { PostgresConfig } from '../types/postgresConfig';
import type { Preset, PresetAdd, PresetUpdate, PresetUpdateWeb, PresetWeb } from '../types/preset';
import type { Response } from '../types/response';
import type { Settings, SettingsUpdate } from '../types/settings';
import type {
  StyleProfileAdd,
  StyleProfileUpdate,
  StyleProfileUpdateWeb,
  StyleProfileWeb
} from '../types/styleProfiles';
import type { Unit, UnitAdd, UnitUpdate } from '../types/unit';
import { base64ToBytes, toDataUrl } from '../utils/dataUrlFunctions';

const encodeFileToBase64 = async (file?: Uint8Array | null) => {
  if (!file) return null;
  const dataUrl = await toDataUrl(file);
  return dataUrl.split(',')[1] ?? null;
};

const decodeBase64Field = (encoded?: string | null) => (encoded ? base64ToBytes(encoded) : undefined);

const bankFromWire = <T extends BankWeb | BankUpdateWeb>(wire: T) => ({
  ...wire,
  qrCode: decodeBase64Field(wire.qrCode)
});

const bankToWire = async <T extends BankUpdate | BankAdd>(data: T) => ({
  ...data,
  qrCode: await encodeFileToBase64(data.qrCode)
});

const presetFromWireFull = <T extends PresetWeb>(wire: T) => ({
  ...wire,
  signatureData: decodeBase64Field(wire.signatureData),
  businessLogo: decodeBase64Field(wire.businessLogo),
  qrCode: decodeBase64Field(wire.qrCode),
  styleProfileWatermarkFileData: decodeBase64Field(wire.styleProfileWatermarkFileData),
  styleProfilePaidWatermarkFileData: decodeBase64Field(wire.styleProfilePaidWatermarkFileData)
});

const presetFromWireWrite = <T extends PresetUpdateWeb>(wire: T) => ({
  ...wire,
  signatureData: decodeBase64Field(wire.signatureData)
});

const presetToWire = async <T extends PresetUpdate | PresetAdd>(data: T) => ({
  ...data,
  signatureData: await encodeFileToBase64(data.signatureData)
});

const presetWriteResponse = (response: Response<PresetWeb>): Response<Preset> => ({
  ...response,
  data: response.data ? (presetFromWireWrite(response.data) as unknown as Preset) : undefined
});

const styleProfileFromWire = <T extends StyleProfileWeb | StyleProfileUpdateWeb>(wire: T) => ({
  ...wire,
  paidWatermarkFileData: decodeBase64Field(wire.paidWatermarkFileData),
  watermarkFileData: decodeBase64Field(wire.watermarkFileData)
});

const styleProfileToWire = async <T extends StyleProfileUpdate | StyleProfileAdd>(data: T) => ({
  ...data,
  paidWatermarkFileData: await encodeFileToBase64(data.paidWatermarkFileData),
  watermarkFileData: await encodeFileToBase64(data.watermarkFileData)
});

const attachmentFromWire = (attachment: InvoiceAttachmentWeb) => ({
  ...attachment,
  data: base64ToBytes(attachment.data)
});

const attachmentToWire = async (attachment: InvoiceAttachment) => ({
  ...attachment,
  data: await encodeFileToBase64(attachment.data)
});

const invoiceFromWire = (invoice: InvoiceWeb) => ({
  ...invoice,
  signatureData: decodeBase64Field(invoice.signatureData),
  invoiceBusinessSnapshot: invoice.invoiceBusinessSnapshot
    ? {
        ...invoice.invoiceBusinessSnapshot,
        businessLogo: decodeBase64Field(invoice.invoiceBusinessSnapshot.businessLogo)
      }
    : invoice.invoiceBusinessSnapshot,
  invoiceBankSnapshot: invoice.invoiceBankSnapshot
    ? {
        ...invoice.invoiceBankSnapshot,
        qrCode: decodeBase64Field(invoice.invoiceBankSnapshot.qrCode)
      }
    : invoice.invoiceBankSnapshot,
  invoiceCustomization: invoice.invoiceCustomization
    ? {
        ...invoice.invoiceCustomization,
        paidWatermarkFileData: decodeBase64Field(invoice.invoiceCustomization.paidWatermarkFileData),
        watermarkFileData: decodeBase64Field(invoice.invoiceCustomization.watermarkFileData)
      }
    : invoice.invoiceCustomization,
  invoiceAttachments: (invoice.invoiceAttachments ?? []).map(attachmentFromWire)
});

const invoiceToWire = async (data: InvoiceUpdate | InvoiceAdd) => ({
  ...data,
  signatureData: await encodeFileToBase64(data.signatureData),
  invoiceBusinessSnapshot: data.invoiceBusinessSnapshot
    ? {
        ...data.invoiceBusinessSnapshot,
        businessLogo: await encodeFileToBase64(data.invoiceBusinessSnapshot.businessLogo)
      }
    : data.invoiceBusinessSnapshot,
  invoiceBankSnapshot: data.invoiceBankSnapshot
    ? {
        ...data.invoiceBankSnapshot,
        qrCode: await encodeFileToBase64(data.invoiceBankSnapshot.qrCode)
      }
    : data.invoiceBankSnapshot,
  invoiceCustomization: data.invoiceCustomization
    ? {
        ...data.invoiceCustomization,
        paidWatermarkFileData: await encodeFileToBase64(data.invoiceCustomization.paidWatermarkFileData),
        watermarkFileData: await encodeFileToBase64(data.invoiceCustomization.watermarkFileData)
      }
    : data.invoiceCustomization,

  invoiceAttachments: await Promise.all((data.invoiceAttachments ?? []).map(attachmentToWire))
});

const apiOrigin = (): string => {
  if (typeof window === 'undefined') return '';
  return (import.meta.env.VITE_API_URL as string) || window.location.origin;
};

const withQueryParams = (path: string, params?: Record<string, string>) => {
  const url = new URL(path, apiOrigin());
  if (params) {
    Object.entries(params).forEach(([key, value]) => url.searchParams.set(key, value));
  }
  return url.toString();
};

const apiGet = async <T>(path: string, params?: Record<string, string>): Promise<T> => {
  const res = await fetch(withQueryParams(path, params), { credentials: 'include' });
  return res.json() as Promise<T>;
};

const apiGetBlob = async (path: string, params?: Record<string, string>): Promise<Response<Uint8Array | undefined>> => {
  const res = await fetch(withQueryParams(path, params), { credentials: 'include' });
  if (res.ok) {
    const buffer = await res.arrayBuffer();
    return { success: true, data: new Uint8Array(buffer) } as Response<Uint8Array | undefined>;
  }
  return { success: false };
};

const apiPost = async <T>(path: string, body?: unknown): Promise<T> => {
  const options: RequestInit = { method: 'POST', credentials: 'include' };

  if (body instanceof FormData) {
    options.body = body;
  } else if (body !== undefined) {
    options.headers = { 'Content-Type': 'application/json' };
    options.body = JSON.stringify(body);
  }

  const res = await fetch(apiOrigin() + path, options);
  return res.json() as Promise<T>;
};

const apiPut = async <T>(path: string, body?: unknown): Promise<T> => {
  const res = await fetch(apiOrigin() + path, {
    method: 'PUT',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: body !== undefined ? JSON.stringify(body) : undefined
  });
  return res.json() as Promise<T>;
};

const apiDelete = async <T>(path: string): Promise<T> => {
  const res = await fetch(apiOrigin() + path, { method: 'DELETE', credentials: 'include' });
  return res.json() as Promise<T>;
};

const downloadJsonFile = (contents: unknown, fileName: string, space?: number) => {
  const blob = new Blob([JSON.stringify(contents, null, space)], { type: 'application/json' });
  const anchor = document.createElement('a');
  anchor.href = URL.createObjectURL(blob);
  anchor.download = fileName;
  anchor.click();
  URL.revokeObjectURL(anchor.href);
  return anchor.download;
};

const safeFileName = (name: string, fallback: string) => name.replace(/[^a-z0-9_-]/gi, '_') || fallback;

export interface AuthStatus {
  needsSetup: boolean;
}
export interface AuthUser {
  id: number;
  email: string;
  role: string;
}

export const getDatabaseReady = () => apiGet<Response<{ ready: boolean }>>('/api/databases/ready');
export const getAuthStatus = () => apiGet<Response<AuthStatus>>('/api/auth/status');
export const getAuthMe = () => apiGet<Response<AuthUser>>('/api/auth/me');
export const postAuthSetup = (email: string, password: string) =>
  apiPost<Response<AuthUser>>('/api/auth/setup', { email, password });
export const postAuthLogin = (email: string, password: string) =>
  apiPost<Response<AuthUser>>('/api/auth/login', { email, password });
export const postAuthLogout = () => apiPost<Response<undefined>>('/api/auth/logout');

export const webApi = () => {
  return {
    ping: () => console.log('pong'),

    getAppVersion: () => apiGet<{ version: string }>('/api/version').then(r => r.version),

    openUrl: (url: string) => {
      window.open(url, '_blank');
      return Promise.resolve();
    },
    initializeDatabase: (data: {
      postgresConfig?: PostgresConfig;
      dbType: DatabaseType;
      fullPath?: string;
      mode?: DBInitType;
    }) => apiPost<{ success: boolean; message?: string }>('/api/databases', data),
    getDatabaseList: () => apiGet<Response<string[]>>('/api/databases'),
    testConnection: (data: PostgresConfig) => apiPost<Response<unknown>>('/api/databases/test', data),

    getAllSettings: () => apiGet<Response<Settings>>('/api/settings'),
    updateSettings: (data: SettingsUpdate) => apiPut<Response<SettingsUpdate>>('/api/settings', data),

    getAllBusinesses: async (filter?: FilterData[]) => {
      const response = await apiGet<Response<BusinessWeb[]>>(
        '/api/businesses',
        filter?.length ? { filter: JSON.stringify(filter) } : undefined
      );
      return {
        ...response,
        data: response.data
          ? response.data.map(business => ({
              ...business,
              logo: decodeBase64Field(business.logo)
            }))
          : response.data
      };
    },
    updateBusiness: async (data: BusinessUpdate) => {
      const response = await apiPut<Response<BusinessWeb>>('/api/businesses', {
        ...data,
        logo: await encodeFileToBase64(data.logo)
      });

      return {
        ...response,
        data: response.data
          ? {
              ...response.data,
              logo: decodeBase64Field(response.data.logo)
            }
          : response.data
      };
    },
    addBusiness: async (data: BusinessAdd) => {
      const response = await apiPost<Response<BusinessWeb>>('/api/businesses', {
        ...data,
        logo: await encodeFileToBase64(data.logo)
      });

      return {
        ...response,
        data: response.data
          ? {
              ...response.data,
              logo: decodeBase64Field(response.data.logo)
            }
          : response.data
      };
    },
    deleteBusiness: (id: number) => apiDelete<Response<unknown>>(`/api/businesses/${id}`),
    addBatchBusiness: (data: BusinessAdd[]) => apiPost<Response<BusinessWeb[]>>('/api/businesses/batch', data),

    getAllStyleProfiles: async (filter?: FilterData[]) => {
      const response = await apiGet<Response<StyleProfileWeb[]>>(
        '/api/styleProfiles',
        filter?.length ? { filter: JSON.stringify(filter) } : undefined
      );

      return {
        ...response,
        data: response.data?.map(styleProfileFromWire) ?? []
      };
    },
    updateStyleProfile: async (data: StyleProfileUpdate) => {
      const response = await apiPut<Response<StyleProfileWeb>>('/api/styleProfiles', await styleProfileToWire(data));

      return {
        ...response,
        data: response.data && styleProfileFromWire(response.data)
      };
    },
    addStyleProfile: async (data: StyleProfileAdd) => {
      const response = await apiPost<Response<StyleProfileWeb>>('/api/styleProfiles', await styleProfileToWire(data));

      return {
        ...response,
        data: response.data && styleProfileFromWire(response.data)
      };
    },
    deleteStyleProfile: (id: number) => apiDelete<Response<unknown>>(`/api/styleProfiles/${id}`),
    addBatchStyleProfile: (data: StyleProfileAdd[]) =>
      apiPost<Response<StyleProfileAdd[]>>('/api/styleProfiles/batch', data),

    getAllLayouts: (filter?: FilterData[]) =>
      apiGet<Response<Layout[]>>('/api/layouts', filter?.length ? { filter: JSON.stringify(filter) } : undefined),
    addLayout: (data: LayoutAdd) => apiPost<Response<Layout>>('/api/layouts', data),
    updateLayout: (data: LayoutUpdate) => apiPut<Response<Layout>>('/api/layouts', data),
    deleteLayout: (id: number) => apiDelete<Response<unknown>>(`/api/layouts/${id}`),
    exportLayout: async (id: number): Promise<Response<ExportMeta>> => {
      const result = await apiGet<{ success: boolean; data?: Layout }>(`/api/layouts/export/${id}`);
      if (!result.success || !result.data) return result as Response<ExportMeta>;

      const fileName = `${safeFileName(result.data.schema.meta.name, 'layout')}.json`;
      downloadJsonFile(result.data.schema, fileName, 2);
      return { success: true, data: { filePath: fileName } };
    },

    getAllClients: (filter?: FilterData[]) =>
      apiGet<Response<Client[]>>('/api/clients', filter?.length ? { filter: JSON.stringify(filter) } : undefined),
    addClient: (data: ClientAdd) => apiPost<Response<Client>>('/api/clients', data),
    updateClient: (data: ClientUpdate) => apiPut<Response<Client>>('/api/clients', data),
    deleteClient: (id: number) => apiDelete<Response<unknown>>(`/api/clients/${id}`),
    addBatchClient: (data: ClientAdd[]) => apiPost<Response<Client[]>>('/api/clients/batch', data),

    getAllItems: (filter?: FilterData[]) =>
      apiGet<Response<Item[]>>('/api/items', filter?.length ? { filter: JSON.stringify(filter) } : undefined),
    addItem: (data: ItemAdd) => apiPost<Response<Item>>('/api/items', data),
    updateItem: (data: ItemUpdate) => apiPut<Response<Item>>('/api/items', data),
    deleteItem: (id: number) => apiDelete<Response<unknown>>(`/api/items/${id}`),
    addBatchItem: (data: ItemAdd[]) => apiPost<Response<Item[]>>('/api/items/batch', data),

    getAllUnits: (filter?: FilterData[]) =>
      apiGet<Response<Unit[]>>('/api/units', filter?.length ? { filter: JSON.stringify(filter) } : undefined),
    addUnit: (data: UnitAdd) => apiPost<Response<Unit>>('/api/units', data),
    updateUnit: (data: UnitUpdate) => apiPut<Response<Unit>>('/api/units', data),
    deleteUnit: (id: number) => apiDelete<Response<unknown>>(`/api/units/${id}`),
    addBatchUnit: (data: UnitAdd[]) => apiPost<Response<Unit[]>>('/api/units/batch', data),

    getAllCategories: (filter?: FilterData[]) =>
      apiGet<Response<Category[]>>('/api/categories', filter?.length ? { filter: JSON.stringify(filter) } : undefined),
    addCategory: (data: CategoryAdd) => apiPost<Response<Category>>('/api/categories', data),
    updateCategory: (data: CategoryUpdate) => apiPut<Response<Category>>('/api/categories', data),
    deleteCategory: (id: number) => apiDelete<Response<unknown>>(`/api/categories/${id}`),
    addBatchCategory: (data: CategoryAdd[]) => apiPost<Response<Category[]>>('/api/categories/batch', data),

    getAllCurrencies: (filter?: FilterData[]) =>
      apiGet<Response<Currency[]>>('/api/currencies', filter?.length ? { filter: JSON.stringify(filter) } : undefined),
    addCurrency: (data: CurrencyAdd) => apiPost<Response<Currency>>('/api/currencies', data),
    updateCurrency: (data: CurrencyUpdate) => apiPut<Response<Currency>>('/api/currencies', data),
    deleteCurrency: (id: number) => apiDelete<Response<unknown>>(`/api/currencies/${id}`),
    addBatchCurrency: (data: CurrencyAdd[]) => apiPost<Response<Currency[]>>('/api/currencies/batch', data),

    getAllBanks: async (filter?: FilterData[]) => {
      const response = await apiGet<Response<BankWeb[]>>(
        '/api/banks',
        filter?.length ? { filter: JSON.stringify(filter) } : undefined
      );

      return {
        ...response,
        data: response.data?.map(bankFromWire) ?? []
      };
    },
    updateBank: async (data: BankUpdate) => {
      const response = await apiPut<Response<BankWeb>>('/api/banks', await bankToWire(data));

      return {
        ...response,
        data: response.data && bankFromWire(response.data)
      };
    },
    addBank: async (data: BankAdd) => {
      const response = await apiPost<Response<BankWeb>>('/api/banks', await bankToWire(data));

      return {
        ...response,
        data: response.data && bankFromWire(response.data)
      };
    },
    deleteBank: (id: number) => apiDelete<Response<unknown>>(`/api/banks/${id}`),
    addBatchBank: (data: BankAdd[]) => apiPost<Response<BankAdd[]>>('/api/banks/batch', data),

    getAllPresets: async (filter?: FilterData[]) => {
      const response = await apiGet<Response<PresetWeb[]>>(
        '/api/presets',
        filter?.length ? { filter: JSON.stringify(filter) } : undefined
      );

      return {
        ...response,
        data: response.data?.map(presetFromWireFull) ?? []
      };
    },
    updatePreset: async (data: PresetUpdate): Promise<Response<Preset>> => {
      const response = await apiPut<Response<PresetWeb>>('/api/presets', await presetToWire(data));

      return presetWriteResponse(response);
    },
    addPreset: async (data: PresetAdd): Promise<Response<Preset>> => {
      const response = await apiPost<Response<PresetWeb>>('/api/presets', await presetToWire(data));

      return presetWriteResponse(response);
    },
    deletePreset: (id: number) => apiDelete<Response<unknown>>(`/api/presets/${id}`),
    addBatchPreset: (data: PresetAdd[]) => apiPost<Response<PresetAdd[]>>('/api/presets/batch', data),

    getNextSequence: async (data: { businessId: number; clientId: number; invoiceType: InvoiceType }) =>
      apiGet<Response<NextSequenceData | undefined>>('/api/invoices/sequence', {
        businessId: data.businessId.toString(),
        clientId: data.clientId.toString(),
        invoiceType: data.invoiceType
      }),
    getEInvoiceXML: async (data: { invoiceId: number; einvoice: EInvoice }) =>
      apiGetBlob('/api/invoices/xml', {
        invoiceId: data.invoiceId.toString(),
        einvoice: data.einvoice
      }),
    getCustomHeaders: async (type: InvoiceType) =>
      apiGet<Response<CustomFieldMeta[]>>('/api/invoices/headers', { type: type }),
    getAllInvoices: async (type?: InvoiceType, filter?: FilterData[]) => {
      const params: Record<string, string> = {};
      if (type) params.type = type;
      if (filter?.length) params.filter = JSON.stringify(filter);

      const response = await apiGet<Response<InvoiceWeb[]>>(
        '/api/invoices',
        Object.keys(params).length ? params : undefined
      );

      return {
        ...response,
        data: response.data?.map(invoiceFromWire)
      };
    },
    updateInvoice: async (data: InvoiceUpdate) => {
      const response = await apiPut<Response<InvoiceWeb>>('/api/invoices', await invoiceToWire(data));

      return {
        ...response,
        data: response.data && invoiceFromWire(response.data)
      };
    },
    addInvoice: async (data: InvoiceAdd) => {
      const response = await apiPost<Response<InvoiceWeb>>('/api/invoices', await invoiceToWire(data));

      return {
        ...response,
        data: response.data && invoiceFromWire(response.data)
      };
    },
    duplicateInvoice: async (id: number, invoiceType: InvoiceType) => {
      const response = await apiPost<Response<InvoiceWeb>>('/api/invoices/duplicate', {
        invoiceId: id,
        invoiceType
      });

      return {
        ...response,
        data: response.data && invoiceFromWire(response.data)
      };
    },
    deleteInvoice: (id: number) => apiDelete<Response<unknown>>(`/api/invoices/${id}`),

    exportAllData: async (): Promise<Response<ExportMeta>> => {
      const result = await apiGet<{ success: boolean; data?: unknown }>('/api/export');
      if (!result.success || !result.data) return result as Response<ExportMeta>;

      const fileName = `mavri-backup-${new Date().toISOString().slice(0, 10)}.json`;
      downloadJsonFile(result.data, fileName, 2);
      return { success: true, data: { filePath: fileName } };
    },

    importAllData: (): Promise<Response<unknown>> => {
      return new Promise(resolve => {
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = '.json,application/json';
        input.onchange = async () => {
          const file = input.files?.[0];
          if (!file) {
            resolve({ success: false });
            return;
          }
          const text = await file.text();
          let parsed: unknown;
          try {
            parsed = JSON.parse(text);
          } catch {
            resolve({ success: false, key: 'error.invalidFile' });
            return;
          }

          const compressed = gzip(JSON.stringify(parsed));
          const blob = new Blob([compressed], { type: 'application/gzip' });
          const formData = new FormData();
          formData.append('file', blob, file.name + '.gz');

          const result = await apiPost<Response<unknown>>('/api/import', formData);
          resolve(result);
        };
        input.click();
      });
    }
  };
};

export type Api = ReturnType<typeof webApi>;
