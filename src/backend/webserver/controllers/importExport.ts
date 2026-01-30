import { type Express, type Request, type Response } from 'express';
import type { Database } from 'sqlite3';
import * as importExportService from '../../shared/services/importExport';

export const initImportExportController = (app: Express, db: Database) => {
  app.get('/api/export', async (_req: Request, res: Response) => {
    const result = await importExportService.exportAllData(db!);
    res.json(result);
  });
  app.post('/api/import', async (req: Request, res: Response) => {
    const result = await importExportService.importAllData(db!, req.body);
    res.json(result);
  });
};
