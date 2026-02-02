import type { Database } from 'sqlite3';
import type { Business } from '../types/business';
import type { EntityWithCounts } from '../types/entityWithCounts';
import type { FilterData } from '../types/invoiceFilter';
import type { Response } from '../types/response';
import { runDb } from '../utils/dbFuntions';
import { getAllEntities2, handleEntity2 } from '../utils/entitiesFunctions';
import { mapSqliteError } from '../utils/errorFunctions';

const businessFields: (keyof Business)[] = [
  'name',
  'shortName',
  'address',
  'role',
  'email',
  'phone',
  'website',
  'additional',
  'paymentInformation',
  'logo',
  'fileSize',
  'fileType',
  'fileName',
  'description',
  'isArchived'
];

export const getAllBusinesses = (
  db: Database,
  filter?: FilterData[]
): Promise<Response<(Business & EntityWithCounts)[]>> => {
  const getAll = getAllEntities2<Business>(db, 'businesses', 't', {
    joins: `
      LEFT JOIN invoices i ON i.businessId = t.id
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

export const addBusiness = (db: Database, data: Business): Promise<Response<Business & EntityWithCounts>> => {
  const handle = handleEntity2<Business>(db, 'businesses', 'b', businessFields, {
    joins: `LEFT JOIN invoices i ON i.businessId = b.id`,
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

export const updateBusiness = (db: Database, data: Business): Promise<Response<Business & EntityWithCounts>> => {
  const handle = handleEntity2<Business>(db, 'businesses', 'b', businessFields, {
    joins: `LEFT JOIN invoices i ON i.businessId = b.id`,
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

export const deleteBusiness = async (db: Database, id: number) => {
  try {
    await runDb(db, 'DELETE FROM businesses WHERE id = ?;', [id]);
    return { success: true };
  } catch (error) {
    return { success: false, ...mapSqliteError(error) };
  }
};

export const batchAddBusiness = async (db: Database, data: Business[]) => {
  const handle = handleEntity2<Business>(db, 'businesses', 'b', businessFields, {
    joins: `LEFT JOIN invoices i ON i.businessId = b.id`,
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
