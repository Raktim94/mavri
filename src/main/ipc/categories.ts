import { ipcMain } from 'electron';
import type { Database } from 'sqlite3';
import type { Category } from '../types/category';
import { getAllRows, runDb } from '../utils/dbFuntions';
import { handleEntity } from '../utils/entitiesFunctions';
import { mapSqliteError } from '../utils/errorFunctions';
import { getHavingClauseFromFilters } from '../utils/filterFunctions';

export const initCategoriesHandlers = (db: Database) => {
  const categoryFields: (keyof Category)[] = ['name', 'isArchived'];
  const handleCategories = handleEntity<Category>(db, 'categories', categoryFields);

  ipcMain.handle('add-category', async (_event, data: Category) => handleCategories(data));
  ipcMain.handle('update-category', async (_event, data: Category) => handleCategories(data, true));
  ipcMain.handle('delete-category', async (_event, id: number) => {
    try {
      await runDb(db, 'DELETE FROM categories WHERE id = ?;', [id]);
      return { success: true };
    } catch (error) {
      return { success: false, ...mapSqliteError(error) };
    }
  });
  ipcMain.handle('batch-add-category', async (_event, data: Category[]) => {
    try {
      await runDb(db, 'BEGIN TRANSACTION');
      for (const row of data) {
        const result = await handleCategories(row);
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
  ipcMain.handle('get-all-categories', async (_event, filter) => {
    const havingClause = getHavingClauseFromFilters({
      filters: filter,
      invoiceUpdatedAtColumn: 'inv.updatedAt',
      invoiceIdColumn: 'inv.id',
      archivedColumn: 'c.isArchived'
    });

    const sql = `
      SELECT
          c.*,
          COUNT(DISTINCT CASE WHEN inv.invoiceType = 'invoice' THEN ii.parentInvoiceId END) AS invoiceCount,
          COUNT(DISTINCT CASE WHEN inv.invoiceType = 'quotation' THEN ii.parentInvoiceId END) AS quotesCount
      FROM categories c
      LEFT JOIN items it ON it.categoryId = c.id
      LEFT JOIN invoice_items ii ON ii.itemId = it.id
      LEFT JOIN invoices inv ON ii.parentInvoiceId = inv.id
      GROUP BY c.id
      ${havingClause ? havingClause : ''}
      ORDER BY c.createdAt DESC
    `;

    return {
      success: true,
      data: await getAllRows(db, sql)
    };
  });
};
