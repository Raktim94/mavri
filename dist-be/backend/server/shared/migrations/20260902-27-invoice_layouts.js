"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.up = void 0;
const dbHelper_1 = require("../utils/dbHelper");
const errorFunctions_1 = require("../utils/errorFunctions");
const up = async (db) => {
    try {
        const isExisting = await (0, dbHelper_1.isTableExists)(db, 'layouts');
        if (isExisting)
            return;
        await db.run(`CREATE TABLE IF NOT EXISTS layouts (
      "id" ${(0, dbHelper_1.getColumnType)('INTEGER PRIMARY KEY AUTOINCREMENT', db.type)},
      "schema" TEXT NOT NULL,  
      "isArchived" INTEGER NOT NULL DEFAULT 0 CHECK ("isArchived" IN (0,1)),
      "createdAt" ${(0, dbHelper_1.getColumnType)('DATETIME', db.type)} NOT NULL DEFAULT ${(0, dbHelper_1.getDefaultValue)("(datetime('now'))", db.type)},
      "updatedAt" ${(0, dbHelper_1.getColumnType)('DATETIME', db.type)} NOT NULL DEFAULT ${(0, dbHelper_1.getDefaultValue)("(datetime('now'))", db.type)}
    )`);
        await db.run(`CREATE TABLE IF NOT EXISTS invoice_layout_snapshots (
      "id" ${(0, dbHelper_1.getColumnType)('INTEGER PRIMARY KEY AUTOINCREMENT', db.type)},
      "parentInvoiceId" INTEGER NOT NULL,
      "layoutSchema" TEXT NOT NULL, 
      "createdAt" ${(0, dbHelper_1.getColumnType)('DATETIME', db.type)} NOT NULL DEFAULT ${(0, dbHelper_1.getDefaultValue)("(datetime('now'))", db.type)},
      "updatedAt" ${(0, dbHelper_1.getColumnType)('DATETIME', db.type)} NOT NULL DEFAULT ${(0, dbHelper_1.getDefaultValue)("(datetime('now'))", db.type)},
      UNIQUE("parentInvoiceId"),
      FOREIGN KEY("parentInvoiceId") REFERENCES invoices("id") ON DELETE CASCADE
    )`);
        await db.run('CREATE INDEX IF NOT EXISTS idx_layouts_id ON layouts("id")');
        await db.run(`CREATE INDEX IF NOT EXISTS idx_invoice_layout_snapshots_parentInvoiceId ON invoice_layout_snapshots("parentInvoiceId")`);
        await db.run('ALTER TABLE invoices ADD COLUMN "layoutId" INTEGER REFERENCES layouts("id")');
        await db.run('CREATE INDEX IF NOT EXISTS idx_invoices_layoutId ON invoices("layoutId")');
    }
    catch (error) {
        return { success: false, ...(0, errorFunctions_1.mapDatabaseError)(error, db.type) };
    }
};
exports.up = up;
