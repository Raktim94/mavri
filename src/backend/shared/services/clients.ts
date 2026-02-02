import type { Database } from 'sqlite3';
import type { Client } from '../types/client';
import type { EntityWithCounts } from '../types/entityWithCounts';
import type { FilterData } from '../types/invoiceFilter';
import type { Response } from '../types/response';
import { runDb } from '../utils/dbFuntions';
import { getAllEntities2, handleEntity2 } from '../utils/entitiesFunctions';
import { mapSqliteError } from '../utils/errorFunctions';

const clientFields: (keyof Client)[] = [
  'name',
  'shortName',
  'address',
  'email',
  'phone',
  'code',
  'additional',
  'description',
  'isArchived'
];

export const getAllClients = async (
  db: Database,
  filter?: FilterData[]
): Promise<Response<(Client & EntityWithCounts)[]>> => {
  const getAll = getAllEntities2<Client>(db, 'clients', 't', {
    joins: `
        LEFT JOIN invoices i ON i.clientId = t.id
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

export const addClient = async (db: Database, data: Client): Promise<Response<Client & EntityWithCounts>> => {
  const handle = handleEntity2<Client>(db, 'clients', 'c', clientFields, {
    joins: `LEFT JOIN invoices i ON i.clientId = c.id`,
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

export const updateClient = async (db: Database, data: Client): Promise<Response<Client & EntityWithCounts>> => {
  const handle = handleEntity2<Client>(db, 'clients', 'c', clientFields, {
    joins: `LEFT JOIN invoices i ON i.clientId = c.id`,
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

export const deleteClient = async (db: Database, id: number) => {
  try {
    await runDb(db, 'DELETE FROM clients WHERE id = ?;', [id]);
    return { success: true };
  } catch (error) {
    return { success: false, ...mapSqliteError(error) };
  }
};

export const batchAddClient = async (db: Database, data: Client[]) => {
  const handle = handleEntity2<Client>(db, 'clients', 'c', clientFields, {
    joins: `LEFT JOIN invoices i ON i.clientId = c.id`,
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
