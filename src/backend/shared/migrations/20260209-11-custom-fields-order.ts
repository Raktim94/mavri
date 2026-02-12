import { DatabaseType } from '../enums/databaseType';
import type { DatabaseAdapter } from '../types/DatabaseAdapter';
import { mapDatabaseError } from '../utils/errorFunctions';

export const up = async (db: DatabaseAdapter) => {
  try {
    if (db.type === DatabaseType.sqlite) {
      await db.run(`      
        UPDATE invoice_items
        SET "customField" = json_set("customField", '$.sortOrder', 0)
        WHERE json_extract("customField", '$.sortOrder') IS NULL;
      `);
    }
    if (db.type === DatabaseType.postgre) {
      await db.run(`
        UPDATE invoice_items
        SET "customField" = (
          "customField"::jsonb || '{"sortOrder":0}'
        )::text
        WHERE jsonb_exists("customField"::jsonb, 'sortOrder') = false;
      `);
    }

    await db.run(
      `
        ALTER TABLE style_profiles
        ADD COLUMN IF NOT EXISTS "fieldSortOrders" TEXT NOT NULL DEFAULT '{"no":0,"item":1,"unit":2,"quantity":3,"unitCost":4,"total":5}';
      `
    );
    await db.run(
      `
        ALTER TABLE invoice_customizations
        ADD COLUMN IF NOT EXISTS "fieldSortOrders" TEXT NOT NULL DEFAULT '{"no":0,"item":1,"unit":2,"quantity":3,"unitCost":4,"total":5}';
      `
    );
    return { success: true };
  } catch (error) {
    return { success: false, ...mapDatabaseError(error, db.type) };
  }
};
