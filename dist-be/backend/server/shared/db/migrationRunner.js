"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.runMigrations = void 0;
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
const databaseType_1 = require("../enums/databaseType");
const dbHelper_1 = require("../utils/dbHelper");
const errorFunctions_1 = require("../utils/errorFunctions");
const runMigrations = async (db, migrationsPath) => {
    let transactionStarted = false;
    try {
        if (!fs_1.default.existsSync(migrationsPath)) {
            return;
        }
        const files = fs_1.default
            .readdirSync(migrationsPath)
            .filter(f => /^\d{8}-\d{2}-.*\.(cjs|js|ts)$/.test(f))
            .sort();
        if (db.type === databaseType_1.DatabaseType.sqlite) {
            await db.run('PRAGMA foreign_keys = OFF;');
        }
        await db.run('BEGIN');
        transactionStarted = true;
        await db.run(`
      CREATE TABLE IF NOT EXISTS migrations (
        "name" TEXT PRIMARY KEY,
        "appliedAt" ${(0, dbHelper_1.getColumnType)('DATETIME', db.type)} NOT NULL DEFAULT ${(0, dbHelper_1.getDefaultValue)("(datetime('now'))", db.type)}
      );
    `);
        for (const file of files) {
            const name = path_1.default.basename(file);
            const row = await db.get(`SELECT 1 FROM migrations WHERE "name" = ?`, [name]);
            if (!row) {
                const migrationPath = path_1.default.resolve(migrationsPath, file);
                // eslint-disable-next-line @typescript-eslint/no-require-imports
                const migration = require(migrationPath);
                if (typeof migration.up !== 'function') {
                    throw new Error(`error.noUpFunction`);
                }
                if (migration.up) {
                    await migration.up(db);
                    await db.run(`INSERT INTO migrations("name") VALUES(?)`, [name]);
                }
            }
        }
        await db.run('COMMIT');
        if (db.type === databaseType_1.DatabaseType.sqlite) {
            await db.run('PRAGMA foreign_keys = ON;');
        }
        return { success: true, message: undefined, data: undefined, key: undefined };
    }
    catch (error) {
        if (transactionStarted) {
            try {
                await db.run('ROLLBACK');
            }
            catch {
                throw new Error(`error.rollbackFailed`);
            }
        }
        if (db.type === databaseType_1.DatabaseType.sqlite) {
            await db.run('PRAGMA foreign_keys = ON;');
        }
        return { success: false, ...(0, errorFunctions_1.mapDatabaseError)(error, db.type) };
    }
};
exports.runMigrations = runMigrations;
