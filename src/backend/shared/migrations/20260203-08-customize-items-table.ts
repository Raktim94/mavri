import { DatabaseType } from '../enums/databaseType';
import type { DatabaseAdapter } from '../types/DatabaseAdapter';
import { getTableColumns } from '../utils/dbHelper';
import { mapDatabaseError } from '../utils/errorFunctions';

export const up = async (db: DatabaseAdapter) => {
  try {
    const cols = await getTableColumns(db, 'invoice_customizations');
    const colInfo = cols.find(c => c.name === 'showRowNo');
    if (colInfo) return;

    if (db.type === DatabaseType.sqlite) {
      await db.run('PRAGMA foreign_keys = OFF;');
    }

    await db.run(
      `
        ALTER TABLE style_profiles
        ADD COLUMN "showQuantity" INTEGER NOT NULL DEFAULT 1 CHECK ("showQuantity" IN (0,1))
      `
    );
    await db.run(
      `
        ALTER TABLE style_profiles
        ADD COLUMN "showUnit" INTEGER NOT NULL DEFAULT 1 CHECK ("showUnit" IN (0,1))
      `
    );
    await db.run(
      `
        ALTER TABLE style_profiles
        ADD COLUMN "showRowNo" INTEGER NOT NULL DEFAULT 1 CHECK ("showRowNo" IN (0,1))
      `
    );
    await db.run(
      `
        ALTER TABLE invoice_customizations
        ADD COLUMN "showQuantity" INTEGER NOT NULL DEFAULT 1 CHECK ("showQuantity" IN (0,1))
      `
    );
    await db.run(
      `
        ALTER TABLE invoice_customizations
        ADD COLUMN "showUnit" INTEGER NOT NULL DEFAULT 1 CHECK ("showUnit" IN (0,1))
      `
    );
    await db.run(
      `
        ALTER TABLE invoice_customizations
        ADD COLUMN "showRowNo" INTEGER NOT NULL DEFAULT 1 CHECK ("showRowNo" IN (0,1))
      `
    );
    await db.run(
      `
        ALTER TABLE invoice_items
        ADD COLUMN "customField" TEXT;
      `
    );

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
