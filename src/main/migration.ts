import { app } from 'electron';
import { join, resolve } from 'path';
import sqlite3 from 'sqlite3';
import { runMigrations as runMigrationsShared } from '../shared/db/migrationRunner';

const isDev = !app.isPackaged;
const migrationsPath = isDev
  ? join(resolve(), 'dist-electron/migrations')
  : join(app.getAppPath(), 'dist-electron/migrations');

export const runMigrations = async (db: sqlite3.Database) => {
  return runMigrationsShared(db, migrationsPath);
};
