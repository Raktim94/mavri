import type { Database } from 'sqlite3';

import type { SqliteValue } from '../types/sqliteValue';
import { getAllRows, getFirstRow, runDb, toSqliteValue } from '../utils/dbFuntions';
import { mapSqliteError } from '../utils/errorFunctions';

export const exportAllData = async (db: Database) => {
  try {
    const styleProfiles = await getAllRows(db, 'SELECT * FROM style_profiles');
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

    const attachmentsModified = attachments.map((a: Record<string, unknown>) => {
      const buf = a.data as Buffer | null;
      return { ...a, data: buf ? buf.toString('base64') : null };
    });
    const businessesModified = businesses.map((b: Record<string, unknown>) => {
      const buf = b.logo as Buffer | null;
      return { ...b, logo: buf ? buf.toString('base64') : null };
    });
    const styleProfilesModified = styleProfiles.map((sp: Record<string, unknown>) => {
      const bufWatermarPaid = sp.customizationPaidWatermarkFileData as Buffer | null;
      const bufWatermark = sp.customizationWatermarkFileData as Buffer | null;
      return {
        ...sp,
        customizationPaidWatermarkFileData: bufWatermarPaid ? bufWatermarPaid.toString('base64') : null,
        customizationWatermarkFileData: bufWatermark ? bufWatermark.toString('base64') : null
      };
    });
    const invoicesModified = invoices.map((i: Record<string, unknown>) => {
      const bufLogo = i.businessLogoSnapshot as Buffer | null;
      const bufWatermarPaid = i.customizationPaidWatermarkFileData as Buffer | null;
      const bufWatermark = i.customizationWatermarkFileData as Buffer | null;
      const bufSignature = i.signatureData as Buffer | null;
      return {
        ...i,
        signatureData: bufSignature ? bufSignature.toString('base64') : null,
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
      styleProfiles: styleProfilesModified,
      invoiceItems,
      invoicePayments,
      attachments: attachmentsModified
    };

    return { success: true, data: payload };
  } catch (error) {
    return { success: false, ...mapSqliteError(error) };
  }
};

export const importAllData = async (db: Database, parsed: Record<string, unknown>) => {
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
      await runDb(db, `UPDATE settings SET ${fields.join(', ')} WHERE id = (SELECT id FROM settings LIMIT 1)`, params);
    }
  };

  try {
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
        'currencies',
        'style_profiles'
      ];

      for (const table of deleteOrder) {
        await runDb(db, `DELETE FROM ${table}`);
      }

      const tableDataMap: Record<string, string> = {
        currencies: 'currencies',
        units: 'units',
        categories: 'categories',
        businesses: 'businesses',
        style_profiles: 'styleProfiles',
        clients: 'clients',
        items: 'items',
        invoices: 'invoices',
        invoice_items: 'invoiceItems',
        invoice_payments: 'invoicePayments',
        attachments: 'attachments'
      };

      const parsedMut = { ...parsed };

      if (Array.isArray(parsedMut.attachments)) {
        parsedMut.attachments = parsedMut.attachments.map((a: Record<string, unknown>) => ({
          ...a,
          data: fromBase64(a.data)
        }));
      }
      if (Array.isArray(parsedMut.styleProfiles)) {
        parsedMut.styleProfiles = parsedMut.styleProfiles.map((sp: Record<string, unknown>) => ({
          ...sp,
          customizationPaidWatermarkFileData: fromBase64(sp.customizationPaidWatermarkFileData),
          customizationWatermarkFileData: fromBase64(sp.customizationWatermarkFileData)
        }));
      }
      if (Array.isArray(parsedMut.businesses)) {
        parsedMut.businesses = parsedMut.businesses.map((b: Record<string, unknown>) => ({
          ...b,
          logo: fromBase64(b.logo)
        }));
      }
      if (Array.isArray(parsedMut.invoices)) {
        parsedMut.invoices = parsedMut.invoices.map((i: Record<string, unknown>) => ({
          ...i,
          signatureData: fromBase64(i.signatureData),
          businessLogoSnapshot: fromBase64(i.businessLogoSnapshot),
          customizationPaidWatermarkFileData: fromBase64(i.customizationPaidWatermarkFileData),
          customizationWatermarkFileData: fromBase64(i.customizationWatermarkFileData)
        }));
      }

      for (const [table, key] of Object.entries(tableDataMap)) {
        await insertRows(table, ((parsedMut as Record<string, unknown>)[key] as Record<string, unknown>[]) ?? []);
      }

      if (parsedMut.settings && typeof parsedMut.settings === 'object') {
        await updateSettings(parsedMut.settings as Record<string, unknown>);
      }
    });

    return { success: true };
  } catch (error) {
    return { success: false, ...mapSqliteError(error) };
  }
};
