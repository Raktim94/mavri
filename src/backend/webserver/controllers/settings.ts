import { type Express, type Request, type Response } from 'express';
import type { Database } from 'sqlite3';
import * as settingsService from '../../shared/services/settings';

export const initSettingsController = (app: Express, db: Database) => {
  app.get('/api/settings', async (_req: Request, res: Response) => {
    const result = await settingsService.getAllSettings(db);
    res.json(result);
  });
  app.put('/api/settings', async (req: Request, res: Response) => {
    const result = await settingsService.updateSettings(db, req.body);
    res.json(result);
  });
};
