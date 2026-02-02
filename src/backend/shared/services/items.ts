import type { Database } from 'sqlite3';
import type { Response } from '../../shared/types/response';
import type { EntityWithCounts } from '../types/entityWithCounts';
import type { EntityWithId } from '../types/entityWithId';
import type { FilterData } from '../types/invoiceFilter';
import type { Item } from '../types/item';
import { getAllRows, getFirstRow, runDb } from '../utils/dbFuntions';
import { mapSqliteError } from '../utils/errorFunctions';
import { getHavingClauseFromFilters } from '../utils/filterFunctions';
import { resolveItemRelations } from '../utils/relationsFunctions';

const itemFields: (keyof Item)[] = ['name', 'amount', 'unitId', 'categoryId', 'description', 'isArchived'];

export const handleItemEntity =
  <T extends EntityWithId>(db: Database, table: string, fields: readonly (keyof T)[]) =>
  async (data: T, isUpdate = false): Promise<Response<T & EntityWithCounts>> => {
    const params = fields.map(key => (data[key] ?? null) as string | number | null);

    try {
      let lastID = -1;

      if (isUpdate) {
        const setClause = fields.map(f => `${String(f)} = ?`).join(', ') + `, updatedAt = datetime('now')`;

        lastID = await runDb(db, `UPDATE ${table} SET ${setClause} WHERE id = ?`, [...params, data.id ?? -1]);
      } else {
        lastID = await runDb(
          db,
          `INSERT INTO ${table} (${fields.join(',')})
           VALUES (${fields.map(() => '?').join(',')})`,
          params
        );
      }

      const sql = `
        SELECT
            it.*,
            COUNT(DISTINCT CASE WHEN inv.invoiceType = 'invoice' THEN ii.parentInvoiceId END) AS invoiceCount,
            COUNT(DISTINCT CASE WHEN inv.invoiceType = 'quotation' THEN ii.parentInvoiceId END) AS quotesCount,
            u.name AS unitName,
            c.name AS categoryName
        FROM items it
        LEFT JOIN units u ON it.unitId = u.id
        LEFT JOIN categories c ON it.categoryId = c.id
        LEFT JOIN invoice_items ii ON ii.itemId = it.id
        LEFT JOIN invoices inv ON ii.parentInvoiceId = inv.id
        GROUP BY it.id
          WHERE it.id = ?
        ORDER BY it.createdAt DESC
      `;

      const row = await getFirstRow<T & EntityWithCounts>(db, sql, [lastID]);

      return { success: true, data: row ?? undefined };
    } catch (error) {
      return { success: false, ...mapSqliteError(error) };
    }
  };

export const getAllItemEntities =
  <T extends object>(db: Database): ((filter: FilterData[]) => Promise<Response<(T & EntityWithCounts)[]>>) =>
  async (filter: FilterData[]) => {
    const havingClause = getHavingClauseFromFilters({
      filters: filter ?? [],
      invoiceUpdatedAtColumn: 'inv.updatedAt',
      invoiceIdColumn: 'inv.id',
      archivedColumn: 'it.isArchived'
    });

    const sql = `
      SELECT
          it.*,
          COUNT(DISTINCT CASE WHEN inv.invoiceType = 'invoice' THEN ii.parentInvoiceId END) AS invoiceCount,
          COUNT(DISTINCT CASE WHEN inv.invoiceType = 'quotation' THEN ii.parentInvoiceId END) AS quotesCount,
          u.name AS unitName,
          c.name AS categoryName
      FROM items it
      LEFT JOIN units u ON it.unitId = u.id
      LEFT JOIN categories c ON it.categoryId = c.id
      LEFT JOIN invoice_items ii ON ii.itemId = it.id
      LEFT JOIN invoices inv ON ii.parentInvoiceId = inv.id
      GROUP BY it.id
      ${havingClause ? havingClause : ''}
      ORDER BY it.createdAt DESC
    `;

    const data = await getAllRows<T & EntityWithCounts>(db, sql);

    return { success: true, data };
  };

export const getAllItems = async (db: Database, filter?: FilterData[]) => {
  const getAll = await getAllItemEntities(db);
  return getAll(filter ?? []);
};

export const addItem = async (db: Database, data: Item) => {
  const handle = handleItemEntity<Item>(db, 'items', itemFields);
  return handle(data);
};

export const updateItem = async (db: Database, data: Item) => {
  const handle = handleItemEntity<Item>(db, 'items', itemFields);
  return handle(data, true);
};

export const deleteItem = async (db: Database, id: number) => {
  try {
    await runDb(db, 'DELETE FROM items WHERE id = ?;', [id]);
    return { success: true };
  } catch (error) {
    return { success: false, ...mapSqliteError(error) };
  }
};

export const batchAddItem = async (db: Database, data: Item[]) => {
  const handle = handleItemEntity<Item>(db, 'items', itemFields);
  try {
    await runDb(db, 'BEGIN TRANSACTION');
    for (const row of data) {
      const finalItem = await resolveItemRelations(db, row);
      const result = await handle(finalItem);
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
