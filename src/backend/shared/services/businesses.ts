import type { Database } from 'sqlite3';
import type { Business } from '../types/business';
import type { FilterData } from '../types/invoiceFilter';
import { runDb } from '../utils/dbFuntions';
import { getAllEntities, handleEntity } from '../utils/entitiesFunctions';
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

export const getAllBusinesses = (db: Database, filter?: FilterData[]) => {
  const getAll = getAllEntities(db, 'businesses', 'businessId');
  return getAll(filter ?? []);
};

export const addBusiness = (db: Database, data: Business) => {
  const handle = handleEntity<Business>(db, 'businesses', businessFields);
  return handle(data);
};

export const updateBusiness = (db: Database, data: Business) => {
  const handle = handleEntity<Business>(db, 'businesses', businessFields);
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
  const handle = handleEntity<Business>(db, 'businesses', businessFields);
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
