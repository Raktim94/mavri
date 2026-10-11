"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.runMigrations = void 0;
const path_1 = __importDefault(require("path"));
const migrationRunner_1 = require("../shared/db/migrationRunner");
const migrationsPath = process.env.MIGRATIONS_PATH || path_1.default.resolve(process.cwd(), 'src', 'backend', 'shared', 'migrations');
const runMigrations = async (db) => {
    return (0, migrationRunner_1.runMigrations)(db, migrationsPath);
};
exports.runMigrations = runMigrations;
