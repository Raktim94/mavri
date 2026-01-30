import type { Database } from 'sqlite3';
import type { Category } from '../types/category';
import type { FilterData } from '../types/invoiceFilter';
import { getAllRows, runDb } from '../utils/dbFuntions';
import { handleEntity } from '../utils/entitiesFunctions';
import { mapSqliteError } from '../utils/errorFunctions';
import { getHavingClauseFromFilters } from '../utils/filterFunctions';

const categoryFields: (keyof Category)[] = ['name', 'isArchived'];

export const getAllCategories = async (db: Database, filter?: FilterData[]) => {
  const havingClause = getHavingClauseFromFilters({
    filters: filter ?? [],
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

  const data = await getAllRows(db, sql);
  return { success: true, data };
};

export const addCategory = async (db: Database, data: Category) => {
  const handle = handleEntity<Category>(db, 'categories', categoryFields);
  return handle(data);
};

export const updateCategory = async (db: Database, data: Category) => {
  const handle = handleEntity<Category>(db, 'categories', categoryFields);
  return handle(data, true);
};

export const deleteCategory = async (db: Database, id: number) => {
  try {
    await runDb(db, 'DELETE FROM categories WHERE id = ?;', [id]);
    return { success: true };
  } catch (error) {
    return { success: false, ...mapSqliteError(error) };
  }
};

export const batchAddCategory = async (db: Database, data: Category[]) => {
  const handle = handleEntity<Category>(db, 'categories', categoryFields);
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
