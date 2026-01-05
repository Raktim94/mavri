import { app } from 'electron';
import fs from 'fs';
import path, { join, resolve } from 'path';
import sqlite3 from 'sqlite3';
import { pathToFileURL } from 'url';
import { getFirstRow, runAsync } from './utils/dbFuntions';
import { mapSqliteError } from './utils/errorFunctions';

const isDev = !app.isPackaged;
const migrationsPath = isDev
  ? join(resolve(), 'dist-electron/migrations')
  : join(app.getAppPath(), 'dist-electron/migrations');

export const runMigrations = async (db: sqlite3.Database) => {
  try {
    const files = fs
      .readdirSync(migrationsPath)
      .filter(f => f.endsWith('.cjs'))
      .sort();

    await runAsync(
      db,
      `
    CREATE TABLE IF NOT EXISTS migrations (
      name TEXT PRIMARY KEY,
      appliedAt DATETIME NOT NULL DEFAULT (datetime('now'))
    );
  `
    );

    for (const file of files) {
      const name = path.basename(file);

      const row = await getFirstRow(db, `SELECT 1 FROM migrations WHERE name = ?`, [name]);

      if (!row) {
        const migrationFilePath = join(migrationsPath, file);
        const migrationUrl = pathToFileURL(migrationFilePath).href;
        const migration = await import(migrationUrl);
        await migration.up(db);
        await runAsync(db, `INSERT INTO migrations(name) VALUES('${name}')`);
      }
    }
  } catch (error) {
    await runAsync(db, 'ROLLBACK;');
    return { success: false, ...mapSqliteError(error) };
  }
};
