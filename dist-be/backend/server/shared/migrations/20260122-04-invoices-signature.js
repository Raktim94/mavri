"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.up = void 0;
const dbHelper_1 = require("../utils/dbHelper");
const errorFunctions_1 = require("../utils/errorFunctions");
const up = async (db) => {
    try {
        const cols = await (0, dbHelper_1.getTableColumns)(db, 'invoices');
        const colInfo = cols.find(c => c.name === 'signatureData');
        if (colInfo) {
            return;
        }
        await db.run(`
      ALTER TABLE invoices ADD COLUMN "signatureData" ${(0, dbHelper_1.getColumnType)('BLOB', db.type)};
    `);
        await db.run(`ALTER TABLE invoices ADD COLUMN "signatureName" TEXT;`);
        await db.run(`ALTER TABLE invoices ADD COLUMN "signatureType" TEXT;`);
        await db.run(`ALTER TABLE invoices ADD COLUMN "signatureSize" INTEGER;`);
    }
    catch (error) {
        return { success: false, ...(0, errorFunctions_1.mapDatabaseError)(error, db.type) };
    }
};
exports.up = up;
