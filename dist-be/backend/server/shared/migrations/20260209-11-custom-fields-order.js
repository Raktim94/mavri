"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.up = void 0;
const databaseType_1 = require("../enums/databaseType");
const dbHelper_1 = require("../utils/dbHelper");
const errorFunctions_1 = require("../utils/errorFunctions");
const up = async (db) => {
    try {
        const cols = await (0, dbHelper_1.getTableColumns)(db, 'style_profiles');
        const colInfo = cols.find(c => c.name === 'fieldSortOrders');
        if (colInfo)
            return;
        if (db.type === databaseType_1.DatabaseType.sqlite) {
            await db.run(`      
        UPDATE invoice_items
        SET "customField" = json_set("customField", '$.sortOrder', 0)
        WHERE json_extract("customField", '$.sortOrder') IS NULL;
      `);
        }
        if (db.type === databaseType_1.DatabaseType.postgre) {
            await db.run(`
        UPDATE invoice_items
        SET "customField" = (
          "customField"::jsonb || '{"sortOrder":0}'
        )::text
        WHERE jsonb_exists("customField"::jsonb, 'sortOrder') = false;
      `);
        }
        await db.run(`
        ALTER TABLE style_profiles
        ADD COLUMN "fieldSortOrders" TEXT NOT NULL DEFAULT '{"no":0,"item":1,"unit":2,"quantity":3,"unitCost":4,"total":5}';
      `);
        await db.run(`
        ALTER TABLE invoice_customizations
        ADD COLUMN "fieldSortOrders" TEXT NOT NULL DEFAULT '{"no":0,"item":1,"unit":2,"quantity":3,"unitCost":4,"total":5}';
      `);
        return { success: true };
    }
    catch (error) {
        return { success: false, ...(0, errorFunctions_1.mapDatabaseError)(error, db.type) };
    }
};
exports.up = up;
