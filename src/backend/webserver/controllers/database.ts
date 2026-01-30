import { type Express, type Request, type Response } from 'express';
import fs from 'fs';
import fsPromise from 'fs/promises';
import path from 'path';
import type { Database } from 'sqlite3';
import { initInitialData, initSchema, openDb } from '../../shared/db/setup';
import { DBInitType } from '../../shared/enums/dbInitType';
import { APP_CONFIG } from '../config';
import { runMigrations } from '../migration';

export let dbInstance: Database | null = null;
export const dbDir = path.resolve(process.cwd(), process.env.dbDirectory || APP_CONFIG.dbDirectory);

const openDatabase = async (fullPath: string, createIfMissing: boolean): Promise<void> => {
  if (dbInstance) {
    await new Promise<void>((resolve, reject) => {
      (dbInstance as Database).close(err => {
        if (err) reject(err);
        else resolve();
      });
    });
    dbInstance = null;
  }

  fs.mkdirSync(path.dirname(fullPath), { recursive: true });
  const { db: database } = await openDb(fullPath, createIfMissing);
  dbInstance = database;

  if (!dbInstance) throw new Error('No database selected');

  if (createIfMissing) {
    await initSchema(dbInstance);
    await initInitialData(dbInstance);
  }

  const migrationResult = await runMigrations(dbInstance);
  if (migrationResult && !migrationResult.success) {
    throw new Error(migrationResult.message ?? 'Migrations failed');
  }
};

export const initDatabaseController = (app: Express) => {
  app.get('/api/databases', async (_req: Request, res: Response) => {
    try {
      const files = await fsPromise.readdir(dbDir);
      const dbFiles = files.filter(f => f.endsWith('.db') || f.endsWith('.sqlite') || f.endsWith('.sqlite3'));

      res.json({
        success: true,
        data: dbFiles
      });
    } catch (err) {
      res.status(500).json({
        success: false,
        message: (err as Error).message
      });
    }
  });
  app.post('/api/databases', async (req: Request, res: Response) => {
    try {
      const name = String(req.body?.fullPath ?? '');
      const mode = String(req.body?.mode ?? '');
      const fullPath = path.resolve(dbDir, name);
      const createIfMissing = mode === DBInitType.create || typeof mode === 'undefined';

      await openDatabase(fullPath, createIfMissing);
      res.json({ success: true });
    } catch (err) {
      console.log(err);
      res.status(500).json({ success: false, message: (err as Error).message });
    }
  });
};
