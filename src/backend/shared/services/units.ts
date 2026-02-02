import type { Database } from 'sqlite3';
import type { FilterData } from '../types/invoiceFilter';
import type { Unit } from '../types/unit';
import { runDb } from '../utils/dbFuntions';
import { getAllEntities, handleEntity } from '../utils/entitiesFunctions';
import { mapSqliteError } from '../utils/errorFunctions';

const unitFields: (keyof Unit)[] = ['name', 'isArchived'];

export const getAllUnits = async (db: Database, filter?: FilterData[]) => {
  const getAll = getAllEntities<Unit>(db, 'units', 'u', {
    joins: `
      LEFT JOIN items it ON it.unitId = u.id
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

export const addUnit = async (db: Database, data: Unit) => {
  const handle = handleEntity<Unit>(db, 'units', 'u', unitFields, {
    joins: `
        LEFT JOIN items it ON it.unitId = u.id
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

export const updateUnit = async (db: Database, data: Unit) => {
  const handle = handleEntity<Unit>(db, 'units', 'u', unitFields, {
    joins: `
        LEFT JOIN items it ON it.unitId = u.id
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

export const deleteUnit = async (db: Database, id: number) => {
  try {
    await runDb(db, 'DELETE FROM units WHERE id = ?;', [id]);
    return { success: true };
  } catch (error) {
    return { success: false, ...mapSqliteError(error) };
  }
};

export const batchAddUnit = async (db: Database, data: Unit[]) => {
  const handle = handleEntity<Unit>(db, 'units', 'u', unitFields, {
    joins: `
        LEFT JOIN items it ON it.unitId = u.id
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
