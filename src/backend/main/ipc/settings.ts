import { ipcMain } from 'electron';
import * as settingsService from '../../shared/services/settings';
import type { DatabaseAdapter } from '../../shared/types/DatabaseAdapter';

export const initSettingsHandlers = (db: DatabaseAdapter) => {
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
