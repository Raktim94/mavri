import sqlite3 from 'sqlite3';
import { BOOLEAN_FIELDS } from '../constant';
import type { SqliteValue } from '../types/sqliteValue';
import type { UpdateData } from '../types/updateData';

export const runAsync = (db: sqlite3.Database, sql: string) =>
  new Promise<void>((resolve, reject) => {
    db.run(sql, err => (err ? reject(err) : resolve()));
  });

export const runDb = (db: sqlite3.Database, sql: string, params: SqliteValue[] = []): Promise<number> => {
  const convertedParams = params.map(p => (p === true ? 1 : p === false ? 0 : p));

  return new Promise((resolve, reject) => {
    db.run(sql, convertedParams, function (err) {
      if (err) reject(err);
      else resolve(this.lastID);
    });
  });
};

export const getFirstRow = <T extends Record<string, unknown>>(
  db: sqlite3.Database,
  sql: string,
  params: SqliteValue[] = []
): Promise<T | null> => {
  const convertedParams = params.map(p => (p === true ? 1 : p === false ? 0 : p));

  return new Promise((resolve, reject) => {
    db.get(sql, convertedParams, (err, row) => {
      if (err) return reject(err);
      if (!row) return resolve(null);

      BOOLEAN_FIELDS.forEach(key => {
        const convertedRow = row as Record<string, unknown>;
        if (key in convertedRow) {
          convertedRow[key] = Boolean(convertedRow[key]);
        }
      });

      resolve(row as T);
    });
  });
};

export const getAllRows = <T extends Record<string, unknown>>(
  db: sqlite3.Database,
  sql: string,
  params: SqliteValue[] = []
): Promise<T[]> => {
  const convertedParams = params.map(p => (p === true ? 1 : p === false ? 0 : p));

  return new Promise((resolve, reject) => {
    db.all(sql, convertedParams, (err, rows) => {
      if (err) return reject(err);

      const transformedRows = (rows as Record<string, unknown>[]).map(row => {
        const convertedRow = { ...row };
        BOOLEAN_FIELDS.forEach(key => {
          if (key in convertedRow) {
            convertedRow[key] = Boolean(convertedRow[key]);
          }
        });
        return convertedRow as unknown as T;
      });

      resolve(transformedRows as T[]);
    });
  });
};

export const toSqliteValue = (value: unknown): SqliteValue => {
  if (value === undefined || value === null) return null;
  if (Buffer.isBuffer(value)) return value;
  if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') return value;
  return JSON.stringify(value);
};

export const prepareUpdate = (data: UpdateData, id?: number) => {
  const fields: string[] = [];
  const params: (string | number | null)[] = [];

  Object.entries(data).forEach(([key, value]) => {
    if (value !== undefined) {
      fields.push(`${key} = ?`);

      let param: string | number | null;

      if (typeof value === 'boolean') param = value ? 1 : 0;
      else if (value === null) param = null;
      else if (typeof value === 'string' || typeof value === 'number') param = value;
      else throw new Error(`Unsupported value type for key "${key}"`);

      params.push(param);
    }
  });

  if (id != null) params.push(id);

  return { fields, params };
};
