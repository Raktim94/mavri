"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.batchAddClient = exports.deleteClient = exports.updateClient = exports.addClient = exports.getAllClients = void 0;
const entitiesFunctions_1 = require("../utils/entitiesFunctions");
const errorFunctions_1 = require("../utils/errorFunctions");
const clientFields = [
    'name',
    'shortName',
    'address',
    'email',
    'phone',
    'code',
    'additional',
    'description',
    'vatCode',
    'peppolEndpointId',
    'countryCode',
    'peppolEndpointSchemeId',
    'buyerReference',
    'taxExempt',
    'taxExemptionCertificate',
    'isArchived'
];
const getAllClients = async (db, filter) => {
    const getAll = (0, entitiesFunctions_1.getAllEntities)(db, 'clients', 't', 'i', {
        joins: `
        LEFT JOIN invoices i ON i."clientId" = t."id"
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
exports.getAllClients = getAllClients;
const addClient = async (db, data) => {
    const handle = (0, entitiesFunctions_1.handleEntity)(db, 'clients', 'c', clientFields, {
        joins: `LEFT JOIN invoices i ON i."clientId" = c."id"`,
        invoiceCountExpr: `
         COUNT(DISTINCT CASE WHEN i."invoiceType" = 'invoice'
           THEN i.id END)
       `,
        quotesCountExpr: `
         COUNT(DISTINCT CASE WHEN i."invoiceType" = 'quotation'
           THEN i."id" END)
       `
    });
    return handle({ ...data, taxExempt: data.taxExempt ?? false });
};
exports.addClient = addClient;
const updateClient = async (db, data) => {
    const handle = (0, entitiesFunctions_1.handleEntity)(db, 'clients', 'c', clientFields, {
        joins: `LEFT JOIN invoices i ON i."clientId" = c.id`,
        invoiceCountExpr: `
         COUNT(DISTINCT CASE WHEN i."invoiceType" = 'invoice'
           THEN i."id" END)
       `,
        quotesCountExpr: `
         COUNT(DISTINCT CASE WHEN i."invoiceType" = 'quotation'
           THEN i."id" END)
       `
    });
    return handle({ ...data, taxExempt: data.taxExempt ?? false }, true);
};
exports.updateClient = updateClient;
const deleteClient = async (db, id) => {
    try {
        await db.run('DELETE FROM clients WHERE "id" = ?;', [id]);
        return { success: true };
    }
    catch (error) {
        return { success: false, ...(0, errorFunctions_1.mapDatabaseError)(error, db.type) };
    }
};
exports.deleteClient = deleteClient;
const batchAddClient = async (db, data) => {
    const handle = (0, entitiesFunctions_1.handleEntity)(db, 'clients', 'c', clientFields, {
        joins: `LEFT JOIN invoices i ON i."clientId" = c."id"`,
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
            const result = await handle({ ...row, taxExempt: row.taxExempt ?? false });
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
exports.batchAddClient = batchAddClient;
