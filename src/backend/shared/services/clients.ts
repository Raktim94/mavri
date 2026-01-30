import type { Database } from 'sqlite3';
import type { Client } from '../types/client';
import type { FilterData } from '../types/invoiceFilter';
import { runDb } from '../utils/dbFuntions';
import { getAllEntities, handleEntity } from '../utils/entitiesFunctions';
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

export const getAllClients = async (db: Database, filter?: FilterData[]) => {
  const getAll = getAllEntities(db, 'clients', 'clientId');
  return getAll(filter ?? []);
};

export const addClient = async (db: Database, data: Client) => {
  const handle = handleEntity<Client>(db, 'clients', clientFields);
  return handle(data);
};

export const updateClient = async (db: Database, data: Client) => {
  const handle = handleEntity<Client>(db, 'clients', clientFields);
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
  const handle = handleEntity<Client>(db, 'clients', clientFields);
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
