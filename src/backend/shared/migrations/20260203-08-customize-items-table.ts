import sqlite3 from 'sqlite3';
import { getFirstRow, runAsync } from '../utils/dbFuntions';
import { mapSqliteError } from '../utils/errorFunctions';

export const up = async (db: sqlite3.Database) => {
  try {
    const colInfo = await getFirstRow(
      db,
      `
        SELECT *
        FROM pragma_table_info('invoice_customizations')
        WHERE name = 'showRowNo'
      `
    );

    if (colInfo) return;

    await runAsync(db, 'PRAGMA foreign_keys = OFF;');
    await runAsync(db, 'BEGIN TRANSACTION;');

    await runAsync(
      db,
      `
        ALTER TABLE style_profiles
        ADD COLUMN showQuantity INTEGER NOT NULL DEFAULT 1 CHECK (showQuantity IN (0,1))
      `
    );
    await runAsync(
      db,
      `
        ALTER TABLE style_profiles
        ADD COLUMN showUnit INTEGER NOT NULL DEFAULT 1 CHECK (showUnit IN (0,1))
      `
    );
    await runAsync(
      db,
      `
        ALTER TABLE style_profiles
        ADD COLUMN showRowNo INTEGER NOT NULL DEFAULT 1 CHECK (showRowNo IN (0,1))
      `
    );
    await runAsync(
      db,
      `
        ALTER TABLE invoice_customizations
        ADD COLUMN showQuantity INTEGER NOT NULL DEFAULT 1 CHECK (showQuantity IN (0,1))
      `
    );
    await runAsync(
      db,
      `
        ALTER TABLE invoice_customizations
        ADD COLUMN showUnit INTEGER NOT NULL DEFAULT 1 CHECK (showUnit IN (0,1))
      `
    );
    await runAsync(
      db,
      `
        ALTER TABLE invoice_customizations
        ADD COLUMN showRowNo INTEGER NOT NULL DEFAULT 1 CHECK (showRowNo IN (0,1))
      `
    );
    await runAsync(
      db,
      `
        ALTER TABLE invoice_items
        ADD COLUMN customField TEXT;
      `
    );

    await runAsync(db, 'COMMIT;');
    await runAsync(db, 'PRAGMA foreign_keys = ON;');
  } catch (error) {
    await runAsync(db, 'ROLLBACK;');
    await runAsync(db, 'PRAGMA foreign_keys = ON;');
    return { success: false, ...mapSqliteError(error) };
  }
};
