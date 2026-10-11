"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.up = void 0;
const dbHelper_1 = require("../utils/dbHelper");
const errorFunctions_1 = require("../utils/errorFunctions");
const up = async (db) => {
    try {
        const cols = await (0, dbHelper_1.getTableColumns)(db, 'invoices');
        const colInfo = cols.find(c => c.name === 'surchargeName');
        if (colInfo)
            return;
        await db.run(`
        ALTER TABLE invoices
        ADD COLUMN "surchargeName" TEXT
      `);
        await db.run(`
        ALTER TABLE invoices
        ADD COLUMN "surchargeAmountCents" TEXT NOT NULL DEFAULT '0';
      `);
        await db.run(`
        ALTER TABLE invoices
        ADD COLUMN "surchargeType" TEXT CHECK("surchargeType" IN ('fixed','percentage') OR "surchargeType" IS NULL)
      `);
        await db.run(`
        ALTER TABLE invoices
        ADD COLUMN "surchargePercent" REAL NOT NULL DEFAULT 0
      `);
    }
    catch (error) {
        return { success: false, ...(0, errorFunctions_1.mapDatabaseError)(error, db.type) };
    }
};
exports.up = up;
