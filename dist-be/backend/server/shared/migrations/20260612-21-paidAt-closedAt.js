"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.up = void 0;
const dbHelper_1 = require("../utils/dbHelper");
const errorFunctions_1 = require("../utils/errorFunctions");
const up = async (db) => {
    try {
        const cols = await (0, dbHelper_1.getTableColumns)(db, 'invoices');
        const colInfo = cols.find(c => c.name === 'paidAt');
        if (colInfo)
            return;
        await db.run(`
        ALTER TABLE invoices
        ADD COLUMN "paidAt" ${(0, dbHelper_1.getColumnType)('DATETIME', db.type)}
      `);
        await db.run(`
        ALTER TABLE invoices
        ADD COLUMN "closedAt" ${(0, dbHelper_1.getColumnType)('DATETIME', db.type)}
      `);
    }
    catch (error) {
        return { success: false, ...(0, errorFunctions_1.mapDatabaseError)(error, db.type) };
    }
};
exports.up = up;
