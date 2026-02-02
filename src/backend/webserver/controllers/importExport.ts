import { type Express, type Request, type Response } from 'express';
import * as importExportService from '../../shared/services/importExport';
import { requireDB } from '../utils/functions';
import { dbInstance } from './database';

export const initImportExportController = (app: Express) => {
  app.get('/api/export', requireDB, async (_req: Request, res: Response) => {
    const result = await importExportService.exportAllData(dbInstance!);
    res.json(result);
  });
  app.post('/api/import', requireDB, async (req: Request, res: Response) => {
    const result = await importExportService.importAllData(dbInstance!, req.body);
    res.json(result);
  });
};
