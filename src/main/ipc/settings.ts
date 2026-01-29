import { ipcMain } from 'electron';
import type { Database } from 'sqlite3';
import { getFirstRow, prepareUpdate, runDb } from '../utils/dbFuntions';
import { mapSqliteError } from '../utils/errorFunctions';

export const initSettingsHandlers = (db: Database) => {
  ipcMain.handle('get-all-settings', async () => {
    const row = await getFirstRow(db, 'SELECT * FROM settings LIMIT 1');
    if (!row) return null;
    return {
      success: true,
      data: row
    };
  });

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
    ) => {
      try {
        const { fields, params } = prepareUpdate(data);
        if (!fields.length) return { success: true };

        fields.push(`updatedAt = datetime('now')`);
        await runDb(
          db,
          `UPDATE settings SET ${fields.join(', ')} WHERE id = (SELECT id FROM settings LIMIT 1)`,
          params
        );
        return { success: true };
      } catch (error) {
        return { success: false, ...mapSqliteError(error) };
      }
    }
  );
};
