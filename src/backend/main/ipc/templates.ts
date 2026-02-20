import { ipcMain } from 'electron';
import * as templatesService from '../../shared/services/templates';
import type { DatabaseAdapter } from '../../shared/types/DatabaseAdapter';
import type { Template } from '../../shared/types/template';

export const initTemplatesHandlers = (db: DatabaseAdapter) => {
  ipcMain.handle('add-template', async (_event, data: Template) => templatesService.addTemplate(db, data));
  ipcMain.handle('update-template', async (_event, data: Template) => templatesService.updateTemplate(db, data));
  ipcMain.handle('delete-template', async (_event, id: number) => templatesService.deleteTemplate(db, id));
  ipcMain.handle('batch-add-template', async (_event, data: Template[]) => templatesService.batchAddTemplate(db, data));
  ipcMain.handle('get-all-templates', async (_event, filter) => templatesService.getAllTemplates(db, filter));
};
