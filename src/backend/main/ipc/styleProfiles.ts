import { ipcMain } from 'electron';
import type { Database } from 'sqlite3';
import * as styleProfilesService from '../../shared/services/styleProfiles';
import type { StyleProfile } from '../../shared/types/styleProfiles';

export const initStyleProfilesHandlers = (db: Database) => {
  ipcMain.handle('add-styleProfile', async (_event, data: StyleProfile) =>
    styleProfilesService.addStyleProfile(db, data)
  );
  ipcMain.handle('update-styleProfile', async (_event, data: StyleProfile) =>
    styleProfilesService.updateStyleProfile(db, data)
  );
  ipcMain.handle('delete-styleProfile', async (_event, id: number) => styleProfilesService.deleteStyleProfile(db, id));
  ipcMain.handle('batch-add-styleProfile', async (_event, data: StyleProfile[]) =>
    styleProfilesService.batchAddStyleProfile(db, data)
  );
  ipcMain.handle('get-all-styleProfiles', async (_event, filter) =>
    styleProfilesService.getAllStyleProfiles(db, filter)
  );
};
