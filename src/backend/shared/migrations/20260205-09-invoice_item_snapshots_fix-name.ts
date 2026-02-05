import { DatabaseType } from '../enums/databaseType';
import type { DatabaseAdapter } from '../types/DatabaseAdapter';
import { getColumnType, getDefaultValue, isTableExists } from '../utils/dbHelper';
import { mapDatabaseError } from '../utils/errorFunctions';

export const up = async (db: DatabaseAdapter) => {
  try {
    const isExisting = await isTableExists(db, 'invoice_item_snapshots');
    if (isExisting) return;

    if (db.type === DatabaseType.sqlite) {
      await db.run('PRAGMA foreign_keys = OFF;');
    }

    await db.run('DROP TABLE IF EXISTS invoice_item_snapshots;');

    await db.run(
      `
          CREATE TABLE IF NOT EXISTS invoice_item_snapshots (
            "id" ${getColumnType('INTEGER PRIMARY KEY AUTOINCREMENT', db.type)},
            "parentInvoiceItemId" INTEGER NOT NULL,
            "itemName" TEXT NOT NULL,
            "unitPriceCents" INTEGER NOT NULL DEFAULT 0,
            "unitName" TEXT,
            "createdAt" ${getColumnType('DATETIME', db.type)} NOT NULL DEFAULT ${getDefaultValue("(datetime('now'))", db.type)},
            "updatedAt" ${getColumnType('DATETIME', db.type)} NOT NULL DEFAULT ${getDefaultValue("(datetime('now'))", db.type)},
            FOREIGN KEY("parentInvoiceItemId") REFERENCES invoice_items("id") ON DELETE CASCADE
          );
        `
    );

    await db.run(`
      INSERT INTO invoice_item_snapshots (
          "id",
          "parentInvoiceItemId",
          "itemName",
          "unitPriceCents",
          "unitName",
          "createdAt",
          "updatedAt"
      )
      SELECT
          "id",
          "parentInvoiceItemId",
          "itemName",
          "unitPriceCents",
          "unitName",
          "createdAt",
          "updatedAt"
      FROM invoice_item_snaphots;
    `);

    await db.run('DROP TABLE invoice_item_snaphots;');

    await db.run(
      `CREATE INDEX IF NOT EXISTS idx_invoice_item_snapshots_parentInvoiceItemId ON invoice_item_snapshots("parentInvoiceItemId")`
    );
    await db.run(
      `CREATE INDEX IF NOT EXISTS idx_invoice_item_snapshots_itemName ON invoice_item_snapshots("itemName")`
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
