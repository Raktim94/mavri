import type { DatabaseAdapter } from '../types/DatabaseAdapter';
import { getColumnType, getDefaultValue, getTableColumns } from '../utils/dbHelper';
import { mapDatabaseError } from '../utils/errorFunctions';

export const up = async (db: DatabaseAdapter) => {
  try {
    const cols = await getTableColumns(db, 'settings');
    const colInfo = cols.find(c => c.name === 'templatesON');
    if (colInfo) return;

    await db.run(
      `
        ALTER TABLE settings
        ADD COLUMN "templatesON" INTEGER NOT NULL DEFAULT 1 CHECK ("templatesON" IN (0,1))
      `
    );

    await db.run(
      `CREATE TABLE IF NOT EXISTS templates (
        "id" ${getColumnType('INTEGER PRIMARY KEY AUTOINCREMENT', db.type)},
        "name" TEXT NOT NULL UNIQUE,
        "businessId" INTEGER,
        "clientId" INTEGER,
        "currencyId" INTEGER,
        "bankId" INTEGER,
        "customerNotes" TEXT,
        "thanksNotes" TEXT,
        "termsConditionNotes" TEXT,
        "language" TEXT,
        "signatureData" ${getColumnType('BLOB', db.type)},
        "signatureName" TEXT,
        "signatureType" TEXT,
        "signatureSize" INTEGER,
        "styleProfilesId" INTEGER,
        "isArchived" INTEGER NOT NULL DEFAULT 0 CHECK ("isArchived" IN (0,1)),
        "createdAt" ${getColumnType('DATETIME', db.type)} NOT NULL DEFAULT ${getDefaultValue("(datetime('now'))", db.type)},
        "updatedAt" ${getColumnType('DATETIME', db.type)} NOT NULL DEFAULT ${getDefaultValue("(datetime('now'))", db.type)},
        FOREIGN KEY("styleProfilesId") REFERENCES style_profiles("id") ON DELETE CASCADE,
        FOREIGN KEY("businessId") REFERENCES businesses("id") ON DELETE CASCADE,
        FOREIGN KEY("clientId") REFERENCES clients("id") ON DELETE CASCADE,
        FOREIGN KEY("currencyId") REFERENCES currencies("id") ON DELETE CASCADE,
        FOREIGN KEY ("bankId") REFERENCES banks("id") ON DELETE CASCADE
      );`
    );
  } catch (error) {
    return { success: false, ...mapDatabaseError(error, db.type) };
  }
};
