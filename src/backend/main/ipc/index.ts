import { BrowserWindow, ipcMain, shell } from 'electron';
import type { Database } from 'sqlite3';
import { initAutoUpdaterHandlers } from './autoUpdater';
import { initBusinessesHandlers } from './businesses';
import { initCategoriesHandlers } from './categories';
import { initClientsHandlers } from './clients';
import { initCurrenciesHandlers } from './currencies';
import { initImportExportHandlers } from './importExport';
import { initInvoicesHandlers } from './invoices';
import { initItemsHandlers } from './items';
import { initSettingsHandlers } from './settings';
import { initStyleProfilesHandlers } from './styleProfiles';
import { initUnitsHandlers } from './units';

export const initIpcHandler = (db: Database, path: string, mainWindow: BrowserWindow) => {
  if (!db) throw new Error('Database not initialized');
  if (!path) throw new Error('Database path not set');

  ipcMain.handle('open-url', async (_event, url: string) => {
    await shell.openExternal(url);
  });

  initAutoUpdaterHandlers(mainWindow);
  initBusinessesHandlers(db);
  initStyleProfilesHandlers(db);
  initCategoriesHandlers(db);
  initClientsHandlers(db);
  initCurrenciesHandlers(db);
  initImportExportHandlers(db);
  initInvoicesHandlers(db);
  initItemsHandlers(db);
  initSettingsHandlers(db);
  initUnitsHandlers(db);
};
