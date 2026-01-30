import type { DBInitType } from '../enums/dbInitType';
import type { InvoiceType } from '../enums/invoiceType';
import type { Business, BusinessAdd, BusinessUpdate } from '../types/business';
import type { Category, CategoryAdd, CategoryUpdate } from '../types/category';
import type { Client, ClientAdd, ClientUpdate } from '../types/client';
import type { Currency, CurrencyAdd, CurrencyUpdate } from '../types/currency';
import type { DBSelector } from '../types/dbSelector';
import type { ExportMeta } from '../types/exportMeta';
import type { FilterData } from '../types/filter';
import type { Invoice, InvoiceAdd, InvoiceUpdate } from '../types/invoice';
import type { Item, ItemAdd, ItemUpdate } from '../types/item';
import type { Response } from '../types/response';
import type { Settings, SettingsUpdate } from '../types/settings';
import type { StyleProfile, StyleProfileAdd, StyleProfileUpdate } from '../types/styleProfiles';
import type { Unit, UnitAdd, UnitUpdate } from '../types/unit';
import type { ProgressInfo } from '../types/updater';

const baseUrl = (): string => {
  if (typeof window === 'undefined') return '';
  return (import.meta.env.VITE_API_URL as string) || '';
};

const apiGet = async <T>(path: string, params?: Record<string, string>): Promise<T> => {
  const url = new URL(path, baseUrl() || window.location.origin);
  if (params) {
    Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v));
  }
  const res = await fetch(url.toString());
  return res.json() as Promise<T>;
};

const apiPost = async <T>(path: string, body?: unknown): Promise<T> => {
  const url = (baseUrl() || window.location.origin) + path;
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: body !== undefined ? JSON.stringify(body) : undefined
  });
  return res.json() as Promise<T>;
};

const apiPut = async <T>(path: string, body?: unknown): Promise<T> => {
  const url = (baseUrl() || window.location.origin) + path;
  const res = await fetch(url, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: body !== undefined ? JSON.stringify(body) : undefined
  });
  return res.json() as Promise<T>;
};

const apiDelete = async <T>(path: string): Promise<T> => {
  const url = (baseUrl() || window.location.origin) + path;
  const res = await fetch(url, { method: 'DELETE' });
  return res.json() as Promise<T>;
};

export const webApi = () => {
  return {
    ping: () => console.log('pong'),

    getAppVersion: () => apiGet<{ version: string }>('/api/version').then(r => r.version),

    checkForUpdates: () => Promise.resolve(),
    restartApp: () => {},
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    onUpdateProgress: (_callback: (data: ProgressInfo) => void) => () => {
      console.warn('Not supported for WEB API');
    },
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    onUpdateAvailable: (_callback: () => void) => () => {
      console.warn('Not supported for WEB API');
    },
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    onUpdateNotAvailable: (_callback: () => void) => () => {
      console.warn('Not supported for WEB API');
    },
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    onUpdateDownloaded: (_callback: (version: string) => void) => () => {
      console.warn('Not supported for WEB API');
    },

    openUrl: (url: string) => {
      window.open(url, '_blank');
      return Promise.resolve();
    },
    selectDatabase: () =>
      Promise.resolve({ success: true, data: { canceled: true, filePath: '' } } as Response<DBSelector>),
    openDatabase: () =>
      Promise.resolve({ success: true, data: { canceled: true, filePath: '' } } as Response<DBSelector>),
    initializeDatabase: (data: { fullPath: string; mode?: DBInitType }) =>
      apiPost<{ success: boolean; message?: string }>('/api/databases', data),
    getDatabaseList: () => apiGet<Response<string[]>>('/api/databases'),

    getAllSettings: () => apiGet<Response<Settings>>('/api/settings'),
    updateSettings: (data: SettingsUpdate) => apiPut<Response<SettingsUpdate>>('/api/settings', data),

    getAllBusinesses: (filter?: FilterData[]) =>
      apiGet<Response<Business[]>>('/api/businesses', filter?.length ? { filter: JSON.stringify(filter) } : undefined),
    addBusiness: (data: BusinessAdd) => apiPost<Response<Business>>('/api/businesses', data),
    updateBusiness: (data: BusinessUpdate) => apiPut<Response<BusinessUpdate>>('/api/businesses', data),
    deleteBusiness: (id: number) => apiDelete<Response<unknown>>(`/api/businesses/${id}`),
    addBatchBusiness: (data: BusinessAdd[]) => apiPost<Response<BusinessAdd[]>>('/api/businesses/batch', data),

    getAllStyleProfiles: (filter?: FilterData[]) =>
      apiGet<Response<StyleProfile[]>>(
        '/api/styleProfiles',
        filter?.length ? { filter: JSON.stringify(filter) } : undefined
      ),
    addStyleProfile: (data: StyleProfileAdd) => apiPost<Response<StyleProfile>>('/api/styleProfiles', data),
    updateStyleProfile: (data: StyleProfileUpdate) => apiPut<Response<StyleProfileUpdate>>('/api/styleProfiles', data),
    deleteStyleProfile: (id: number) => apiDelete<Response<unknown>>(`/api/styleProfiles/${id}`),
    addBatchStyleProfile: (data: StyleProfileAdd[]) =>
      apiPost<Response<StyleProfileAdd[]>>('/api/styleProfiles/batch', data),

    getAllClients: (filter?: FilterData[]) =>
      apiGet<Response<Client[]>>('/api/clients', filter?.length ? { filter: JSON.stringify(filter) } : undefined),
    addClient: (data: ClientAdd) => apiPost<Response<Client>>('/api/clients', data),
    updateClient: (data: ClientUpdate) => apiPut<Response<ClientUpdate>>('/api/clients', data),
    deleteClient: (id: number) => apiDelete<Response<unknown>>(`/api/clients/${id}`),
    addBatchClient: (data: ClientAdd[]) => apiPost<Response<ClientAdd[]>>('/api/clients/batch', data),

    getAllItems: (filter?: FilterData[]) =>
      apiGet<Response<Item[]>>('/api/items', filter?.length ? { filter: JSON.stringify(filter) } : undefined),
    addItem: (data: ItemAdd) => apiPost<Response<Item>>('/api/items', data),
    updateItem: (data: ItemUpdate) => apiPut<Response<ItemUpdate>>('/api/items', data),
    deleteItem: (id: number) => apiDelete<Response<unknown>>(`/api/items/${id}`),
    addBatchItem: (data: ItemAdd[]) => apiPost<Response<ItemAdd[]>>('/api/items/batch', data),

    getAllUnits: (filter?: FilterData[]) =>
      apiGet<Response<Unit[]>>('/api/units', filter?.length ? { filter: JSON.stringify(filter) } : undefined),
    addUnit: (data: UnitAdd) => apiPost<Response<Unit>>('/api/units', data),
    updateUnit: (data: UnitUpdate) => apiPut<Response<UnitUpdate>>('/api/units', data),
    deleteUnit: (id: number) => apiDelete<Response<unknown>>(`/api/units/${id}`),
    addBatchUnit: (data: UnitAdd[]) => apiPost<Response<UnitAdd[]>>('/api/units/batch', data),

    getAllCategories: (filter?: FilterData[]) =>
      apiGet<Response<Category[]>>('/api/categories', filter?.length ? { filter: JSON.stringify(filter) } : undefined),
    addCategory: (data: CategoryAdd) => apiPost<Response<Category>>('/api/categories', data),
    updateCategory: (data: CategoryUpdate) => apiPut<Response<CategoryUpdate>>('/api/categories', data),
    deleteCategory: (id: number) => apiDelete<Response<unknown>>(`/api/categories/${id}`),
    addBatchCategory: (data: CategoryAdd[]) => apiPost<Response<CategoryAdd[]>>('/api/categories/batch', data),

    getAllCurrencies: (filter?: FilterData[]) =>
      apiGet<Response<Currency[]>>('/api/currencies', filter?.length ? { filter: JSON.stringify(filter) } : undefined),
    addCurrency: (data: CurrencyAdd) => apiPost<Response<Currency>>('/api/currencies', data),
    updateCurrency: (data: CurrencyUpdate) => apiPut<Response<CurrencyUpdate>>('/api/currencies', data),
    deleteCurrency: (id: number) => apiDelete<Response<unknown>>(`/api/currencies/${id}`),
    addBatchCurrency: (data: CurrencyAdd[]) => apiPost<Response<CurrencyAdd[]>>('/api/currencies/batch', data),

    getAllInvoices: (type?: InvoiceType, filter?: FilterData[]) => {
      const params: Record<string, string> = {};
      if (type) params.type = type;
      if (filter?.length) params.filter = JSON.stringify(filter);
      return apiGet<Response<Invoice[]>>('/api/invoices', Object.keys(params).length ? params : undefined);
    },
    addInvoice: (data: InvoiceAdd) => apiPost<Response<Invoice>>('/api/invoices', data),
    updateInvoice: (data: InvoiceUpdate) => apiPut<Response<InvoiceUpdate>>('/api/invoices', data),
    deleteInvoice: (id: number) => apiDelete<Response<unknown>>(`/api/invoices/${id}`),
    duplicateInvoice: (id: number, invoiceType: InvoiceType) =>
      apiPost<Response<Invoice>>('/api/invoices/duplicate', { invoiceId: id, invoiceType }),

    //TODO
    exportAllData: async (): Promise<Response<ExportMeta>> => {
      const result = await apiGet<{ success: boolean; data?: unknown }>('/api/export');
      if (!result.success || !result.data) return result as Response<ExportMeta>;
      const blob = new Blob([JSON.stringify(result.data, null, 2)], { type: 'application/json' });
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = `invoice-builder-backup-${new Date().toISOString().slice(0, 10)}.json`;
      a.click();
      URL.revokeObjectURL(a.href);
      return { success: true, data: { filePath: a.download } };
    },

    importAllData: (): Promise<Response<unknown>> => {
      return new Promise(resolve => {
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = '.json,application/json';
        input.onchange = async () => {
          const file = input.files?.[0];
          if (!file) {
            resolve({ success: false, message: 'canceled' });
            return;
          }
          const text = await file.text();
          let parsed: unknown;
          try {
            parsed = JSON.parse(text);
          } catch {
            resolve({ success: false, key: 'invalidFile' });
            return;
          }
          const result = await apiPost<Response<unknown>>('/api/import', parsed);
          resolve(result);
        };
        input.click();
      });
    }
  };
};

export type Api = ReturnType<typeof webApi>;
