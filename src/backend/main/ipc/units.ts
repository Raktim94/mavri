import { ipcMain } from 'electron';
import type { Database } from 'sqlite3';
import * as unitsService from '../../shared/services/units';
import type { Unit } from '../../shared/types/unit';

export const initUnitsHandlers = (db: Database) => {
  ipcMain.handle('add-unit', async (_event, data: Unit) => unitsService.addUnit(db, data));
  ipcMain.handle('update-unit', async (_event, data: Unit) => unitsService.updateUnit(db, data));
  ipcMain.handle('delete-unit', async (_event, id: number) => unitsService.deleteUnit(db, id));
  ipcMain.handle('batch-add-unit', async (_event, data: Unit[]) => unitsService.batchAddUnit(db, data));
  ipcMain.handle('get-all-units', async (_event, filter) => unitsService.getAllUnits(db, filter));
};
