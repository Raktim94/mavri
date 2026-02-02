import type { Database } from 'sqlite3';
import type { Currency } from '../types/currency';
import type { EntityWithCounts } from '../types/entityWithCounts';
import type { FilterData } from '../types/invoiceFilter';
import type { Response } from '../types/response';
import { runDb } from '../utils/dbFuntions';
import { getAllEntities, handleEntity } from '../utils/entitiesFunctions';
import { mapSqliteError } from '../utils/errorFunctions';

const currencyFields: (keyof Currency)[] = ['code', 'symbol', 'text', 'format', 'isArchived', 'subunit'];

export const getAllCurrencies = async (
  db: Database,
  filter?: FilterData[]
): Promise<Response<(Currency & EntityWithCounts)[]>> => {
  const getAll = getAllEntities<Currency>(db, 'currencies', 't', {
    joins: `
        LEFT JOIN invoices i ON i.currencyId = t.id
      `,
    invoiceCountExpr: `
        COUNT(DISTINCT CASE WHEN i.invoiceType = 'invoice'
          THEN i.id END)
      `,
    quotesCountExpr: `
        COUNT(DISTINCT CASE WHEN i.invoiceType = 'quotation'
          THEN i.id END)
      `
  });
  return getAll(filter ?? []);
};

export const addCurrency = async (db: Database, data: Currency): Promise<Response<Currency & EntityWithCounts>> => {
  const handle = handleEntity<Currency>(db, 'currencies', 'c', currencyFields, {
    joins: `LEFT JOIN invoices i ON i.currencyId = c.id`,
    invoiceCountExpr: `
         COUNT(DISTINCT CASE WHEN i.invoiceType = 'invoice'
           THEN i.id END)
       `,
    quotesCountExpr: `
         COUNT(DISTINCT CASE WHEN i.invoiceType = 'quotation'
           THEN i.id END)
       `
  });
  return handle(data);
};

export const updateCurrency = async (db: Database, data: Currency): Promise<Response<Currency & EntityWithCounts>> => {
  const handle = handleEntity<Currency>(db, 'currencies', 'c', currencyFields, {
    joins: `LEFT JOIN invoices i ON i.currencyId = c.id`,
    invoiceCountExpr: `
         COUNT(DISTINCT CASE WHEN i.invoiceType = 'invoice'
           THEN i.id END)
       `,
    quotesCountExpr: `
         COUNT(DISTINCT CASE WHEN i.invoiceType = 'quotation'
           THEN i.id END)
       `
  });
  return handle(data, true);
};

export const deleteCurrency = async (db: Database, id: number) => {
  try {
    await runDb(db, 'DELETE FROM currencies WHERE id = ?;', [id]);
    return { success: true };
  } catch (error) {
    return { success: false, ...mapSqliteError(error) };
  }
};

export const batchAddCurrency = async (db: Database, data: Currency[]) => {
  const handle = handleEntity<Currency>(db, 'currencies', 'c', currencyFields, {
    joins: `LEFT JOIN invoices i ON i.currencyId = c.id`,
    invoiceCountExpr: `
         COUNT(DISTINCT CASE WHEN i.invoiceType = 'invoice'
           THEN i.id END)
       `,
    quotesCountExpr: `
         COUNT(DISTINCT CASE WHEN i.invoiceType = 'quotation'
           THEN i.id END)
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
