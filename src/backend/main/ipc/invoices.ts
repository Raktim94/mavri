import { ipcMain } from 'electron';
import * as invoicesService from '../../shared/services/invoices';
import type { DatabaseAdapter } from '../../shared/types/DatabaseAdapter';
import type { Invoice } from '../../shared/types/invoice';

export const initInvoicesHandlers = (db: DatabaseAdapter) => {
  ipcMain.handle('get-custom-headers', async (_event, type) => invoicesService.getCustomHeaders(db, type));
  ipcMain.handle('get-all-invoices', async (_event, type, filter) => invoicesService.getAllInvoices(db, type, filter));
  ipcMain.handle('delete-invoice', async (_event, id: number) => invoicesService.deleteInvoice(db, id));
  ipcMain.handle('add-invoice', async (_event, data: Invoice) => invoicesService.addInvoice(db, data));
  ipcMain.handle('update-invoice', async (_event, data: Invoice) => invoicesService.updateInvoice(db, data));
  ipcMain.handle('duplicate-invoice', async (_event, invoiceId: number, invoiceType: 'quotation' | 'invoice') =>
    invoicesService.duplicateInvoice(db, invoiceId, invoiceType)
  );
};
