"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.up = void 0;
const databaseType_1 = require("../enums/databaseType");
const dbHelper_1 = require("../utils/dbHelper");
const errorFunctions_1 = require("../utils/errorFunctions");
const up = async (db) => {
    try {
        if (db.type === databaseType_1.DatabaseType.postgre) {
            await db.run(`ALTER TABLE invoice_sequences
         ADD COLUMN "invoiceType" TEXT NOT NULL DEFAULT 'invoice'
         CHECK("invoiceType" IN ('quotation','invoice'))`);
            await db.run('ALTER TABLE invoice_sequences DROP CONSTRAINT IF EXISTS "invoice_sequences_businessId_clientId_key"');
            await db.run(`ALTER TABLE invoice_sequences
         ADD CONSTRAINT invoice_sequences_business_client_type_unique
         UNIQUE ("businessId", "clientId", "invoiceType")`);
            return;
        }
        await db.run('DROP TABLE IF EXISTS invoice_sequences_new;');
        await db.run(`
      CREATE TABLE invoice_sequences_new (
        "id" ${(0, dbHelper_1.getColumnType)('INTEGER PRIMARY KEY AUTOINCREMENT', db.type)},
        "businessId" INTEGER NOT NULL,
        "clientId" INTEGER NOT NULL,
        "nextSequence" BIGINT NOT NULL,
        "invoiceType" TEXT NOT NULL CHECK("invoiceType" IN ('quotation','invoice')),
        "createdAt" ${(0, dbHelper_1.getColumnType)('DATETIME', db.type)} NOT NULL DEFAULT ${(0, dbHelper_1.getDefaultValue)("(datetime('now'))", db.type)},
        "updatedAt" ${(0, dbHelper_1.getColumnType)('DATETIME', db.type)} NOT NULL DEFAULT ${(0, dbHelper_1.getDefaultValue)("(datetime('now'))", db.type)},
        UNIQUE("businessId","clientId","invoiceType")
      );
      `);
        await db.run(`
      INSERT INTO invoice_sequences_new ("id", "businessId", "clientId", "nextSequence", "invoiceType", "createdAt", "updatedAt")
      SELECT
        "id", "businessId", "clientId", "nextSequence", 'invoice', "createdAt", "updatedAt"
      FROM invoice_sequences
      `);
        await db.run('DROP TABLE invoice_sequences;');
        await db.run('ALTER TABLE invoice_sequences_new RENAME TO invoice_sequences;');
    }
    catch (error) {
        return { success: false, ...(0, errorFunctions_1.mapDatabaseError)(error, db.type) };
    }
};
exports.up = up;
