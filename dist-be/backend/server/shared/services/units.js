"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.batchAddUnit = exports.deleteUnit = exports.updateUnit = exports.addUnit = exports.getAllUnits = void 0;
const entitiesFunctions_1 = require("../utils/entitiesFunctions");
const errorFunctions_1 = require("../utils/errorFunctions");
const unitFields = ['name', 'isArchived'];
const getAllUnits = async (db, filter) => {
    const getAll = (0, entitiesFunctions_1.getAllEntities)(db, 'units', 'u', 'inv', {
        joins: `
      LEFT JOIN items it ON it."unitId" = u."id"
      LEFT JOIN invoice_items ii ON ii."itemId" = it."id"
      LEFT JOIN invoices inv ON ii."parentInvoiceId" = inv."id"
    `,
        invoiceCountExpr: `
      COUNT(DISTINCT CASE WHEN inv."invoiceType" = 'invoice'
        THEN ii."parentInvoiceId" END)
    `,
        quotesCountExpr: `
      COUNT(DISTINCT CASE WHEN inv."invoiceType" = 'quotation'
        THEN ii."parentInvoiceId" END)
    `
    });
    return getAll(filter ?? []);
};
exports.getAllUnits = getAllUnits;
const addUnit = async (db, data) => {
    const handle = (0, entitiesFunctions_1.handleEntity)(db, 'units', 'u', unitFields, {
        joins: `
        LEFT JOIN items it ON it."unitId" = u."id"
        LEFT JOIN invoice_items ii ON ii."itemId" = it."id"
        LEFT JOIN invoices inv ON ii."parentInvoiceId" = inv."id"
      `,
        invoiceCountExpr: `
        COUNT(DISTINCT CASE WHEN inv."invoiceType" = 'invoice'
          THEN ii."parentInvoiceId" END)
      `,
        quotesCountExpr: `
        COUNT(DISTINCT CASE WHEN inv."invoiceType" = 'quotation'
          THEN ii."parentInvoiceId" END)
      `
    });
    return handle(data);
};
exports.addUnit = addUnit;
const updateUnit = async (db, data) => {
    const handle = (0, entitiesFunctions_1.handleEntity)(db, 'units', 'u', unitFields, {
        joins: `
        LEFT JOIN items it ON it."unitId" = u."id"
        LEFT JOIN invoice_items ii ON ii."itemId" = it."id"
        LEFT JOIN invoices inv ON ii."parentInvoiceId" = inv."id"
      `,
        invoiceCountExpr: `
        COUNT(DISTINCT CASE WHEN inv."invoiceType" = 'invoice'
          THEN ii."parentInvoiceId" END)
      `,
        quotesCountExpr: `
        COUNT(DISTINCT CASE WHEN inv."invoiceType" = 'quotation'
          THEN ii."parentInvoiceId" END)
      `
    });
    return handle(data, true);
};
exports.updateUnit = updateUnit;
const deleteUnit = async (db, id) => {
    try {
        await db.run('DELETE FROM units WHERE "id" = ?;', [id]);
        return { success: true };
    }
    catch (error) {
        return { success: false, ...(0, errorFunctions_1.mapDatabaseError)(error, db.type) };
    }
};
exports.deleteUnit = deleteUnit;
const batchAddUnit = async (db, data) => {
    const handle = (0, entitiesFunctions_1.handleEntity)(db, 'units', 'u', unitFields, {
        joins: `
        LEFT JOIN items it ON it."unitId" = u."id"
        LEFT JOIN invoice_items ii ON ii."itemId" = it."id"
        LEFT JOIN invoices inv ON ii."parentInvoiceId" = inv."id"
      `,
        invoiceCountExpr: `
        COUNT(DISTINCT CASE WHEN inv."invoiceType" = 'invoice'
          THEN ii."parentInvoiceId" END)
      `,
        quotesCountExpr: `
        COUNT(DISTINCT CASE WHEN inv."invoiceType" = 'quotation'
          THEN ii."parentInvoiceId" END)
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
exports.batchAddUnit = batchAddUnit;
