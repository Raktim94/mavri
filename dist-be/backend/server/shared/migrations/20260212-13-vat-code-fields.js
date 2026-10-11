"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.up = void 0;
const dbHelper_1 = require("../utils/dbHelper");
const errorFunctions_1 = require("../utils/errorFunctions");
const up = async (db) => {
    try {
        const cols = await (0, dbHelper_1.getTableColumns)(db, 'invoice_client_snapshots');
        const colInfo = cols.find(c => c.name === 'clientVatCode');
        if (colInfo)
            return;
        await db.run(`
        ALTER TABLE clients
        ADD COLUMN "vatCode" TEXT
      `);
        await db.run(`
        ALTER TABLE businesses
        ADD COLUMN "vatCode" TEXT
      `);
        await db.run(`
        ALTER TABLE invoice_business_snapshots
        ADD COLUMN "businessVatCode" TEXT
      `);
        await db.run(`
        ALTER TABLE invoice_client_snapshots
        ADD COLUMN "clientVatCode" TEXT
      `);
    }
    catch (error) {
        return { success: false, ...(0, errorFunctions_1.mapDatabaseError)(error, db.type) };
    }
};
exports.up = up;
