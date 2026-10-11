"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.initDatabaseController = exports.dbDir = void 0;
const promises_1 = __importDefault(require("fs/promises"));
const path_1 = __importDefault(require("path"));
const setup_1 = require("../../shared/db/setup");
const databaseType_1 = require("../../shared/enums/databaseType");
const dbInitType_1 = require("../../shared/enums/dbInitType");
const config_1 = require("../config");
const database_1 = require("../database");
const auth_1 = require("../middleware/auth");
const functions_1 = require("../utils/functions");
exports.dbDir = path_1.default.resolve(process.cwd(), process.env.DB_DIRECTORY || config_1.APP_CONFIG.DB_DIRECTORY);
// Keeps the resolved database file path inside dbDir, so a name like
// "../../etc/cron.d/evil" can't make the server create or open a file
// anywhere else on disk.
const resolveDbFileName = (name) => {
    const resolved = path_1.default.resolve(exports.dbDir, name);
    const relative = path_1.default.relative(exports.dbDir, resolved);
    if (relative.startsWith('..') || path_1.default.isAbsolute(relative))
        return null;
    return resolved;
};
const initDatabaseController = (app) => {
    app.get('/api/databases', functions_1.listDbLimiter, auth_1.requireAuthOnceConfigured, async (_req, res) => {
        try {
            const files = await promises_1.default.readdir(exports.dbDir);
            const dbFiles = files.filter(f => f.endsWith('.db') || f.endsWith('.sqlite') || f.endsWith('.sqlite3'));
            res.json({
                success: true,
                data: dbFiles
            });
        }
        catch (err) {
            res.status(500).json({
                success: false,
                message: err.message
            });
        }
    });
    app.post('/api/databases/test', functions_1.listDbLimiter, auth_1.requireAuthOnceConfigured, async (req, res) => {
        try {
            const postgresConfig = req.body;
            if (postgresConfig.host === 'localhost') {
                postgresConfig.host = 'host.docker.internal';
            }
            await (0, setup_1.testPostgresConnection)(postgresConfig);
            res.json({ success: true });
        }
        catch (err) {
            res.status(500).json({ success: false, message: err.message });
        }
    });
    app.post('/api/databases', functions_1.listDbLimiter, auth_1.requireAuthOnceConfigured, async (req, res) => {
        try {
            const name = String(req.body?.fullPath ?? '');
            const mode = String(req.body?.mode ?? '');
            const dbType = req.body?.dbType ?? databaseType_1.DatabaseType.sqlite;
            const postgresConfig = req.body?.postgresConfig;
            const createIfMissing = mode === dbInitType_1.DBInitType.create || typeof mode === 'undefined';
            const fullPath = dbType === databaseType_1.DatabaseType.sqlite ? (resolveDbFileName(name) ?? undefined) : undefined;
            if (dbType === databaseType_1.DatabaseType.sqlite && !fullPath) {
                res.status(400).json({ success: false, message: undefined, key: 'error.invalidDBName' });
                return;
            }
            if (process.env.NODE_ENV === 'docker' && postgresConfig && postgresConfig.host === 'localhost') {
                postgresConfig.host = 'host.docker.internal';
            }
            await (0, database_1.setupDB)({
                sqliteConfig: { fullPath: fullPath },
                dbType: dbType,
                createIfMissing,
                postgresConfig: postgresConfig
            });
            res.json({ success: true });
        }
        catch (err) {
            res.status(500).json({ success: false, message: err.message });
        }
    });
};
exports.initDatabaseController = initDatabaseController;
