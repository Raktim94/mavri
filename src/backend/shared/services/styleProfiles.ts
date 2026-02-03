import type { Database } from 'sqlite3';
import type { EntityWithCounts } from '../types/entityWithCounts';
import type { FilterData } from '../types/invoiceFilter';
import type { Response } from '../types/response';
import type { StyleProfile } from '../types/styleProfiles';
import { runDb } from '../utils/dbFuntions';
import { getAllEntities, handleEntity } from '../utils/entitiesFunctions';
import { mapSqliteError } from '../utils/errorFunctions';

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
  'isArchived'
];

export const getAllStyleProfiles = async (
  db: Database,
  filter?: FilterData[]
): Promise<Response<(StyleProfile & EntityWithCounts)[]>> => {
  const getAll = getAllEntities<StyleProfile>(db, 'style_profiles', 't', 'i', {
    joins: `
          LEFT JOIN invoices i ON i.styleProfilesId = t.id
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

export const addStyleProfile = async (
  db: Database,
  data: StyleProfile
): Promise<Response<StyleProfile & EntityWithCounts>> => {
  const handle = handleEntity<StyleProfile>(db, 'style_profiles', 'sp', styleProfileFields, {
    joins: `LEFT JOIN invoices i ON i.styleProfilesId = sp.id`,
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

export const updateStyleProfile = async (
  db: Database,
  data: StyleProfile
): Promise<Response<StyleProfile & EntityWithCounts>> => {
  const handle = handleEntity<StyleProfile>(db, 'style_profiles', 'sp', styleProfileFields, {
    joins: `LEFT JOIN invoices i ON i.styleProfilesId = sp.id`,
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

export const deleteStyleProfile = async (db: Database, id: number) => {
  try {
    await runDb(db, 'DELETE FROM style_profiles WHERE id = ?;', [id]);
    return { success: true };
  } catch (error) {
    return { success: false, ...mapSqliteError(error) };
  }
};

export const batchAddStyleProfile = async (db: Database, data: StyleProfile[]) => {
  const handle = handleEntity<StyleProfile>(db, 'style_profiles', 'sp', styleProfileFields, {
    joins: `LEFT JOIN invoices i ON i.styleProfilesId = sp.id`,
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
