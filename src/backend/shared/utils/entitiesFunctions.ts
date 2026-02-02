import type { Database } from 'sqlite3';
import type { EntityWithId } from '../../shared/types/entityWithId';
import type { FilterData } from '../../shared/types/invoiceFilter';
import type { Response } from '../../shared/types/response';
import type { EntityWithCounts } from '../types/entityWithCounts';
import type { InvoiceAggregation } from '../types/InvoiceAggregation';
import { getAllRows, getFirstRow, runDb } from './dbFuntions';
import { mapSqliteError } from './errorFunctions';
import { getHavingClauseFromFilters } from './filterFunctions';

export const getAllEntities2 =
  <T extends object>(
    db: Database,
    table: string,
    alias: string,
    aggregation: InvoiceAggregation
  ): ((filter: FilterData[]) => Promise<Response<(T & EntityWithCounts)[]>>) =>
  async (filter: FilterData[]) => {
    const havingClause = getHavingClauseFromFilters({
      filters: filter,
      invoiceUpdatedAtColumn: 'inv.updatedAt',
      invoiceIdColumn: 'inv.id',
      archivedColumn: `${alias}.isArchived`
    });

    const sql = `
      SELECT
        ${alias}.*,
        ${aggregation.invoiceCountExpr} AS invoiceCount,
        ${aggregation.quotesCountExpr} AS quotesCount
      FROM ${table} ${alias}
      ${aggregation.joins}
      GROUP BY ${alias}.id
      ${havingClause || ''}
      ORDER BY ${alias}.createdAt DESC
    `;

    const data = await getAllRows<T & EntityWithCounts>(db, sql);

    return { success: true, data };
  };

export const handleEntity2 =
  <T extends EntityWithId>(
    db: Database,
    table: string,
    alias: string,
    fields: readonly (keyof T)[],
    aggregation: InvoiceAggregation
  ) =>
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
          ${alias}.*,
          ${aggregation.invoiceCountExpr} AS invoiceCount,
          ${aggregation.quotesCountExpr} AS quotesCount
        FROM ${table} ${alias}
        ${aggregation.joins}
        WHERE ${alias}.id = ?
        GROUP BY ${alias}.id
      `;

      const row = await getFirstRow<T & EntityWithCounts>(db, sql, [lastID]);

      return { success: true, data: row ?? undefined };
    } catch (error) {
      return { success: false, ...mapSqliteError(error) };
    }
  };
