"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.batchAddBank = exports.deleteBank = exports.updateBank = exports.addBank = exports.getAllBanks = void 0;
const entitiesFunctions_1 = require("../utils/entitiesFunctions");
const errorFunctions_1 = require("../utils/errorFunctions");
const bankFields = [
    'name',
    'bankName',
    'accountNumber',
    'swiftCode',
    'address',
    'branchCode',
    'type',
    'routingNumber',
    'accountHolder',
    'sortOrder',
    'upiCode',
    'qrCode',
    'qrCodeFileSize',
    'qrCodeFileType',
    'qrCodeFileName',
    'isArchived'
];
const getAllBanks = async (db, filter) => {
    const getAll = (0, entitiesFunctions_1.getAllEntities)(db, 'banks', 'b', 'i', {
        joins: `
          LEFT JOIN invoices i ON i."bankId" = b."id"
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
exports.getAllBanks = getAllBanks;
const addBank = async (db, data) => {
    const handle = (0, entitiesFunctions_1.handleEntity)(db, 'banks', 'b', bankFields, {
        joins: `LEFT JOIN invoices i ON i."bankId" = b."id"`,
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
exports.addBank = addBank;
const updateBank = async (db, data) => {
    const handle = (0, entitiesFunctions_1.handleEntity)(db, 'banks', 'b', bankFields, {
        joins: `LEFT JOIN invoices i ON i."bankId" = b."id"`,
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
exports.updateBank = updateBank;
const deleteBank = async (db, id) => {
    try {
        await db.run('DELETE FROM banks WHERE "id" = ?;', [id]);
        return { success: true };
    }
    catch (error) {
        return { success: false, ...(0, errorFunctions_1.mapDatabaseError)(error, db.type) };
    }
};
exports.deleteBank = deleteBank;
const batchAddBank = async (db, data) => {
    const handle = (0, entitiesFunctions_1.handleEntity)(db, 'banks', 'b', bankFields, {
        joins: `LEFT JOIN invoices i ON i."bankId" = b."id"`,
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
exports.batchAddBank = batchAddBank;
