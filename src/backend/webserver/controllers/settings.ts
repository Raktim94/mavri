import { type Express, type Request, type Response } from 'express';
import * as settingsService from '../../shared/services/settings';
import { requireDB } from '../utils/functions';
import { dbInstance } from './database';

export const initSettingsController = (app: Express) => {
  app.get('/api/settings', requireDB, async (_req: Request, res: Response) => {
    const result = await settingsService.getAllSettings(dbInstance!);
    res.json(result);
  });
  app.put('/api/settings', requireDB, async (req: Request, res: Response) => {
    const result = await settingsService.updateSettings(dbInstance!, req.body);
    res.json(result);
  });
};
