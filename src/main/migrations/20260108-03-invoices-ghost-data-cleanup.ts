import sqlite3 from 'sqlite3';
import { runAsync } from '../utils/dbFuntions';
import { mapSqliteError } from '../utils/errorFunctions';

export const up = async (db: sqlite3.Database) => {
  try {
    await runAsync(db, 'PRAGMA foreign_keys = OFF;');
    await runAsync(db, 'BEGIN TRANSACTION;');

    await runAsync(db, 'delete from invoice_items where parentInvoiceId not in (select id from invoices)');
    await runAsync(db, 'delete from invoice_payments where parentInvoiceId not in (select id from invoices)');
    await runAsync(db, 'delete from attachments where parentInvoiceId not in (select id from invoices)');

    await runAsync(db, 'COMMIT;');
    await runAsync(db, 'PRAGMA foreign_keys = ON;');
  } catch (error) {
    await runAsync(db, 'ROLLBACK;');
    await runAsync(db, 'PRAGMA foreign_keys = ON;');
    return { success: false, ...mapSqliteError(error) };
  }
};
