import type { Settings, SettingsUpdate } from '../types/settings';
import type { DBInitType } from './../enums/dbInitType';
import type { InvoiceType } from './../enums/invoiceType';
import type { Business, BusinessAdd, BusinessUpdate } from './business';
import type { Category, CategoryAdd, CategoryUpdate } from './category';
import type { Client, ClientAdd, ClientUpdate } from './client';
import type { Currency, CurrencyAdd, CurrencyUpdate } from './currency';
import type { DBSelector } from './dbSelector';
import type { ExportMeta } from './exportMeta';
import type { FilterData } from './filter';
import type { Invoice, InvoiceAdd, InvoiceUpdate } from './invoice';
import type { Item, ItemAdd, ItemUpdate } from './item';
import type { Response } from './response';
import type { Unit, UnitAdd, UnitUpdate } from './unit';
import type { ProgressInfo } from './updater';

declare global {
  interface Window {
    electronAPI: {
      ping: () => void;

      getAppVersion: () => Promise<string>;

      checkForUpdates: () => Promise<void>;
      restartApp: () => void;
      onUpdateProgress: (callback: (data: ProgressInfo) => void) => () => void;
      onUpdateAvailable: (callback: () => void) => () => void;
      onUpdateNotAvailable: (callback: () => void) => () => void;
      onUpdateDownloaded: (callback: (version: string) => void) => () => void;

      openUrl: (url: string) => Promise<void>;
      selectDatabase: () => Promise<Response<DBSelector>>;
      openDatabase: () => Promise<Response<DBSelector>>;
      initializeDatabase: (data: { fullPath: string; mode?: DBInitType }) => Promise<Response<unknown>>;

      getAllSettings: () => Promise<Response<Settings>>;
      updateSettings: (data: SettingsUpdate) => Promise<Response<SettingsUpdate>>;

      getAllBusinesses: (filter?: FilterData[]) => Promise<Response<Business[]>>;
      updateBusiness: (data: BusinessUpdate) => Promise<Response<BusinessUpdate>>;
      deleteBusiness: (id: number) => Promise<Response<unknown>>;
      addBusiness: (data: BusinessAdd) => Promise<Response<BusinessAdd>>;
      addBatchBusiness: (data: BusinessAdd[]) => Promise<Response<BusinessAdd[]>>;

      getAllClients: (filter?: FilterData[]) => Promise<Response<Client[]>>;
      updateClient: (data: ClientUpdate) => Promise<Response<ClientUpdate>>;
      deleteClient: (id: number) => Promise<Response<unknown>>;
      addClient: (data: ClientAdd) => Promise<Response<ClientAdd>>;
      addBatchClient: (data: ClientAdd[]) => Promise<Response<ClientAdd[]>>;

      getAllItems: (filter?: FilterData[]) => Promise<Response<Item[]>>;
      updateItem: (data: ItemUpdate) => Promise<Response<ItemUpdate>>;
      deleteItem: (id: number) => Promise<Response<unknown>>;
      addItem: (data: ItemAdd) => Promise<Response<ItemAdd>>;
      addBatchItem: (data: ItemAdd[]) => Promise<Response<ItemAdd[]>>;

      getAllUnits: (filter?: FilterData[]) => Promise<Response<Unit[]>>;
      updateUnit: (data: UnitUpdate) => Promise<Response<UnitUpdate>>;
      deleteUnit: (id: number) => Promise<Response<unknown>>;
      addUnit: (data: UnitAdd) => Promise<Response<UnitAdd>>;
      addBatchUnit: (data: UnitAdd[]) => Promise<Response<UnitAdd[]>>;

      getAllCategories: (filter?: FilterData[]) => Promise<Response<Category[]>>;
      updateCategory: (data: CategoryUpdate) => Promise<Response<CategoryUpdate>>;
      deleteCategory: (id: number) => Promise<Response<unknown>>;
      addCategory: (data: CategoryAdd) => Promise<Response<CategoryAdd>>;
      addBatchCategory: (data: CategoryAdd[]) => Promise<Response<CategoryAdd[]>>;

      getAllCurrencies: (filter?: FilterData[]) => Promise<Response<Currency[]>>;
      updateCurrency: (data: CurrencyUpdate) => Promise<Response<CurrencyUpdate>>;
      deleteCurrency: (id: number) => Promise<Response<unknown>>;
      addCurrency: (data: CurrencyAdd) => Promise<Response<CurrencyAdd>>;
      addBatchCurrency: (data: CurrencyAdd[]) => Promise<Response<CurrencyAdd[]>>;

      getAllInvoices: (type?: InvoiceType, filter?: FilterData[]) => Promise<Response<Invoice[]>>;
      deleteInvoice: (id: number) => Promise<Response<unknown>>;
      addInvoice: (data: InvoiceAdd) => Promise<Response<InvoiceAdd>>;
      updateInvoice: (data: InvoiceUpdate) => Promise<Response<InvoiceUpdate>>;
      duplicateInvoice: (id: number, invoiceType: InvoiceType) => Promise<Response<unknown>>;

      exportAllData: () => Promise<Response<ExportMeta>>;
      importAllData: () => Promise<Response<unknown>>;
    };
  }
}

export {};
