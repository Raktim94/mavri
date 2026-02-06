import { type Express, type Request, type Response } from 'express';
import fsPromise from 'fs/promises';
import path from 'path';
import { testPostgresConnection } from '../../shared/db/setup';
import { DatabaseType } from '../../shared/enums/databaseType';
import { DBInitType } from '../../shared/enums/dbInitType';
import { APP_CONFIG } from '../config';
import { setupDB } from '../database';
import { listDbLimiter } from '../utils/functions';

export const dbDir = path.resolve(process.cwd(), process.env.DB_DIRECTORY || APP_CONFIG.DB_DIRECTORY);

export const initDatabaseController = (app: Express) => {
  app.get('/api/databases', listDbLimiter, async (_req: Request, res: Response) => {
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
  app.post('/api/databases/test', async (req: Request, res: Response) => {
    try {
      const postgresConfig = req.body;

      await testPostgresConnection(postgresConfig);
      res.json({ success: true });
    } catch (err) {
      res.status(500).json({ success: false, message: (err as Error).message });
    }
  });
  app.post('/api/databases', async (req: Request, res: Response) => {
    try {
      const name = String(req.body?.fullPath ?? '');
      const mode = String(req.body?.mode ?? '');
      const dbType = req.body?.dbType ?? DatabaseType.sqlite;
      const postgresConfig = req.body?.postgresConfig;
      const fullPath = path.resolve(dbDir, name);
      const createIfMissing = mode === DBInitType.create || typeof mode === 'undefined';

      await setupDB({
        sqliteConfig: { fullPath: fullPath },
        dbType: dbType,
        createIfMissing,
        postgresConfig: postgresConfig
      });
      res.json({ success: true });
    } catch (err) {
      res.status(500).json({ success: false, message: (err as Error).message });
    }
  });
};
