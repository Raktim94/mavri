"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.setupDB = exports.dbInstance = void 0;
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
const setup_1 = require("../shared/db/setup");
const databaseType_1 = require("../shared/enums/databaseType");
const migration_1 = require("./migration");
exports.dbInstance = null;
const setupDB = async (opts) => {
    const { sqliteConfig, createIfMissing = true, dbType, postgresConfig } = opts;
    if (exports.dbInstance) {
        await exports.dbInstance.close();
        exports.dbInstance = null;
    }
    if (dbType === databaseType_1.DatabaseType.postgre) {
        if (!postgresConfig)
            throw new Error('error.postgresConfig');
        const { db: newDb } = await (0, setup_1.openPostgreSql)(postgresConfig);
        exports.dbInstance = newDb;
    }
    else if (dbType === databaseType_1.DatabaseType.sqlite) {
        if (sqliteConfig?.fullPath)
            fs_1.default.mkdirSync(path_1.default.dirname(sqliteConfig?.fullPath), { recursive: true });
        const { db: newDb } = await (0, setup_1.openSqlLite)({ fullPath: sqliteConfig?.fullPath, createIfMissing: createIfMissing });
        exports.dbInstance = newDb;
    }
    if (!exports.dbInstance)
        throw new Error('error.noDatabase');
    if (createIfMissing) {
        await (0, setup_1.initSchema)(exports.dbInstance);
        await (0, setup_1.initInitialData)(exports.dbInstance);
    }
    const migrationResult = await (0, migration_1.runMigrations)(exports.dbInstance);
    if (migrationResult && !migrationResult.success) {
        throw new Error(migrationResult.message ?? 'error.failedMigration');
    }
};
exports.setupDB = setupDB;
