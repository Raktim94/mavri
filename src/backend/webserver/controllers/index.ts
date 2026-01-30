import { type Express } from 'express';
import type { Database } from 'sqlite3';
import { initBusinessesController } from './businesses';
import { initCategoriesController } from './categories';
import { initClientsController } from './clients';
import { initImportExportController } from './importExport';
import { initInvoicesController } from './invoices';
import { initItemsController } from './items';
import { initSettingsController } from './settings';
import { initStyleProfilesController } from './styleProfiles';
import { initUnitsController } from './units';

export const initControllers = (app: Express, db: Database) => {
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
