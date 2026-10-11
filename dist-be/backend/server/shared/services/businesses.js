"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.batchAddBusiness = exports.deleteBusiness = exports.updateBusiness = exports.addBusiness = exports.getAllBusinesses = void 0;
const entitiesFunctions_1 = require("../utils/entitiesFunctions");
const errorFunctions_1 = require("../utils/errorFunctions");
const businessFields = [
    'name',
    'shortName',
    'address',
    'role',
    'email',
    'phone',
    'website',
    'additional',
    // Legacy payment info. New payment info is via Bank
    // 'paymentInformation',
    'logo',
    'fileSize',
    'fileType',
    'fileName',
    'description',
    'vatCode',
    'peppolEndpointId',
    'countryCode',
    'code',
    'peppolEndpointSchemeId',
    'isArchived'
];
const getAllBusinesses = (db, filter) => {
    const getAll = (0, entitiesFunctions_1.getAllEntities)(db, 'businesses', 't', 'i', {
        joins: `
      LEFT JOIN invoices i ON i."businessId" = t."id"
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
exports.getAllBusinesses = getAllBusinesses;
const addBusiness = (db, data) => {
    const handle = (0, entitiesFunctions_1.handleEntity)(db, 'businesses', 'b', businessFields, {
        joins: `LEFT JOIN invoices i ON i."businessId" = b.id`,
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
exports.addBusiness = addBusiness;
const updateBusiness = (db, data) => {
    const handle = (0, entitiesFunctions_1.handleEntity)(db, 'businesses', 'b', businessFields, {
        joins: `LEFT JOIN invoices i ON i."businessId" = b."id"`,
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
exports.updateBusiness = updateBusiness;
const deleteBusiness = async (db, id) => {
    try {
        await db.run('DELETE FROM businesses WHERE "id" = ?;', [id]);
        return { success: true };
    }
    catch (error) {
        return { success: false, ...(0, errorFunctions_1.mapDatabaseError)(error, db.type) };
    }
};
exports.deleteBusiness = deleteBusiness;
const batchAddBusiness = async (db, data) => {
    const handle = (0, entitiesFunctions_1.handleEntity)(db, 'businesses', 'b', businessFields, {
        joins: `LEFT JOIN invoices i ON i."businessId" = b."id"`,
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
exports.batchAddBusiness = batchAddBusiness;
