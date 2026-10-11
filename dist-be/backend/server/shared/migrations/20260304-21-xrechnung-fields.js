"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.up = void 0;
const dbHelper_1 = require("../utils/dbHelper");
const errorFunctions_1 = require("../utils/errorFunctions");
const up = async (db) => {
    try {
        const cols = await (0, dbHelper_1.getTableColumns)(db, 'settings');
        const colInfo = cols.find(c => c.name === 'xrechnungON');
        if (colInfo)
            return;
        await db.run(`
        ALTER TABLE settings
        ADD COLUMN "xrechnungON" INTEGER NOT NULL DEFAULT 1 CHECK ("xrechnungON" IN (0,1))
      `);
    }
    catch (error) {
        return { success: false, ...(0, errorFunctions_1.mapDatabaseError)(error, db.type) };
    }
};
exports.up = up;
