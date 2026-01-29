import { ipcMain } from 'electron';
import type { Database } from 'sqlite3';
import type { StyleProfile } from '../../renderer/shared/types/styleProfiles';
import { runDb } from '../utils/dbFuntions';
import { getAllEntities, handleEntity } from '../utils/entitiesFunctions';
import { mapSqliteError } from '../utils/errorFunctions';

export const initStyleProfilesHandlers = (db: Database) => {
  const styleProfileFields: (keyof StyleProfile)[] = [
    'name',
    'customizationColor',
    'customizationLogoSize',
    'customizationFontSizeSize',
    'customizationLayout',
    'customizationTableHeaderStyle',
    'customizationTableRowStyle',
    'customizationPageFormat',
    'customizationLabelUpperCase',
    'customizationWatermarkFileName',
    'customizationWatermarkFileType',
    'customizationWatermarkFileSize',
    'customizationWatermarkFileData',
    'customizationPaidWatermarkFileName',
    'customizationPaidWatermarkFileType',
    'customizationPaidWatermarkFileSize',
    'customizationPaidWatermarkFileData',
    'isArchived'
  ];
  const handleStyleProfile = handleEntity<StyleProfile>(db, 'style_profiles', styleProfileFields);
  const getAllStyleProfiles = getAllEntities(db, 'style_profiles', 'styleProfilesId');

  ipcMain.handle('add-styleProfile', async (_event, data: StyleProfile) => handleStyleProfile(data));
  ipcMain.handle('update-styleProfile', async (_event, data: StyleProfile) => handleStyleProfile(data, true));
  ipcMain.handle('delete-styleProfile', async (_event, id: number) => {
    try {
      await runDb(db, 'DELETE FROM styleProfile WHERE id = ?;', [id]);
      return { success: true };
    } catch (error) {
      return { success: false, ...mapSqliteError(error) };
    }
  });
  ipcMain.handle('batch-add-styleProfile', async (_event, data: StyleProfile[]) => {
    try {
      await runDb(db, 'BEGIN TRANSACTION');
      for (const row of data) {
        const result = await handleStyleProfile(row);
        if (!result.success) {
          await runDb(db, 'ROLLBACK');
          return result;
        }
      }
      await runDb(db, 'COMMIT');
      return { success: true };
    } catch (error) {
      await runDb(db, 'ROLLBACK');
      return { success: false, ...mapSqliteError(error) };
    }
  });
  ipcMain.handle('get-all-styleProfiles', async (_event, filter) => getAllStyleProfiles(filter));
};
