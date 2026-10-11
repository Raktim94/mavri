"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.up = void 0;
const databaseType_1 = require("../enums/databaseType");
const dbHelper_1 = require("../utils/dbHelper");
const errorFunctions_1 = require("../utils/errorFunctions");
const up = async (db) => {
    try {
        const cols = await (0, dbHelper_1.getTableColumns)(db, 'invoice_items');
        const colInfo = cols.find(c => c.name === 'quantity');
        if (colInfo) {
            const type = String(colInfo.type).toUpperCase();
            if (type === 'TEXT' || type === 'CHARACTER VARYING' || type === 'VARCHAR')
                return;
        }
        if (db.type === databaseType_1.DatabaseType.sqlite) {
            await db.run('DROP TABLE IF EXISTS invoice_items_new;');
            await db.run(`
      CREATE TABLE invoice_items_new (
        "id" ${(0, dbHelper_1.getColumnType)('INTEGER PRIMARY KEY AUTOINCREMENT', db.type)},
        "parentInvoiceId" INTEGER NOT NULL,
        "itemId" INTEGER NOT NULL,
        "itemNameSnapshot" TEXT NOT NULL,
        "unitPriceCentsSnapshot" INTEGER NOT NULL DEFAULT 0,
        "unitNameSnapshot" TEXT,
        "quantity" TEXT NOT NULL DEFAULT '0',
        "taxRate" REAL NOT NULL DEFAULT 0,
        "taxType" TEXT CHECK("taxType" IN ('exclusive','inclusive') OR "taxType" IS NULL),
        "createdAt" ${(0, dbHelper_1.getColumnType)('DATETIME', db.type)} NOT NULL DEFAULT ${(0, dbHelper_1.getDefaultValue)("(datetime('now'))", db.type)},
        "updatedAt" ${(0, dbHelper_1.getColumnType)('DATETIME', db.type)} NOT NULL DEFAULT ${(0, dbHelper_1.getDefaultValue)("(datetime('now'))", db.type)},
        FOREIGN KEY ("parentInvoiceId") REFERENCES invoices("id") ON DELETE CASCADE,
        FOREIGN KEY ("itemId") REFERENCES items("id")
      );
    `);
            await db.run(`
      INSERT INTO invoice_items_new (
        "id", "parentInvoiceId", "itemId", "itemNameSnapshot", "unitPriceCentsSnapshot", 
        "unitNameSnapshot", "quantity", "taxRate", "taxType", "createdAt", "updatedAt"
      )
      SELECT
        ii."id", ii."parentInvoiceId", ii."itemId", ii."itemNameSnapshot", ii."unitPriceCentsSnapshot",
        ii."unitNameSnapshot", CAST(ii."quantity" AS TEXT), ii."taxRate", ii."taxType", ii."createdAt", ii."updatedAt"
      FROM invoice_items as ii;
    `);
            await db.run('DROP TABLE invoice_items;');
            await db.run('ALTER TABLE invoice_items_new RENAME TO invoice_items;');
            await db.run(`CREATE INDEX IF NOT EXISTS idx_invoice_items_invoiceId ON invoice_items("parentInvoiceId")`);
            await db.run(`CREATE INDEX IF NOT EXISTS idx_invoice_items_itemId ON invoice_items("itemId")`);
        }
        if (db.type === databaseType_1.DatabaseType.postgre) {
            await db.run(`
        ALTER TABLE invoice_items
        ALTER COLUMN "quantity" TYPE TEXT USING "quantity"::text;
      `);
        }
    }
    catch (error) {
        return { success: false, ...(0, errorFunctions_1.mapDatabaseError)(error, db.type) };
    }
};
exports.up = up;
