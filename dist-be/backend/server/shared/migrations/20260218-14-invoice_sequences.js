"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.up = void 0;
const dbHelper_1 = require("../utils/dbHelper");
const errorFunctions_1 = require("../utils/errorFunctions");
const up = async (db) => {
    try {
        const isExisting = await (0, dbHelper_1.isTableExists)(db, 'invoice_sequences');
        if (isExisting)
            return;
        await db.run(`
      CREATE TABLE invoice_sequences (
        "id" ${(0, dbHelper_1.getColumnType)('INTEGER PRIMARY KEY AUTOINCREMENT', db.type)},
        "businessId" INTEGER NOT NULL,
        "clientId" INTEGER NOT NULL,
        "nextSequence" BIGINT NOT NULL,
        "createdAt" ${(0, dbHelper_1.getColumnType)('DATETIME', db.type)} NOT NULL DEFAULT ${(0, dbHelper_1.getDefaultValue)("(datetime('now'))", db.type)},
        "updatedAt" ${(0, dbHelper_1.getColumnType)('DATETIME', db.type)} NOT NULL DEFAULT ${(0, dbHelper_1.getDefaultValue)("(datetime('now'))", db.type)},
        UNIQUE("businessId","clientId")
      );
      `);
        await db.run(`
      INSERT INTO invoice_sequences ("businessId", "clientId", "nextSequence")
      SELECT
        "businessId", "clientId",  COALESCE(
          MAX(CAST("invoiceNumber" AS BIGINT)) + 1,
          COUNT(*) + 1,
          1
        )
      FROM invoices
      GROUP BY "businessId", "clientId"
      `);
    }
    catch (error) {
        return { success: false, ...(0, errorFunctions_1.mapDatabaseError)(error, db.type) };
    }
};
exports.up = up;
