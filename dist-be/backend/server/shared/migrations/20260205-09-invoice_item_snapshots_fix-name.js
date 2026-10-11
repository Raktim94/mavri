"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.up = void 0;
const databaseType_1 = require("../enums/databaseType");
const dbHelper_1 = require("../utils/dbHelper");
const errorFunctions_1 = require("../utils/errorFunctions");
const up = async (db) => {
    try {
        const isExisting = await (0, dbHelper_1.isTableExists)(db, 'invoice_item_snapshots');
        if (isExisting)
            return;
        if (db.type === databaseType_1.DatabaseType.sqlite) {
            await db.run('DROP TABLE IF EXISTS invoice_item_snapshots;');
            await db.run(`
          CREATE TABLE IF NOT EXISTS invoice_item_snapshots (
            "id" ${(0, dbHelper_1.getColumnType)('INTEGER PRIMARY KEY AUTOINCREMENT', db.type)},
            "parentInvoiceItemId" INTEGER NOT NULL,
            "itemName" TEXT NOT NULL,
            "unitPriceCents" INTEGER NOT NULL DEFAULT 0,
            "unitName" TEXT,
            "createdAt" ${(0, dbHelper_1.getColumnType)('DATETIME', db.type)} NOT NULL DEFAULT ${(0, dbHelper_1.getDefaultValue)("(datetime('now'))", db.type)},
            "updatedAt" ${(0, dbHelper_1.getColumnType)('DATETIME', db.type)} NOT NULL DEFAULT ${(0, dbHelper_1.getDefaultValue)("(datetime('now'))", db.type)},
            FOREIGN KEY("parentInvoiceItemId") REFERENCES invoice_items("id") ON DELETE CASCADE
          );
        `);
            await db.run(`
        INSERT INTO invoice_item_snapshots (
            "id",
            "parentInvoiceItemId",
            "itemName",
            "unitPriceCents",
            "unitName",
            "createdAt",
            "updatedAt"
        )
        SELECT
            iis."id",
            iis."parentInvoiceItemId",
            iis."itemName",
            iis."unitPriceCents",
            iis."unitName",
            iis."createdAt",
            iis."updatedAt"
        FROM invoice_item_snaphots as iis;
      `);
            await db.run('DROP TABLE invoice_item_snaphots;');
            await db.run(`CREATE INDEX IF NOT EXISTS idx_invoice_item_snapshots_parentInvoiceItemId ON invoice_item_snapshots("parentInvoiceItemId")`);
            await db.run(`CREATE INDEX IF NOT EXISTS idx_invoice_item_snapshots_itemName ON invoice_item_snapshots("itemName")`);
        }
        if (db.type === databaseType_1.DatabaseType.postgre) {
            await db.run(`ALTER TABLE invoice_item_snaphots RENAME TO invoice_item_snapshots;`);
            await db.run(`ALTER INDEX invoice_item_snaphots_pkey RENAME TO invoice_item_snapshots_pkey;`);
        }
    }
    catch (error) {
        return { success: false, ...(0, errorFunctions_1.mapDatabaseError)(error, db.type) };
    }
};
exports.up = up;
