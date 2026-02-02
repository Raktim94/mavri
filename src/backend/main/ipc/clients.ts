import { ipcMain } from 'electron';
import type { Database } from 'sqlite3';
import * as clientsService from '../../shared/services/clients';
import type { Client } from '../../shared/types/client';

export const initClientsHandlers = (db: Database) => {
  ipcMain.handle('add-client', async (_e, data: Client) => clientsService.addClient(db, data));
  ipcMain.handle('update-client', async (_e, data: Client) => clientsService.updateClient(db, data));
  ipcMain.handle('delete-client', async (_e, id: number) => clientsService.deleteClient(db, id));
  ipcMain.handle('batch-add-client', async (_e, data: Client[]) => clientsService.batchAddClient(db, data));
  ipcMain.handle('get-all-clients', async (_e, filter) => clientsService.getAllClients(db, filter));
};
