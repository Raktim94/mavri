import type { Database } from 'sqlite3';
import type { Category } from '../types/category';
import type { FilterData } from '../types/invoiceFilter';
import { runDb } from '../utils/dbFuntions';
import { getAllEntities, handleEntity } from '../utils/entitiesFunctions';
import { mapSqliteError } from '../utils/errorFunctions';

const categoryFields: (keyof Category)[] = ['name', 'isArchived'];

export const getAllCategories = async (db: Database, filter?: FilterData[]) => {
  const getAll = getAllEntities<Category>(db, 'categories', 'c', 'inv', {
    joins: `
        LEFT JOIN items it ON it.categoryId = c.id
        LEFT JOIN invoice_items ii ON ii.itemId = it.id
        LEFT JOIN invoices inv ON ii.parentInvoiceId = inv.id
      `,
    invoiceCountExpr: `
        COUNT(DISTINCT CASE WHEN inv.invoiceType = 'invoice'
          THEN ii.parentInvoiceId END)
      `,
    quotesCountExpr: `
        COUNT(DISTINCT CASE WHEN inv.invoiceType = 'quotation'
          THEN ii.parentInvoiceId END)
      `
  });
  return getAll(filter ?? []);
};

export const addCategory = async (db: Database, data: Category) => {
  const handle = handleEntity<Category>(db, 'categories', 'c', categoryFields, {
    joins: `
          LEFT JOIN items it ON it.categoryId = c.id
          LEFT JOIN invoice_items ii ON ii.itemId = it.id
          LEFT JOIN invoices inv ON ii.parentInvoiceId = inv.id
        `,
    invoiceCountExpr: `
          COUNT(DISTINCT CASE WHEN inv.invoiceType = 'invoice'
            THEN ii.parentInvoiceId END)
        `,
    quotesCountExpr: `
          COUNT(DISTINCT CASE WHEN inv.invoiceType = 'quotation'
            THEN ii.parentInvoiceId END)
        `
  });
  return handle(data);
};

export const updateCategory = async (db: Database, data: Category) => {
  const handle = handleEntity<Category>(db, 'categories', 'c', categoryFields, {
    joins: `
          LEFT JOIN items it ON it.categoryId = c.id
          LEFT JOIN invoice_items ii ON ii.itemId = it.id
          LEFT JOIN invoices inv ON ii.parentInvoiceId = inv.id
        `,
    invoiceCountExpr: `
          COUNT(DISTINCT CASE WHEN inv.invoiceType = 'invoice'
            THEN ii.parentInvoiceId END)
        `,
    quotesCountExpr: `
          COUNT(DISTINCT CASE WHEN inv.invoiceType = 'quotation'
            THEN ii.parentInvoiceId END)
        `
  });
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
  const handle = handleEntity<Category>(db, 'categories', 'c', categoryFields, {
    joins: `
          LEFT JOIN items it ON it.categoryId = c.id
          LEFT JOIN invoice_items ii ON ii.itemId = it.id
          LEFT JOIN invoices inv ON ii.parentInvoiceId = inv.id
        `,
    invoiceCountExpr: `
          COUNT(DISTINCT CASE WHEN inv.invoiceType = 'invoice'
            THEN ii.parentInvoiceId END)
        `,
    quotesCountExpr: `
          COUNT(DISTINCT CASE WHEN inv.invoiceType = 'quotation'
            THEN ii.parentInvoiceId END)
        `
  });
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
