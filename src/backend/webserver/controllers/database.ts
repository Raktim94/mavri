import { type Express, type Request, type Response } from 'express';
import fsPromise from 'fs/promises';
import path from 'path';
import { testPostgresConnection } from '../../shared/db/setup';
import { DatabaseType } from '../../shared/enums/databaseType';
import { DBInitType } from '../../shared/enums/dbInitType';
import { APP_CONFIG } from '../config';
import { setupDB } from '../database';
import { requireAuthOnceConfigured } from '../middleware/auth';
import { listDbLimiter } from '../utils/functions';

export const dbDir = path.resolve(process.cwd(), process.env.DB_DIRECTORY || APP_CONFIG.DB_DIRECTORY);

// Keeps the resolved database file path inside dbDir, so a name like
// "../../etc/cron.d/evil" can't make the server create or open a file
// anywhere else on disk.
const resolveDbFileName = (name: string): string | null => {
  const resolved = path.resolve(dbDir, name);
  const relative = path.relative(dbDir, resolved);
  if (relative.startsWith('..') || path.isAbsolute(relative)) return null;
  return resolved;
};

export const initDatabaseController = (app: Express) => {
  app.get('/api/databases', listDbLimiter, requireAuthOnceConfigured, async (_req: Request, res: Response) => {
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
  app.post('/api/databases/test', listDbLimiter, requireAuthOnceConfigured, async (req: Request, res: Response) => {
    try {
      const postgresConfig = req.body;

      if (postgresConfig.host === 'localhost') {
        postgresConfig.host = 'host.docker.internal';
      }

      await testPostgresConnection(postgresConfig);
      res.json({ success: true });
    } catch (err) {
      res.status(500).json({ success: false, message: (err as Error).message });
    }
  });
  app.post('/api/databases', listDbLimiter, requireAuthOnceConfigured, async (req: Request, res: Response) => {
    try {
      const name = String(req.body?.fullPath ?? '');
      const mode = String(req.body?.mode ?? '');
      const dbType = req.body?.dbType ?? DatabaseType.sqlite;
      const postgresConfig = req.body?.postgresConfig;
      const createIfMissing = mode === DBInitType.create || typeof mode === 'undefined';

      const fullPath = dbType === DatabaseType.sqlite ? (resolveDbFileName(name) ?? undefined) : undefined;
      if (dbType === DatabaseType.sqlite && !fullPath) {
        res.status(400).json({ success: false, message: undefined, key: 'error.invalidDBName' });
        return;
      }

      if (process.env.NODE_ENV === 'docker' && postgresConfig && postgresConfig.host === 'localhost') {
        postgresConfig.host = 'host.docker.internal';
      }

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
