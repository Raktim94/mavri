"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.up = void 0;
const dbHelper_1 = require("../utils/dbHelper");
const errorFunctions_1 = require("../utils/errorFunctions");
const up = async (db) => {
    try {
        const cols = await (0, dbHelper_1.getTableColumns)(db, 'invoice_customizations');
        const colInfo = cols.find(c => c.name === 'pdfTexts');
        if (colInfo)
            return;
        await db.run(`
        ALTER TABLE style_profiles
        ADD COLUMN "pdfTexts" TEXT
      `);
        await db.run(`
        ALTER TABLE invoice_customizations
        ADD COLUMN "pdfTexts" TEXT 
      `);
    }
    catch (error) {
        return { success: false, ...(0, errorFunctions_1.mapDatabaseError)(error, db.type) };
    }
};
exports.up = up;
