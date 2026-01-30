import { type Express, type Request, type Response } from 'express';
import fs from 'fs';
import path from 'path';
import type { Database } from 'sqlite3';
import { getDistPath } from '../utils/functions';
import { initBusinessesController } from './businesses';
import { initCategoriesController } from './categories';
import { initClientsController } from './clients';
import { initImportExportController } from './importExport';
import { initInvoicesController } from './invoices';
import { initItemsController } from './items';
import { initSettingsController } from './settings';
import { initStyleProfilesController } from './styleProfiles';
import { initUnitsController } from './units';

const distPath = getDistPath();

const getVersion = () => {
  try {
    const pkg = JSON.parse(fs.readFileSync(path.resolve(__dirname, '..', 'package.json'), 'utf8'));
    return pkg.version ?? '0.0.0';
  } catch {
    return '0.0.0';
  }
};

export const initControllers = (app: Express, db: Database) => {
  app.get('*', (_req: Request, res: Response) => {
    res.sendFile(path.join(distPath, 'index.html'));
  });
  app.get('/api/version', (_req: Request, res: Response) => {
    res.json({ version: getVersion() });
  });
  app.get('/api/health', (_req: Request, res: Response) => {
    res.json({ ok: true, db: !!db });
  });

  initImportExportController(app, db);
  initBusinessesController(app, db);
  initCategoriesController(app, db);
  initClientsController(app, db);
  initInvoicesController(app, db);
  initItemsController(app, db);
  initSettingsController(app, db);
  initStyleProfilesController(app, db);
  initUnitsController(app, db);
};
