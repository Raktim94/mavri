import type { DatabaseAdapter } from '../types/DatabaseAdapter';
import { getColumnType, getDefaultValue, isTableExists } from '../utils/dbHelper';
import { mapDatabaseError } from '../utils/errorFunctions';

export const up = async (db: DatabaseAdapter) => {
  try {
    if (!(await isTableExists(db, 'users'))) {
      await db.run(
        `CREATE TABLE IF NOT EXISTS users (
          "id" ${getColumnType('INTEGER PRIMARY KEY AUTOINCREMENT', db.type)},
          "email" TEXT NOT NULL UNIQUE,
          "passwordHash" TEXT NOT NULL,
          "role" TEXT NOT NULL DEFAULT 'owner',
          "failedLoginCount" INTEGER NOT NULL DEFAULT 0,
          "lockedUntil" ${getColumnType('DATETIME', db.type)},
          "lastLoginAt" ${getColumnType('DATETIME', db.type)},
          "createdAt" ${getColumnType('DATETIME', db.type)} NOT NULL DEFAULT ${getDefaultValue("(datetime('now'))", db.type)},
          "updatedAt" ${getColumnType('DATETIME', db.type)} NOT NULL DEFAULT ${getDefaultValue("(datetime('now'))", db.type)}
        );`
      );
    }

    if (!(await isTableExists(db, 'api_keys'))) {
      await db.run(
        `CREATE TABLE IF NOT EXISTS api_keys (
          "id" ${getColumnType('INTEGER PRIMARY KEY AUTOINCREMENT', db.type)},
          "name" TEXT NOT NULL,
          "keyPrefix" TEXT NOT NULL,
          "keyHash" TEXT NOT NULL UNIQUE,
          "createdByUserId" INTEGER,
          "lastUsedAt" ${getColumnType('DATETIME', db.type)},
          "revokedAt" ${getColumnType('DATETIME', db.type)},
          "createdAt" ${getColumnType('DATETIME', db.type)} NOT NULL DEFAULT ${getDefaultValue("(datetime('now'))", db.type)},
          FOREIGN KEY("createdByUserId") REFERENCES users("id") ON DELETE SET NULL
        );`
      );
      await db.run(`CREATE INDEX IF NOT EXISTS idx_api_keys_revokedAt ON api_keys("revokedAt")`);
    }

    // Backing store for express-session, so sessions survive a process restart
    // instead of relying on an in-memory store (important once this is
    // reachable from the internet and not just a local single-user process).
    if (!(await isTableExists(db, 'sessions'))) {
      await db.run(
        `CREATE TABLE IF NOT EXISTS sessions (
          "sid" TEXT PRIMARY KEY,
          "data" TEXT NOT NULL,
          "expiresAt" ${getColumnType('DATETIME', db.type)} NOT NULL
        );`
      );
      await db.run(`CREATE INDEX IF NOT EXISTS idx_sessions_expiresAt ON sessions("expiresAt")`);
    }

    return { success: true };
  } catch (error) {
    return { success: false, ...mapDatabaseError(error, db.type) };
  }
};
