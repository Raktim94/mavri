import { ipcMain } from 'electron';
import type { Database } from 'sqlite3';
import type { Unit } from '../types/unit';
import { getAllRows, runDb } from '../utils/dbFuntions';
import { handleEntity } from '../utils/entitiesFunctions';
import { mapSqliteError } from '../utils/errorFunctions';
import { getHavingClauseFromFilters } from '../utils/filterFunctions';

export const initUnitsHandlers = (db: Database) => {
  const unitFields: (keyof Unit)[] = ['name', 'isArchived'];
  const handleUnits = handleEntity<Unit>(db, 'units', unitFields);

  ipcMain.handle('add-unit', async (_event, data: Unit) => handleUnits(data));
  ipcMain.handle('update-unit', async (_event, data: Unit) => handleUnits(data, true));
  ipcMain.handle('delete-unit', async (_event, id: number) => {
    try {
      await runDb(db, 'DELETE FROM units WHERE id = ?;', [id]);
      return { success: true };
    } catch (error) {
      return { success: false, ...mapSqliteError(error) };
    }
  });
  ipcMain.handle('batch-add-unit', async (_event, data: Unit[]) => {
    try {
      await runDb(db, 'BEGIN TRANSACTION');
      for (const row of data) {
        const result = await handleUnits(row);
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
  ipcMain.handle('get-all-units', async (_event, filter) => {
    const havingClause = getHavingClauseFromFilters({
      filters: filter,
      invoiceUpdatedAtColumn: 'inv.updatedAt',
      invoiceIdColumn: 'inv.id',
      archivedColumn: 'u.isArchived'
    });

    const sql = `
       SELECT
           u.*,
           COUNT(DISTINCT CASE WHEN inv.invoiceType = 'invoice' THEN ii.parentInvoiceId END) AS invoiceCount,
           COUNT(DISTINCT CASE WHEN inv.invoiceType = 'quotation' THEN ii.parentInvoiceId END) AS quotesCount
       FROM units u
       LEFT JOIN items it ON it.unitId = u.id
       LEFT JOIN invoice_items ii ON ii.itemId = it.id
       LEFT JOIN invoices inv ON ii.parentInvoiceId = inv.id
       GROUP BY u.id
       ${havingClause ? havingClause : ''}
       ORDER BY u.createdAt DESC
     `;
    return {
      success: true,
      data: await getAllRows(db, sql)
    };
  });
};
