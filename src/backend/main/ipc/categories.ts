import { ipcMain } from 'electron';
import type { Database } from 'sqlite3';
import * as categoriesService from '../../shared/services/categories';
import type { Category } from '../../shared/types/category';

export const initCategoriesHandlers = (db: Database) => {
  ipcMain.handle('add-category', async (_event, data: Category) => categoriesService.addCategory(db, data));
  ipcMain.handle('update-category', async (_event, data: Category) => categoriesService.updateCategory(db, data));
  ipcMain.handle('delete-category', async (_event, id: number) => categoriesService.deleteCategory(db, id));
  ipcMain.handle('batch-add-category', async (_event, data: Category[]) =>
    categoriesService.batchAddCategory(db, data)
  );
  ipcMain.handle('get-all-categories', async (_event, filter) => categoriesService.getAllCategories(db, filter));
};
