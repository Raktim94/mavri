import type { Database } from 'sqlite3';

import type { Business } from '../types/business';
import type { Category } from '../types/category';
import type { Client } from '../types/client';
import type { Currency } from '../types/currency';
import type { Invoice, InvoiceAttachment, InvoiceItem, InvoicePayment } from '../types/invoice';
import type { Item } from '../types/item';
import type { SqliteValue } from '../types/sqliteValue';
import type { StyleProfile } from '../types/styleProfiles';
import type { Unit } from '../types/unit';
import {
  decodeInvoiceAttachment,
  decodeInvoiceWithouthAttachments,
  decodeLogo,
  decodeStyleProfile,
  encodeInvoiceAttachment,
  encodeInvoiceWithouthAttachments,
  encodeLogo,
  encodeStyleProfile
} from '../utils/dataUrlFunctions';
import { getAllRows, getFirstRow, runDb, toSqliteValue } from '../utils/dbFuntions';
import { mapSqliteError } from '../utils/errorFunctions';

export const exportAllData = async (db: Database) => {
  try {
    const styleProfiles = await getAllRows<StyleProfile>(db, 'SELECT * FROM style_profiles');
    const settingsRow = await getFirstRow(db, 'SELECT * FROM settings LIMIT 1');
    const businesses = await getAllRows<Business>(db, 'SELECT * FROM businesses');
    const clients = await getAllRows<Client>(db, 'SELECT * FROM clients');
    const items = await getAllRows<Item>(db, 'SELECT * FROM items');
    const units = await getAllRows<Unit>(db, 'SELECT * FROM units');
    const categories = await getAllRows<Category>(db, 'SELECT * FROM categories');
    const currencies = await getAllRows<Currency>(db, 'SELECT * FROM currencies');
    const invoices = await getAllRows<Invoice>(db, 'SELECT * FROM invoices');
    const invoiceItems = await getAllRows<InvoiceItem>(db, 'SELECT * FROM invoice_items');
    const invoicePayments = await getAllRows<InvoicePayment>(db, 'SELECT * FROM invoice_payments');
    const attachments = await getAllRows<InvoiceAttachment>(db, 'SELECT * FROM attachments');

    const attachmentsModified = attachments.map(encodeInvoiceAttachment);
    const businessesModified = businesses.map(encodeLogo);
    const styleProfilesModified = styleProfiles.map(encodeStyleProfile);
    const invoicesModified = invoices.map(encodeInvoiceWithouthAttachments);

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
        parsedMut.attachments = parsedMut.attachments.map(decodeInvoiceAttachment);
      }
      if (Array.isArray(parsedMut.styleProfiles)) {
        parsedMut.styleProfiles = parsedMut.styleProfiles.map(decodeStyleProfile);
      }
      if (Array.isArray(parsedMut.businesses)) {
        parsedMut.businesses = parsedMut.businesses.map(decodeLogo);
      }
      if (Array.isArray(parsedMut.invoices)) {
        parsedMut.invoices = parsedMut.invoices.map(decodeInvoiceWithouthAttachments);
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
