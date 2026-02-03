import type { Database } from 'sqlite3';

import type { Business } from '../types/business';
import type { Category } from '../types/category';
import type { Client } from '../types/client';
import type { Currency } from '../types/currency';
import type {
  Invoice,
  InvoiceAttachment,
  InvoiceBusinessSnapshots,
  InvoiceClientSnapshots,
  InvoiceCurrencySnapshots,
  InvoiceCustomization,
  InvoiceItem,
  InvoiceItemSnapshots,
  InvoicePayment,
  InvoiceStyleProfileSnapshots
} from '../types/invoice';
import type { Item } from '../types/item';
import type { SqliteValue } from '../types/sqliteValue';
import type { StyleProfile } from '../types/styleProfiles';
import type { Unit } from '../types/unit';
import {
  decodeInvoiceAttachment,
  decodeInvoiceBusinessSnapshotImport,
  decodeInvoiceCustomizationImport,
  decodeInvoiceImport,
  decodeLogo,
  decodeStyleProfile,
  encodeInvoiceAttachment,
  encodeInvoiceBusinessSnapshotExport,
  encodeInvoiceCustomizationExport,
  encodeInvoiceExport,
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
    const invoiceBusinessSnapshots = await getAllRows<InvoiceBusinessSnapshots>(
      db,
      'SELECT * FROM invoice_business_snapshots'
    );
    const invoiceClientSnapshots = await getAllRows<InvoiceClientSnapshots>(
      db,
      'SELECT * FROM invoice_client_snapshots'
    );
    const invoiceCurrencySnapshots = await getAllRows<InvoiceCurrencySnapshots>(
      db,
      'SELECT * FROM invoice_currency_snapshots'
    );
    const invoiceStyleProfileSnapshots = await getAllRows<InvoiceStyleProfileSnapshots>(
      db,
      'SELECT * FROM invoice_style_profile_snapshots'
    );
    const invoiceItemSnapshots = await getAllRows<InvoiceItemSnapshots>(db, 'SELECT * FROM invoice_item_snaphots');
    const invoiceCustomizations = await getAllRows<InvoiceCustomization>(db, 'SELECT * FROM invoice_customizations');
    const invoiceItems = await getAllRows<InvoiceItem>(db, 'SELECT * FROM invoice_items');
    const invoicePayments = await getAllRows<InvoicePayment>(db, 'SELECT * FROM invoice_payments');
    const attachments = await getAllRows<InvoiceAttachment>(db, 'SELECT * FROM attachments');

    const attachmentsModified = attachments.map(encodeInvoiceAttachment);
    const businessesModified = businesses.map(encodeLogo);
    const styleProfilesModified = styleProfiles.map(encodeStyleProfile);
    const invoicesModified = invoices.map(encodeInvoiceExport);
    const invoiceBusinessSnapshotsModified = invoiceBusinessSnapshots.map(encodeInvoiceBusinessSnapshotExport);
    const invoiceCustomizationsModified = invoiceCustomizations.map(encodeInvoiceCustomizationExport);

    const payload = {
      settings: settingsRow ?? null,
      businesses: businessesModified,
      clients,
      items,
      units,
      categories,
      currencies,
      invoices: invoicesModified,
      invoiceBusinessSnapshots: invoiceBusinessSnapshotsModified,
      invoiceCustomizations: invoiceCustomizationsModified,
      invoiceClientSnapshots,
      invoiceCurrencySnapshots,
      invoiceStyleProfileSnapshots,
      styleProfiles: styleProfilesModified,
      invoiceItems,
      invoiceItemSnapshots,
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
        'invoice_style_profile_snapshots',
        'invoice_customizations',
        'invoice_currency_snapshots',
        'invoice_client_snapshots',
        'invoice_business_snapshots',
        'invoice_items',
        'invoice_item_snaphots',
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
        invoice_style_profile_snapshots: 'invoiceStyleProfileSnapshots',
        invoice_business_snapshots: 'invoiceBusinessSnapshots',
        invoice_customizations: 'invoiceCustomizations',
        invoice_client_snapshots: 'invoiceClientSnapshots',
        invoice_currency_snapshots: 'invoiceCurrencySnapshots',
        invoice_items: 'invoiceItems',
        invoice_item_snaphots: 'invoiceItemSnapshots',
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
        parsedMut.invoices = parsedMut.invoices.map(decodeInvoiceImport);
      }
      if (Array.isArray(parsedMut.invoiceBusinessSnapshots)) {
        parsedMut.invoiceBusinessSnapshots = parsedMut.invoiceBusinessSnapshots.map(
          decodeInvoiceBusinessSnapshotImport
        );
      }
      if (Array.isArray(parsedMut.invoiceCustomizations)) {
        parsedMut.invoiceCustomizations = parsedMut.invoiceCustomizations.map(decodeInvoiceCustomizationImport);
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
