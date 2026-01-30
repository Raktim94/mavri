import type { Database } from 'sqlite3';
import type { Item } from '../../shared/types/item';
import { getFirstRow, runDb } from './dbFuntions';

export const getOrCreateByName = async (
  db: Database,
  table: 'units' | 'categories',
  name: string
): Promise<number | undefined> => {
  const row = await getFirstRow(db, `SELECT id FROM ${table} WHERE name = ? LIMIT 1`, [name]);
  if (row?.id) return row.id as number;

  await runDb(db, `INSERT INTO ${table} (name) VALUES (?)`, [name]);

  const newRow = await getFirstRow(db, `SELECT id FROM ${table} WHERE name = ? LIMIT 1`, [name]);
  if (newRow?.id) return newRow.id as number;

  return undefined;
};

export const resolveItemRelations = async (db: Database, data: Item): Promise<Item> => {
  const item = { ...data };

  if (typeof item.categoryId === 'undefined' && item.categoryName) {
    item.categoryId = await getOrCreateByName(db, 'categories', item.categoryName);
  }
  if (typeof item.unitId === 'undefined' && item.unitName) {
    item.unitId = await getOrCreateByName(db, 'units', item.unitName);
  }

  return item;
};
