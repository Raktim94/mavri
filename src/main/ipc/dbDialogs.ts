import { BrowserWindow, dialog, ipcMain } from 'electron';
import { join } from 'path';
import { setupDB } from '../database';
import { DBInitType } from '../enums/dbInitType';
import { mapSqliteError } from '../utils/errorFunctions';

const resetIPCHandlers = () => {
  const handlers = [
    'open-url',
    'get-all-settings',
    'update-settings',
    'add-client',
    'update-client',
    'delete-client',
    'batch-add-client',
    'get-all-clients',
    'add-business',
    'update-business',
    'delete-business',
    'batch-add-business',
    'get-all-businesses',
    'add-item',
    'update-item',
    'delete-item',
    'batch-add-item',
    'get-all-items',
    'add-unit',
    'update-unit',
    'delete-unit',
    'batch-add-unit',
    'get-all-units',
    'add-category',
    'update-category',
    'delete-category',
    'batch-add-category',
    'get-all-categories',
    'add-currency',
    'update-currency',
    'delete-currency',
    'batch-add-currency',
    'get-all-currencies',
    'get-all-invoices',
    'delete-invoice',
    'update-invoice',
    'add-invoice',
    'duplicate-invoice',
    'export-all-data',
    'import-all-data',
    'restart-app',
    'get-app-version',
    'check-for-updates'
  ];

  handlers.forEach(handler => ipcMain.removeHandler(handler));
};

export const initDBDialogsHandlers = (dbName: string, mainWindow: BrowserWindow) => {
  ipcMain.handle('show-save-db-dialog', async () => {
    const defaultPath = join(process.env.USERPROFILE || process.cwd(), dbName);
    const result = await dialog.showSaveDialog({
      title: 'Select a path and database file name',
      defaultPath,
      filters: [{ name: 'SQLite DB', extensions: ['db'] }]
    });
    return { success: true, data: { canceled: result.canceled, filePath: result.filePath } };
  });
  ipcMain.handle('show-open-db-dialog', async () => {
    const defaultPath = join(process.env.USERPROFILE || process.cwd(), dbName);
    const result = await dialog.showOpenDialog({
      title: 'Open existing database file',
      defaultPath,
      filters: [{ name: 'SQLite DB', extensions: ['db'] }],
      properties: ['openFile']
    });
    return {
      success: true,
      data: {
        canceled: result.canceled,
        filePath: Array.isArray(result.filePaths) && result.filePaths.length ? result.filePaths[0] : undefined
      }
    };
  });
  ipcMain.handle('initialize-db', async (_event, opts: { fullPath: string; mode?: DBInitType }) => {
    try {
      resetIPCHandlers();
      const createIfMissing = opts.mode === DBInitType.create || typeof opts.mode === 'undefined';
      await setupDB({ fullPath: opts.fullPath, createIfMissing, mainWindow });
      return { success: true };
    } catch (error) {
      return { success: false, ...mapSqliteError(error) };
    }
  });
};
