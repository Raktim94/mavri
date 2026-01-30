import type { Database } from 'sqlite3';
import type { FilterData } from '../types/invoiceFilter';
import type { Unit } from '../types/unit';
import { getAllRows, runDb } from '../utils/dbFuntions';
import { handleEntity } from '../utils/entitiesFunctions';
import { mapSqliteError } from '../utils/errorFunctions';
import { getHavingClauseFromFilters } from '../utils/filterFunctions';

const unitFields: (keyof Unit)[] = ['name', 'isArchived'];

export const getAllUnits = async (db: Database, filter?: FilterData[]) => {
  const havingClause = getHavingClauseFromFilters({
    filters: filter ?? [],
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
  const data = await getAllRows(db, sql);
  return { success: true, data };
};

export const addUnit = async (db: Database, data: Unit) => {
  const handle = handleEntity<Unit>(db, 'units', unitFields);
  return handle(data);
};

export const updateUnit = async (db: Database, data: Unit) => {
  const handle = handleEntity<Unit>(db, 'units', unitFields);
  return handle(data, true);
};

export const deleteUnit = async (db: Database, id: number) => {
  try {
    await runDb(db, 'DELETE FROM units WHERE id = ?;', [id]);
    return { success: true };
  } catch (error) {
    return { success: false, ...mapSqliteError(error) };
  }
};

export const batchAddUnit = async (db: Database, data: Unit[]) => {
  const handle = handleEntity<Unit>(db, 'units', unitFields);
  try {
    await runDb(db, 'BEGIN TRANSACTION');
    for (const row of data) {
      const result = await handle(row);
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
};
