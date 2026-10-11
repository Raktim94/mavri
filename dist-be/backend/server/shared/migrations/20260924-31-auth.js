"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.up = void 0;
const dbHelper_1 = require("../utils/dbHelper");
const errorFunctions_1 = require("../utils/errorFunctions");
const up = async (db) => {
    try {
        if (!(await (0, dbHelper_1.isTableExists)(db, 'users'))) {
            await db.run(`CREATE TABLE IF NOT EXISTS users (
          "id" ${(0, dbHelper_1.getColumnType)('INTEGER PRIMARY KEY AUTOINCREMENT', db.type)},
          "email" TEXT NOT NULL UNIQUE,
          "passwordHash" TEXT NOT NULL,
          "role" TEXT NOT NULL DEFAULT 'owner',
          "failedLoginCount" INTEGER NOT NULL DEFAULT 0,
          "lockedUntil" ${(0, dbHelper_1.getColumnType)('DATETIME', db.type)},
          "lastLoginAt" ${(0, dbHelper_1.getColumnType)('DATETIME', db.type)},
          "createdAt" ${(0, dbHelper_1.getColumnType)('DATETIME', db.type)} NOT NULL DEFAULT ${(0, dbHelper_1.getDefaultValue)("(datetime('now'))", db.type)},
          "updatedAt" ${(0, dbHelper_1.getColumnType)('DATETIME', db.type)} NOT NULL DEFAULT ${(0, dbHelper_1.getDefaultValue)("(datetime('now'))", db.type)}
        );`);
        }
        if (!(await (0, dbHelper_1.isTableExists)(db, 'api_keys'))) {
            await db.run(`CREATE TABLE IF NOT EXISTS api_keys (
          "id" ${(0, dbHelper_1.getColumnType)('INTEGER PRIMARY KEY AUTOINCREMENT', db.type)},
          "name" TEXT NOT NULL,
          "keyPrefix" TEXT NOT NULL,
          "keyHash" TEXT NOT NULL UNIQUE,
          "createdByUserId" INTEGER,
          "lastUsedAt" ${(0, dbHelper_1.getColumnType)('DATETIME', db.type)},
          "revokedAt" ${(0, dbHelper_1.getColumnType)('DATETIME', db.type)},
          "createdAt" ${(0, dbHelper_1.getColumnType)('DATETIME', db.type)} NOT NULL DEFAULT ${(0, dbHelper_1.getDefaultValue)("(datetime('now'))", db.type)},
          FOREIGN KEY("createdByUserId") REFERENCES users("id") ON DELETE SET NULL
        );`);
            await db.run(`CREATE INDEX IF NOT EXISTS idx_api_keys_revokedAt ON api_keys("revokedAt")`);
        }
        // Backing store for express-session, so sessions survive a process restart
        // instead of relying on an in-memory store (important once this is
        // reachable from the internet and not just a local single-user process).
        if (!(await (0, dbHelper_1.isTableExists)(db, 'sessions'))) {
            await db.run(`CREATE TABLE IF NOT EXISTS sessions (
          "sid" TEXT PRIMARY KEY,
          "data" TEXT NOT NULL,
          "expiresAt" ${(0, dbHelper_1.getColumnType)('DATETIME', db.type)} NOT NULL
        );`);
            await db.run(`CREATE INDEX IF NOT EXISTS idx_sessions_expiresAt ON sessions("expiresAt")`);
        }
        return { success: true };
    }
    catch (error) {
        return { success: false, ...(0, errorFunctions_1.mapDatabaseError)(error, db.type) };
    }
};
exports.up = up;
