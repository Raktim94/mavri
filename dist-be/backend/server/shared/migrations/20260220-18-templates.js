"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.up = void 0;
const dbHelper_1 = require("../utils/dbHelper");
const errorFunctions_1 = require("../utils/errorFunctions");
const up = async (db) => {
    try {
        const cols = await (0, dbHelper_1.getTableColumns)(db, 'settings');
        const colInfo = cols.find(c => c.name === 'presetsON');
        if (colInfo)
            return;
        await db.run(`
        ALTER TABLE settings
        ADD COLUMN "presetsON" INTEGER NOT NULL DEFAULT 1 CHECK ("presetsON" IN (0,1))
      `);
        await db.run(`CREATE TABLE IF NOT EXISTS presets (
        "id" ${(0, dbHelper_1.getColumnType)('INTEGER PRIMARY KEY AUTOINCREMENT', db.type)},
        "name" TEXT NOT NULL UNIQUE,
        "businessId" INTEGER,
        "clientId" INTEGER,
        "currencyId" INTEGER,
        "bankId" INTEGER,
        "customerNotes" TEXT,
        "thanksNotes" TEXT,
        "termsConditionNotes" TEXT,
        "language" TEXT,
        "signatureData" ${(0, dbHelper_1.getColumnType)('BLOB', db.type)},
        "signatureName" TEXT,
        "signatureType" TEXT,
        "signatureSize" INTEGER,
        "styleProfilesId" INTEGER,
        "isArchived" INTEGER NOT NULL DEFAULT 0 CHECK ("isArchived" IN (0,1)),
        "createdAt" ${(0, dbHelper_1.getColumnType)('DATETIME', db.type)} NOT NULL DEFAULT ${(0, dbHelper_1.getDefaultValue)("(datetime('now'))", db.type)},
        "updatedAt" ${(0, dbHelper_1.getColumnType)('DATETIME', db.type)} NOT NULL DEFAULT ${(0, dbHelper_1.getDefaultValue)("(datetime('now'))", db.type)},
        FOREIGN KEY("styleProfilesId") REFERENCES style_profiles("id") ON DELETE CASCADE,
        FOREIGN KEY("businessId") REFERENCES businesses("id") ON DELETE CASCADE,
        FOREIGN KEY("clientId") REFERENCES clients("id") ON DELETE CASCADE,
        FOREIGN KEY("currencyId") REFERENCES currencies("id") ON DELETE CASCADE,
        FOREIGN KEY ("bankId") REFERENCES banks("id") ON DELETE CASCADE
      );`);
    }
    catch (error) {
        return { success: false, ...(0, errorFunctions_1.mapDatabaseError)(error, db.type) };
    }
};
exports.up = up;
