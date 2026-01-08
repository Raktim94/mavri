import { dialog, ipcMain } from 'electron';
import { promises as fs } from 'fs';
import { join } from 'path';
import type { Database } from 'sqlite3';
import type { SqliteValue } from '../types/sqliteValue';
import { getAllRows, getFirstRow, runDb, toSqliteValue } from '../utils/dbFuntions';
import { mapSqliteError } from '../utils/errorFunctions';

export const initImportExportHandlers = (db: Database) => {
  ipcMain.handle('export-all-data', async () => {
    try {
      const settingsRow = await getFirstRow(db, 'SELECT * FROM settings LIMIT 1');
      const businesses = await getAllRows(db, 'SELECT * FROM businesses');
      const clients = await getAllRows(db, 'SELECT * FROM clients');
      const items = await getAllRows(db, 'SELECT * FROM items');
      const units = await getAllRows(db, 'SELECT * FROM units');
      const categories = await getAllRows(db, 'SELECT * FROM categories');
      const currencies = await getAllRows(db, 'SELECT * FROM currencies');
      const invoices = await getAllRows(db, 'SELECT * FROM invoices');
      const invoiceItems = await getAllRows(db, 'SELECT * FROM invoice_items');
      const invoicePayments = await getAllRows(db, 'SELECT * FROM invoice_payments');
      const attachments = await getAllRows(db, 'SELECT * FROM attachments');

      const attachmentsModified = attachments.map(a => {
        const buf = a.data as unknown as Buffer | null;

        return {
          ...a,
          data: buf ? buf.toString('base64') : null
        };
      });
      const businessesModified = businesses.map(b => {
        const buf = b.logo as unknown as Buffer | null;

        return {
          ...b,
          logo: buf ? buf.toString('base64') : null
        };
      });
      const invoicesModified = invoices.map(i => {
        const bufLogo = i.businessLogoSnapshot as unknown as Buffer | null;
        const bufWatermarPaid = i.customizationPaidWatermarkFileData as unknown as Buffer | null;
        const bufWatermark = i.customizationWatermarkFileData as unknown as Buffer | null;

        return {
          ...i,
          businessLogoSnapshot: bufLogo ? bufLogo.toString('base64') : null,
          customizationPaidWatermarkFileData: bufWatermarPaid ? bufWatermarPaid.toString('base64') : null,
          customizationWatermarkFileData: bufWatermark ? bufWatermark.toString('base64') : null
        };
      });

      const payload = {
        settings: settingsRow ?? null,
        businesses: businessesModified,
        clients,
        items,
        units,
        categories,
        currencies,
        invoices: invoicesModified,
        invoiceItems,
        invoicePayments,
        attachments: attachmentsModified
      };

      const defaultFileName = `invoice-builder-backup-${new Date().toISOString().slice(0, 10)}.json`;
      const result = await dialog.showSaveDialog({
        title: 'Export',
        defaultPath: join(process.env.USERPROFILE || process.cwd(), defaultFileName),
        filters: [{ name: 'JSON', extensions: ['json'] }]
      });

      if (result.canceled || !result.filePath) return { success: false };

      await fs.writeFile(result.filePath, JSON.stringify(payload, null, 2), 'utf8');

      return { success: true, data: { filePath: result.filePath } };
    } catch (error) {
      return { success: false, ...mapSqliteError(error) };
    }
  });

  ipcMain.handle('import-all-data', async () => {
    const fromBase64 = (value: unknown): Buffer | null => {
      if (!value || typeof value !== 'string') return null;
      try {
        return Buffer.from(value, 'base64');
      } catch {
        return null;
      }
    };

    const runInTransaction = async (fn: () => Promise<void>) => {
      try {
        await runDb(db, 'PRAGMA foreign_keys = OFF');
        await runDb(db, 'BEGIN TRANSACTION');
        await fn();
        await runDb(db, 'COMMIT');
      } catch (err) {
        await runDb(db, 'ROLLBACK');
        throw err;
      } finally {
        await runDb(db, 'PRAGMA foreign_keys = ON');
      }
    };

    const insertRows = async <T extends Record<string, unknown>>(table: string, rows: T[]) => {
      for (const row of rows) {
        const keys = Object.keys(row).filter(k => k !== 'invoiceFullNumber');
        if (!keys.length) continue;
        const cols = keys.join(',');
        const placeholders = keys.map(() => '?').join(',');
        const params = keys.map(k => toSqliteValue(row[k]));
        await runDb(db, `INSERT INTO ${table} (${cols}) VALUES (${placeholders})`, params);
      }
    };

    const updateSettings = async (settings: Record<string, unknown>) => {
      const fields: string[] = [];
      const params: SqliteValue[] = [];

      Object.entries(settings).forEach(([k, v]) => {
        if (k === 'id') return;
        fields.push(`${k} = ?`);
        params.push(toSqliteValue(v));
      });

      if (fields.length) {
        await runDb(
          db,
          `UPDATE settings SET ${fields.join(', ')} WHERE id = (SELECT id FROM settings LIMIT 1)`,
          params
        );
      }
    };

    try {
      const { canceled, filePaths } = await dialog.showOpenDialog({
        title: 'Import',
        properties: ['openFile'],
        filters: [{ name: 'JSON', extensions: ['json'] }]
      });

      if (canceled || !filePaths?.[0]) return { success: false, message: 'canceled' };

      const content = await fs.readFile(filePaths[0], 'utf8');
      const parsed = JSON.parse(content);
      if (!parsed || typeof parsed !== 'object') return { success: false, key: 'invalidFile' };

      await runInTransaction(async () => {
        const deleteOrder = [
          'invoice_items',
          'invoice_payments',
          'attachments',
          'invoices',
          'items',
          'businesses',
          'clients',
          'units',
          'categories',
          'currencies'
        ];

        for (const table of deleteOrder) {
          await runDb(db, `DELETE FROM ${table}`);
        }

        const tableDataMap: Record<string, string> = {
          currencies: 'currencies',
          units: 'units',
          categories: 'categories',
          businesses: 'businesses',
          clients: 'clients',
          items: 'items',
          invoices: 'invoices',
          invoice_items: 'invoiceItems',
          invoice_payments: 'invoicePayments',
          attachments: 'attachments'
        };

        if (Array.isArray(parsed.attachments)) {
          parsed.attachments = parsed.attachments.map((a: Record<string, unknown>) => ({
            ...a,
            data: fromBase64(a.data)
          }));
        }
        if (Array.isArray(parsed.businesses)) {
          parsed.businesses = parsed.businesses.map((b: Record<string, unknown>) => ({
            ...b,
            logo: fromBase64(b.logo)
          }));
        }
        if (Array.isArray(parsed.invoices)) {
          parsed.invoices = parsed.invoices.map((i: Record<string, unknown>) => ({
            ...i,
            businessLogoSnapshot: fromBase64(i.businessLogoSnapshot),
            customizationPaidWatermarkFileData: fromBase64(i.customizationPaidWatermarkFileData),
            customizationWatermarkFileData: fromBase64(i.customizationWatermarkFileData)
          }));
        }

        for (const [table, key] of Object.entries(tableDataMap)) {
          await insertRows(table, ((parsed as Record<string, unknown>)[key] as Record<string, unknown>[]) ?? []);
        }

        if (parsed.settings && typeof parsed.settings === 'object') {
          await updateSettings(parsed.settings as Record<string, unknown>);
        }
      });

      return { success: true };
    } catch (error) {
      return { success: false, ...mapSqliteError(error) };
    }
  });
};
