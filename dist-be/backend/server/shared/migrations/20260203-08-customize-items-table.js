"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.up = void 0;
const dbHelper_1 = require("../utils/dbHelper");
const errorFunctions_1 = require("../utils/errorFunctions");
const up = async (db) => {
    try {
        const cols = await (0, dbHelper_1.getTableColumns)(db, 'invoice_customizations');
        const colInfo = cols.find(c => c.name === 'showRowNo');
        if (colInfo)
            return;
        await db.run(`
        ALTER TABLE style_profiles
        ADD COLUMN "showQuantity" INTEGER NOT NULL DEFAULT 1 CHECK ("showQuantity" IN (0,1))
      `);
        await db.run(`
        ALTER TABLE style_profiles
        ADD COLUMN "showUnit" INTEGER NOT NULL DEFAULT 1 CHECK ("showUnit" IN (0,1))
      `);
        await db.run(`
        ALTER TABLE style_profiles
        ADD COLUMN "showRowNo" INTEGER NOT NULL DEFAULT 1 CHECK ("showRowNo" IN (0,1))
      `);
        await db.run(`
        ALTER TABLE invoice_customizations
        ADD COLUMN "showQuantity" INTEGER NOT NULL DEFAULT 1 CHECK ("showQuantity" IN (0,1))
      `);
        await db.run(`
        ALTER TABLE invoice_customizations
        ADD COLUMN "showUnit" INTEGER NOT NULL DEFAULT 1 CHECK ("showUnit" IN (0,1))
      `);
        await db.run(`
        ALTER TABLE invoice_customizations
        ADD COLUMN "showRowNo" INTEGER NOT NULL DEFAULT 1 CHECK ("showRowNo" IN (0,1))
      `);
        await db.run(`
        ALTER TABLE invoice_items
        ADD COLUMN "customField" TEXT;
      `);
    }
    catch (error) {
        return { success: false, ...(0, errorFunctions_1.mapDatabaseError)(error, db.type) };
    }
};
exports.up = up;
