import { DatabaseType } from '../enums/databaseType';
import type { DatabaseAdapter } from '../types/DatabaseAdapter';
import { getColumnType, getTableColumns } from '../utils/dbHelper';
import { mapDatabaseError } from '../utils/errorFunctions';

export const up = async (db: DatabaseAdapter) => {
  try {
    const cols = await getTableColumns(db, 'invoices');
    const colInfo = cols.find(c => c.name === 'signatureData');

    if (colInfo) {
      return;
    }

    if (db.type === DatabaseType.sqlite) {
      await db.run('PRAGMA foreign_keys = OFF;');
    }

    await db.run(`
      ALTER TABLE invoices ADD COLUMN "signatureData" ${getColumnType('BLOB', db.type)};
    `);
    await db.run(`ALTER TABLE invoices ADD COLUMN "signatureName" TEXT;`);
    await db.run(`ALTER TABLE invoices ADD COLUMN "signatureType" TEXT;`);
    await db.run(`ALTER TABLE invoices ADD COLUMN "signatureSize" INTEGER;`);

    if (db.type === DatabaseType.sqlite) {
      await db.run('PRAGMA foreign_keys = ON;');
    }
  } catch (error) {
    if (db.type === DatabaseType.sqlite) {
      await db.run('PRAGMA foreign_keys = ON;');
    }
    return { success: false, ...mapDatabaseError(error, db.type) };
  }
};
