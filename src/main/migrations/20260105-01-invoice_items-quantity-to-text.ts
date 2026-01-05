import sqlite3 from 'sqlite3';
import { getFirstRow, runAsync } from '../utils/dbFuntions';
import { mapSqliteError } from '../utils/errorFunctions';

export const up = async (db: sqlite3.Database) => {
  try {
    const colInfo = await getFirstRow(
      db,
      `
        SELECT *
        FROM pragma_table_info('invoice_items')
        WHERE name = 'quantity'
      `
    );

    if (!colInfo) return;

    await runAsync(db, 'PRAGMA foreign_keys = OFF;');
    await runAsync(db, 'BEGIN TRANSACTION;');
    await runAsync(db, 'DROP TABLE IF EXISTS invoice_items_new;');

    await runAsync(
      db,
      `
      CREATE TABLE invoice_items_new (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        parentInvoiceId INTEGER NOT NULL,
        itemId INTEGER NOT NULL,
        itemNameSnapshot TEXT NOT NULL,
        unitPriceCentsSnapshot INTEGER NOT NULL DEFAULT (0),
        unitNameSnapshot TEXT,
        quantity TEXT NOT NULL DEFAULT '0',
        taxRate REAL NOT NULL DEFAULT 0,
        taxType TEXT CHECK(taxType IN ('exclusive','inclusive') OR taxType IS NULL),
        createdAt DATETIME NOT NULL DEFAULT (datetime('now')),
        updatedAt DATETIME NOT NULL DEFAULT (datetime('now')),
        FOREIGN KEY (parentInvoiceId) REFERENCES invoices(id) ON DELETE CASCADE,
        FOREIGN KEY (itemId) REFERENCES items(id)
      );
    `
    );

    await runAsync(
      db,
      `
      INSERT INTO invoice_items_new (id, parentInvoiceId, itemId, itemNameSnapshot, unitPriceCentsSnapshot, unitNameSnapshot, quantity, taxRate, taxType, createdAt, updatedAt)
      SELECT id, parentInvoiceId, itemId, itemNameSnapshot, unitPriceCentsSnapshot, unitNameSnapshot, CAST(quantity AS TEXT), taxRate, taxType, createdAt, updatedAt
      FROM invoice_items;
    `
    );

    await runAsync(db, 'DROP TABLE invoice_items;');
    await runAsync(db, 'ALTER TABLE invoice_items_new RENAME TO invoice_items;');

    await runAsync(db, `CREATE INDEX IF NOT EXISTS idx_invoice_items_invoiceId ON invoice_items(parentInvoiceId)`);
    await runAsync(db, `CREATE INDEX IF NOT EXISTS idx_invoice_items_itemId ON invoice_items(itemId)`);

    await runAsync(db, 'COMMIT;');
    await runAsync(db, 'PRAGMA foreign_keys = ON;');
  } catch (error) {
    await runAsync(db, 'ROLLBACK;');
    return { success: false, ...mapSqliteError(error) };
  }
};
