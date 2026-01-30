import { type Express, type Request, type Response } from 'express';
import fs from 'fs';
import path from 'path';
import type { Database } from 'sqlite3';
import { initControllers } from '.';
import { initInitialData, initSchema, openDb } from '../../shared/db/setup';
import { runMigrations } from '../migration';

export let db: Database | null = null;

const openDatabase = async (app: Express, fullPath: string, createIfMissing: boolean): Promise<void> => {
  if (db) {
    (db as Database).close();
    db = null;
  }
  fs.mkdirSync(path.dirname(fullPath), { recursive: true });
  const { db: database } = await openDb(fullPath, createIfMissing);
  db = database;

  if (!db) throw new Error('No database selected');

  if (createIfMissing) {
    await initSchema(db);
    await initInitialData(db);
  }

  const migrationResult = await runMigrations(db);
  if (migrationResult && !migrationResult.success) {
    throw new Error(migrationResult.message ?? 'Migrations failed');
  }

  initControllers(app, db);
};

export const initDatabaseController = (app: Express) => {
  app.post('/api/databases/create', async (req: Request, res: Response) => {
    try {
      const fullPath = String(req.body?.path ?? '')
        .trim()
        .replace(/[^a-zA-Z0-9_-]/g, '_');
      await openDatabase(app, fullPath, true);
      res.json({ success: true });
    } catch (err) {
      res.status(500).json({ success: false, message: (err as Error).message });
    }
  });
  app.post('/api/databases/connect', async (req: Request, res: Response) => {
    try {
      const fullPath = String(req.body?.path ?? '').trim();
      await openDatabase(app, fullPath, false);
      res.json({ success: true });
    } catch (err) {
      res.status(500).json({ success: false, message: (err as Error).message });
    }
  });
};
