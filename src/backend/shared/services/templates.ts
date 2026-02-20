import type { DatabaseAdapter } from '../types/DatabaseAdapter';
import type { EntityWithId } from '../types/entityWithId';
import type { FilterData } from '../types/invoiceFilter';
import type { Response } from '../types/response';
import type { Template } from '../types/template';
import { getDefaultValue } from '../utils/dbHelper';
import { mapDatabaseError } from '../utils/errorFunctions';
import { getWhereClauseFromFilters } from '../utils/filterFunctions';

const templateFields: (keyof Template)[] = [
  'name',
  'businessId',
  'clientId',
  'currencyId',
  'bankId',
  'styleProfilesId',
  'customerNotes',
  'thanksNotes',
  'termsConditionNotes',
  'language',
  'signatureData',
  'signatureSize',
  'signatureType',
  'signatureName',
  'isArchived'
];

type GetTemplatesOptions = {
  id?: number;
  filter?: FilterData[];
};

const rollbackOrThrow = async (db: DatabaseAdapter) => {
  try {
    await db.run('ROLLBACK');
  } catch {
    throw new Error(`ROLLBACK failed`);
  }
};

const handleEntity =
  <T extends EntityWithId>(db: DatabaseAdapter, table: string, fields: readonly (keyof T)[]) =>
  async (data: T, isUpdate = false): Promise<Response<number>> => {
    const params = fields.map(key => (data[key] ?? null) as string | number | null);

    try {
      let lastID: number = -1;

      if (isUpdate) {
        const setClause =
          fields.map(f => `"${String(f)}" = ?`).join(', ') +
          `, "updatedAt" = ${getDefaultValue("(datetime('now'))", db.type)}`;

        lastID = await db.run(`UPDATE ${table} SET ${setClause} WHERE "id" = ?`, [...params, data.id ?? -1], true);
      } else {
        lastID = await db.run(
          `INSERT INTO ${table} (${fields.map(f => `"${String(f)}"`).join(',')})
           VALUES (${fields.map(() => '?').join(',')})`,
          params,
          true
        );
      }

      return { success: true, data: lastID };
    } catch (error) {
      return { success: false, ...mapDatabaseError(error, db.type) };
    }
  };

const getTemplates = async (db: DatabaseAdapter, options: GetTemplatesOptions) => {
  const { id, filter } = options;

  const whereClause = filter
    ? getWhereClauseFromFilters({
        filters: filter,
        archivedColumn: 't."isArchived"'
      })
    : '';
  const conditions: string[] = [];
  if (id) conditions.push(`t."id" = ${id}`);
  if (whereClause) conditions.push(whereClause);
  const whereSql = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
  const sql = `
        SELECT
          t.*,
          sp."name" as "styleProfileName",
          b."name" as "bankName",
          cur."code" as "currencyCode",
          cur."symbol" as "currencySymbol",
          cl."name" as "clientName",
          b."name" as "businessName",
        FROM templates t
        LEFT JOIN style_profiles sp ON sp."id" = t."styleProfilesId"
        LEFT JOIN banks b ON b."id" = t."bankId"
        LEFT JOIN currencies cur ON cur."id" = t."currencyId"
        LEFT JOIN clients cl ON cl."id" = t."clientId",
        LEFT JOIN businesses b ON b."id" = t."businessId"
        ${whereSql}
        ORDER BY it."createdAt" DESC
      `;
  const templates = await db.all<Template>(sql);

  return templates;
};

export const getAllTemplates = async (db: DatabaseAdapter, filter?: FilterData[]): Promise<Response<Template[]>> => {
  const templates = await getTemplates(db, { filter });

  return { success: true, data: templates };
};

export const addTemplate = async (db: DatabaseAdapter, data: Template): Promise<Response<Template>> => {
  try {
    await db.run('BEGIN');

    const handle = handleEntity<Template>(db, 'templates', templateFields);
    const result = await handle(data);

    if (!result.success || !result.data) {
      await rollbackOrThrow(db);
      return { success: false, key: result.key };
    }

    await db.run('COMMIT');

    const newId = result.data;
    const newResult = await getTemplates(db, { id: newId });

    return { success: true, data: newResult.length > 0 ? newResult[0] : undefined };
  } catch (error) {
    await rollbackOrThrow(db);
    return { success: false, ...mapDatabaseError(error, db.type) };
  }
};

export const updateTemplate = async (db: DatabaseAdapter, data: Template): Promise<Response<Template>> => {
  try {
    await db.run('BEGIN');

    const handle = handleEntity<Template>(db, 'templates', templateFields);
    const result = await handle(data, true);

    if (!result.success || !result.data) {
      await rollbackOrThrow(db);
      return { success: false, key: result.key };
    }

    await db.run('COMMIT');

    const newId = result.data;
    const newResult = await getTemplates(db, { id: newId });

    return { success: true, data: newResult.length > 0 ? newResult[0] : undefined };
  } catch (error) {
    await rollbackOrThrow(db);
    return { success: false, ...mapDatabaseError(error, db.type) };
  }
};

export const deleteTemplate = async (db: DatabaseAdapter, id: number) => {
  try {
    await db.run('DELETE FROM templates WHERE "id" = ?;', [id]);
    return { success: true };
  } catch (error) {
    return { success: false, ...mapDatabaseError(error, db.type) };
  }
};

export const batchAddTemplate = async (db: DatabaseAdapter, data: Template[]) => {
  const handle = handleEntity<Template>(db, 'templates', templateFields);
  try {
    await db.run('BEGIN');
    for (const row of data) {
      const result = await handle(row);
      if (!result.success) {
        try {
          await db.run('ROLLBACK');
        } catch {
          throw new Error(`ROLLBACK failed`);
        }
        return result;
      }
    }
    await db.run('COMMIT');
    return { success: true };
  } catch (error) {
    try {
      await db.run('ROLLBACK');
    } catch {
      throw new Error(`ROLLBACK failed`);
    }
    return { success: false, ...mapDatabaseError(error, db.type) };
  }
};
