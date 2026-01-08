import { ipcMain } from 'electron';
import type { Database } from 'sqlite3';
import type { Item } from '../types/item';
import { getAllRows, runDb } from '../utils/dbFuntions';
import { handleEntity } from '../utils/entitiesFunctions';
import { mapSqliteError } from '../utils/errorFunctions';
import { getHavingClauseFromFilters } from '../utils/filterFunctions';
import { resolveItemRelations } from '../utils/relationsFunctions';

export const initItemsHandlers = (db: Database) => {
  const itemFields: (keyof Item)[] = ['name', 'amount', 'unitId', 'categoryId', 'description', 'isArchived'];
  const handleItems = handleEntity<Item>(db, 'items', itemFields);

  ipcMain.handle('add-item', async (_event, data: Item) => handleItems(data));
  ipcMain.handle('update-item', async (_event, data: Item) => handleItems(data, true));
  ipcMain.handle('delete-item', async (_event, id: number) => {
    try {
      await runDb(db, 'DELETE FROM items WHERE id = ?;', [id]);
      return { success: true };
    } catch (error) {
      return { success: false, ...mapSqliteError(error) };
    }
  });
  ipcMain.handle('batch-add-item', async (_event, data: Item[]) => {
    try {
      await runDb(db, 'BEGIN TRANSACTION');
      for (const row of data) {
        const finalItem = await resolveItemRelations(db, row);
        const result = await handleItems(finalItem);
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
  ipcMain.handle('get-all-items', async (_event, filter) => {
    const havingClause = getHavingClauseFromFilters({
      filters: filter,
      invoiceUpdatedAtColumn: 'inv.updatedAt',
      invoiceIdColumn: 'inv.id',
      archivedColumn: 'it.isArchived'
    });

    const sql = `
     SELECT 
         it.*,
         COUNT(DISTINCT CASE WHEN inv.invoiceType = 'invoice' THEN ii.parentInvoiceId END) AS invoiceCount,
         COUNT(DISTINCT CASE WHEN inv.invoiceType = 'quotation' THEN ii.parentInvoiceId END) AS quotesCount,
         u.name AS unitName,
         c.name AS categoryName
     FROM items it
     LEFT JOIN units u ON it.unitId = u.id
     LEFT JOIN categories c ON it.categoryId = c.id
     LEFT JOIN invoice_items ii ON ii.itemId = it.id
     LEFT JOIN invoices inv ON ii.parentInvoiceId = inv.id
     GROUP BY it.id
     ${havingClause ? havingClause : ''}
     ORDER BY it.createdAt DESC
     `;

    return {
      success: true,
      data: await getAllRows(db, sql)
    };
  });
};
