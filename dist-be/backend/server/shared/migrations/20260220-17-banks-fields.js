"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.up = void 0;
const dbHelper_1 = require("../utils/dbHelper");
const errorFunctions_1 = require("../utils/errorFunctions");
const up = async (db) => {
    try {
        const cols = await (0, dbHelper_1.getTableColumns)(db, 'banks');
        const colInfo = cols.find(c => c.name === 'accountHolder');
        if (colInfo)
            return;
        await db.run(`
        ALTER TABLE banks
        ADD COLUMN "accountHolder" TEXT
      `);
        await db.run(`
        ALTER TABLE banks
        ADD COLUMN "sortOrder" TEXT 
      `);
        await db.run(`
        ALTER TABLE invoice_bank_snapshots
        ADD COLUMN "accountHolder" TEXT
      `);
        await db.run(`
        ALTER TABLE invoice_bank_snapshots
        ADD COLUMN "sortOrder" TEXT 
      `);
    }
    catch (error) {
        return { success: false, ...(0, errorFunctions_1.mapDatabaseError)(error, db.type) };
    }
};
exports.up = up;
