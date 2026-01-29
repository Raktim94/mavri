import { ipcMain } from 'electron';
import type { Database } from 'sqlite3';
import * as settingsService from '../../shared/services/settings';

export const initSettingsHandlers = (db: Database) => {
  ipcMain.handle('get-all-settings', async () => settingsService.getAllSettings(db));
  ipcMain.handle(
    'update-settings',
    async (
      _event,
      data: {
        language?: string;
        amountFormat?: string;
        dateFormat?: string;
        isDarkMode?: boolean;
        invoicePrefix?: string;
        invoiceSuffix?: string;
        shouldIncludeYear?: boolean;
        shouldIncludeMonth?: boolean;
        shouldIncludeBusinessName?: boolean;
        quotesON?: boolean;
        styleProfilesON?: boolean;
        reportsON?: boolean;
      }
    ) => settingsService.updateSettings(db, data)
  );
};
