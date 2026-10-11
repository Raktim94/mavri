"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.batchAddCurrency = exports.deleteCurrency = exports.updateCurrency = exports.addCurrency = exports.getAllCurrencies = void 0;
const entitiesFunctions_1 = require("../utils/entitiesFunctions");
const errorFunctions_1 = require("../utils/errorFunctions");
const currencyFields = ['code', 'symbol', 'text', 'format', 'isArchived', 'subunit'];
const getAllCurrencies = async (db, filter) => {
    const getAll = (0, entitiesFunctions_1.getAllEntities)(db, 'currencies', 't', 'i', {
        joins: `
        LEFT JOIN invoices i ON i."currencyId" = t."id"
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
exports.getAllCurrencies = getAllCurrencies;
const addCurrency = async (db, data) => {
    const handle = (0, entitiesFunctions_1.handleEntity)(db, 'currencies', 'c', currencyFields, {
        joins: `LEFT JOIN invoices i ON i."currencyId" = c."id"`,
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
exports.addCurrency = addCurrency;
const updateCurrency = async (db, data) => {
    const handle = (0, entitiesFunctions_1.handleEntity)(db, 'currencies', 'c', currencyFields, {
        joins: `LEFT JOIN invoices i ON i."currencyId" = c."id"`,
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
exports.updateCurrency = updateCurrency;
const deleteCurrency = async (db, id) => {
    try {
        await db.run('DELETE FROM currencies WHERE id = ?;', [id]);
        return { success: true };
    }
    catch (error) {
        return { success: false, ...(0, errorFunctions_1.mapDatabaseError)(error, db.type) };
    }
};
exports.deleteCurrency = deleteCurrency;
const batchAddCurrency = async (db, data) => {
    const handle = (0, entitiesFunctions_1.handleEntity)(db, 'currencies', 'c', currencyFields, {
        joins: `LEFT JOIN invoices i ON i."currencyId" = c."id"`,
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
exports.batchAddCurrency = batchAddCurrency;
