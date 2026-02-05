import type { DatabaseAdapter } from '../types/DatabaseAdapter';
import type { EntityWithCounts } from '../types/entityWithCounts';
import type { FilterData } from '../types/invoiceFilter';
import type { Response } from '../types/response';
import type { StyleProfile } from '../types/styleProfiles';
import { getAllEntities, handleEntity } from '../utils/entitiesFunctions';
import { mapDatabaseError } from '../utils/errorFunctions';

const styleProfileFields: (keyof StyleProfile)[] = [
  'name',
  'color',
  'logoSize',
  'fontSize',
  'layout',
  'tableHeaderStyle',
  'tableRowStyle',
  'pageFormat',
  'labelUpperCase',
  'watermarkFileName',
  'watermarkFileType',
  'watermarkFileSize',
  'watermarkFileData',
  'paidWatermarkFileName',
  'paidWatermarkFileType',
  'paidWatermarkFileSize',
  'paidWatermarkFileData',
  'isArchived',
  'showQuantity',
  'showUnit',
  'showRowNo'
];

export const getAllStyleProfiles = async (
  db: DatabaseAdapter,
  filter?: FilterData[]
): Promise<Response<(StyleProfile & EntityWithCounts)[]>> => {
  const getAll = getAllEntities<StyleProfile>(db, 'style_profiles', 't', 'i', {
    joins: `
          LEFT JOIN invoices i ON i."styleProfilesId" = t."id"
        `,
    invoiceCountExpr: `
          COUNT(DISTINCT CASE WHEN i."invoiceType" = 'invoice'
            THEN i."id" END)
        `,
    quotesCountExpr: `
          COUNT(DISTINCT CASE WHEN i."invoiceType" = 'quotation'
            THEN i."id" END)
        `
  });

  return getAll(filter ?? []);
};

export const addStyleProfile = async (
  db: DatabaseAdapter,
  data: StyleProfile
): Promise<Response<StyleProfile & EntityWithCounts>> => {
  const handle = handleEntity<StyleProfile>(db, 'style_profiles', 'sp', styleProfileFields, {
    joins: `LEFT JOIN invoices i ON i."styleProfilesId" = sp."id"`,
    invoiceCountExpr: `
          COUNT(DISTINCT CASE WHEN i."invoiceType" = 'invoice'
            THEN i."id" END)
        `,
    quotesCountExpr: `
          COUNT(DISTINCT CASE WHEN i."invoiceType" = 'quotation'
            THEN i."id" END)
        `
  });
  return handle(data);
};

export const updateStyleProfile = async (
  db: DatabaseAdapter,
  data: StyleProfile
): Promise<Response<StyleProfile & EntityWithCounts>> => {
  const handle = handleEntity<StyleProfile>(db, 'style_profiles', 'sp', styleProfileFields, {
    joins: `LEFT JOIN invoices i ON i."styleProfilesId" = sp."id"`,
    invoiceCountExpr: `
          COUNT(DISTINCT CASE WHEN i."invoiceType" = 'invoice'
            THEN i."id" END)
        `,
    quotesCountExpr: `
          COUNT(DISTINCT CASE WHEN i."invoiceType" = 'quotation'
            THEN i."id" END)
        `
  });
  return handle(data, true);
};

export const deleteStyleProfile = async (db: DatabaseAdapter, id: number) => {
  try {
    await db.run('DELETE FROM style_profiles WHERE "id" = ?;', [id]);
    return { success: true };
  } catch (error) {
    return { success: false, ...mapDatabaseError(error, db.type) };
  }
};

export const batchAddStyleProfile = async (db: DatabaseAdapter, data: StyleProfile[]) => {
  const handle = handleEntity<StyleProfile>(db, 'style_profiles', 'sp', styleProfileFields, {
    joins: `LEFT JOIN invoices i ON i."styleProfilesId" = sp."id"`,
    invoiceCountExpr: `
          COUNT(DISTINCT CASE WHEN i."invoiceType" = 'invoice'
            THEN i."id" END)
        `,
    quotesCountExpr: `
          COUNT(DISTINCT CASE WHEN i."invoiceType" = 'quotation'
            THEN i."id" END)
        `
  });
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
