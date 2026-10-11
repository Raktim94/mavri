"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.batchAddStyleProfile = exports.deleteStyleProfile = exports.updateStyleProfile = exports.addStyleProfile = exports.getAllStyleProfiles = void 0;
const entitiesFunctions_1 = require("../utils/entitiesFunctions");
const errorFunctions_1 = require("../utils/errorFunctions");
const styleProfileFields = [
    'name',
    'color',
    'logoSize',
    'fontSize',
    'fontFamily',
    'layoutId',
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
    'showRowNo',
    'fieldSortOrders',
    'pdfTexts'
];
const getAllStyleProfiles = async (db, filter) => {
    const getAll = (0, entitiesFunctions_1.getAllEntities)(db, 'style_profiles', 't', 'i', {
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
    const result = await getAll(filter ?? []);
    const layouts = await db.all('SELECT "id", "schema" FROM layouts');
    const layoutSchemas = new Map(layouts.map(layout => [layout.id, JSON.parse(layout.schema)]));
    result.data = result.data
        ? result.data?.map(profile => {
            return {
                ...profile,
                layoutSchema: profile.layoutId === undefined ? undefined : layoutSchemas.get(profile.layoutId),
                fieldSortOrders: profile.fieldSortOrders && typeof profile.fieldSortOrders === 'string'
                    ? JSON.parse(profile.fieldSortOrders)
                    : profile.fieldSortOrders,
                pdfTexts: profile.pdfTexts && typeof profile.pdfTexts === 'string' ? JSON.parse(profile.pdfTexts) : profile.pdfTexts
            };
        })
        : result.data;
    return result;
};
exports.getAllStyleProfiles = getAllStyleProfiles;
const addStyleProfile = async (db, data) => {
    const handle = (0, entitiesFunctions_1.handleEntity)(db, 'style_profiles', 'sp', styleProfileFields, {
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
    const result = await handle({
        ...data,
        fieldSortOrders: JSON.stringify(data.fieldSortOrders),
        pdfTexts: JSON.stringify(data.pdfTexts)
    });
    result.data = result.data
        ? {
            ...result.data,
            fieldSortOrders: result.data.fieldSortOrders && typeof result.data.fieldSortOrders === 'string'
                ? JSON.parse(result.data.fieldSortOrders)
                : result.data.fieldSortOrders,
            pdfTexts: result.data.pdfTexts && typeof result.data.pdfTexts === 'string'
                ? JSON.parse(result.data.pdfTexts)
                : result.data.pdfTexts
        }
        : result.data;
    return result;
};
exports.addStyleProfile = addStyleProfile;
const updateStyleProfile = async (db, data) => {
    const handle = (0, entitiesFunctions_1.handleEntity)(db, 'style_profiles', 'sp', styleProfileFields, {
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
    const result = await handle({
        ...data,
        fieldSortOrders: JSON.stringify(data.fieldSortOrders),
        pdfTexts: JSON.stringify(data.pdfTexts)
    }, true);
    result.data = result.data
        ? {
            ...result.data,
            fieldSortOrders: result.data.fieldSortOrders && typeof result.data.fieldSortOrders === 'string'
                ? JSON.parse(result.data.fieldSortOrders)
                : result.data.fieldSortOrders,
            pdfTexts: result.data.pdfTexts && typeof result.data.pdfTexts === 'string'
                ? JSON.parse(result.data.pdfTexts)
                : result.data.pdfTexts
        }
        : result.data;
    return result;
};
exports.updateStyleProfile = updateStyleProfile;
const deleteStyleProfile = async (db, id) => {
    try {
        await db.run('DELETE FROM style_profiles WHERE "id" = ?;', [id]);
        return { success: true };
    }
    catch (error) {
        return { success: false, ...(0, errorFunctions_1.mapDatabaseError)(error, db.type) };
    }
};
exports.deleteStyleProfile = deleteStyleProfile;
const batchAddStyleProfile = async (db, data) => {
    const handle = (0, entitiesFunctions_1.handleEntity)(db, 'style_profiles', 'sp', styleProfileFields, {
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
            const result = await handle({
                ...row,
                fieldSortOrders: typeof row.fieldSortOrders === 'string' ? row.fieldSortOrders : JSON.stringify(row.fieldSortOrders),
                pdfTexts: typeof row.pdfTexts === 'string' ? row.pdfTexts : JSON.stringify(row.pdfTexts)
            });
            if (!result.success) {
                try {
                    await db.run('ROLLBACK');
                }
                catch {
                    throw new Error(`error.rollbackFailed`);
                }
                return result;
            }
        }
        await db.run('COMMIT');
        return { success: true };
    }
    catch (error) {
        try {
            await db.run('ROLLBACK');
        }
        catch {
            throw new Error(`error.rollbackFailed`);
        }
        return { success: false, ...(0, errorFunctions_1.mapDatabaseError)(error, db.type) };
    }
};
exports.batchAddStyleProfile = batchAddStyleProfile;
