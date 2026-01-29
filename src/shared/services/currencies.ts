import type { Database } from 'sqlite3';
import type { Currency } from '../types/currency';
import type { FilterData } from '../types/invoiceFilter';
import { runDb } from '../utils/dbFuntions';
import { getAllEntities, handleEntity } from '../utils/entitiesFunctions';
import { mapSqliteError } from '../utils/errorFunctions';

const currencyFields: (keyof Currency)[] = ['code', 'symbol', 'text', 'format', 'isArchived', 'subunit'];

export const getAllCurrencies = async (db: Database, filter?: FilterData[]) => {
  const getAll = getAllEntities(db, 'currencies', 'currencyId');
  return getAll(filter ?? []);
};

export const addCurrency = async (db: Database, data: Currency) => {
  const handle = handleEntity<Currency>(db, 'currencies', currencyFields);
  return handle(data);
};

export const updateCurrency = async (db: Database, data: Currency) => {
  const handle = handleEntity<Currency>(db, 'currencies', currencyFields);
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
  const handle = handleEntity<Currency>(db, 'currencies', currencyFields);
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
