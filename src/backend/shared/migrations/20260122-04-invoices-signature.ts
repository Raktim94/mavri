import sqlite3 from 'sqlite3';
import { getFirstRow, runAsync } from '../utils/dbFuntions';
import { mapSqliteError } from '../utils/errorFunctions';

export const up = async (db: sqlite3.Database) => {
  try {
    const colInfo = await getFirstRow(
      db,
      `
        SELECT *
        FROM pragma_table_info('invoices')
        WHERE name = 'signatureData'
      `
    );

    if (colInfo) return;

    await runAsync(db, 'PRAGMA foreign_keys = OFF;');
    await runAsync(db, 'BEGIN TRANSACTION;');

    await runAsync(
      db,
      `
      ALTER TABLE invoices
      ADD COLUMN signatureData BLOB;
    `
    );
    await runAsync(
      db,
      `
      ALTER TABLE invoices
      ADD COLUMN signatureName TEXT;
    `
    );

    await runAsync(
      db,
      `
      ALTER TABLE invoices
      ADD COLUMN signatureType TEXT;
    `
    );

    await runAsync(
      db,
      `
      ALTER TABLE invoices
      ADD COLUMN signatureSize INTEGER;`
    );

    await runAsync(db, 'COMMIT;');
    await runAsync(db, 'PRAGMA foreign_keys = ON;');
  } catch (error) {
    await runAsync(db, 'ROLLBACK;');
    await runAsync(db, 'PRAGMA foreign_keys = ON;');
    return { success: false, ...mapSqliteError(error) };
  }
};
