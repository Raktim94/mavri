import type { BrowserWindow } from 'electron';
import sqlite3 from 'sqlite3';
import { initInitialData, initSchema, openDb } from '../shared/db/setup';
import { initIpcHandler } from './ipc';
import { runMigrations } from './migration';

let db: sqlite3.Database;
let dbPath: string | undefined;

const setupDB = async (opts: { fullPath: string; createIfMissing?: boolean; mainWindow: BrowserWindow }) => {
  const { fullPath, createIfMissing = true, mainWindow } = opts;

  const { db: newDb } = await openDb(fullPath, createIfMissing);
  db = newDb;
  dbPath = fullPath;

  if (createIfMissing) {
    await initSchema(db);
    await initInitialData(db);
  }

  const migrationResult = await runMigrations(db);
  if (migrationResult && !migrationResult.success) {
    throw new Error(migrationResult.message ?? 'Migrations failed');
  }

  initIpcHandler(db, dbPath, mainWindow);
};

export { db, setupDB };
