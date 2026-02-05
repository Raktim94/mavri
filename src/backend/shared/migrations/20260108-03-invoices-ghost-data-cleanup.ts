import { DatabaseType } from '../enums/databaseType';
import type { DatabaseAdapter } from '../types/DatabaseAdapter';
import { mapDatabaseError } from '../utils/errorFunctions';

export const up = async (db: DatabaseAdapter) => {
  try {
    if (db.type === DatabaseType.sqlite) {
      await db.run('PRAGMA foreign_keys = OFF;');
    }
    await db.run('BEGIN');

    await db.run('delete from invoice_items where "parentInvoiceId" not in (select "id" from invoices)');
    await db.run('delete from invoice_payments where "parentInvoiceId" not in (select "id" from invoices)');
    await db.run('delete from attachments where "parentInvoiceId" not in (select "id" from invoices)');

    await db.run('COMMIT');
    if (db.type === DatabaseType.sqlite) {
      await db.run('PRAGMA foreign_keys = ON;');
    }
  } catch (error) {
    try {
      await db.run('ROLLBACK');
    } catch {
      throw new Error(`ROLLBACK failed`);
    }
    if (db.type === DatabaseType.sqlite) {
      await db.run('PRAGMA foreign_keys = ON;');
    }
    return { success: false, ...mapDatabaseError(error, db.type) };
  }
};
