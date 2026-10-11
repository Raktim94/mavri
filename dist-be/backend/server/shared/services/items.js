"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.batchAddItem = exports.deleteItem = exports.updateItem = exports.addItem = exports.getAllItems = exports.getAllItemEntities = void 0;
const dbHelper_1 = require("../utils/dbHelper");
const errorFunctions_1 = require("../utils/errorFunctions");
const filterFunctions_1 = require("../utils/filterFunctions");
const relationsFunctions_1 = require("../utils/relationsFunctions");
const itemFields = ['name', 'amount', 'unitId', 'categoryId', 'description', 'isArchived'];
const handleItemEntity = (db, table, fields) => async (data, isUpdate = false) => {
    const params = fields.map(key => (data[key] ?? null));
    try {
        let lastID = -1;
        if (isUpdate) {
            const setClause = fields.map(f => `"${String(f)}" = ?`).join(', ') +
                `, "updatedAt" = ${(0, dbHelper_1.getDefaultValue)("(datetime('now'))", db.type)}`;
            await db.run(`UPDATE ${table} SET ${setClause} WHERE "id" = ?`, [...params, data.id ?? -1], true);
            lastID = data.id ?? -1;
        }
        else {
            lastID = await db.run(`INSERT INTO ${table} (${fields.map(f => `"${String(f)}"`).join(',')})
           VALUES (${fields.map(() => '?').join(',')})`, params, true);
        }
        const sql = `
        SELECT
            it.*,
            COUNT(DISTINCT CASE WHEN inv."invoiceType" = 'invoice' THEN ii."parentInvoiceId" END) AS "invoiceCount",
            COUNT(DISTINCT CASE WHEN inv."invoiceType" = 'quotation' THEN ii."parentInvoiceId" END) AS "quotesCount",
            u."name" AS "unitName",
            c."name" AS "categoryName"
        FROM items it
        LEFT JOIN units u ON it."unitId" = u."id"
        LEFT JOIN categories c ON it."categoryId" = c."id"
        LEFT JOIN invoice_items ii ON ii."itemId" = it."id"
        LEFT JOIN invoices inv ON ii."parentInvoiceId" = inv."id"
        WHERE it."id" = ?
        GROUP BY it."id", u."name", c."name"
        ORDER BY it."createdAt" DESC
      `;
        const row = await db.get(sql, [lastID]);
        return { success: true, data: row ?? undefined };
    }
    catch (error) {
        return { success: false, ...(0, errorFunctions_1.mapDatabaseError)(error, db.type) };
    }
};
const getAllItemEntities = (db) => async (filter) => {
    const havingClause = (0, filterFunctions_1.getHavingClauseFromFilters)({
        dbType: db.type,
        filters: filter ?? [],
        invoiceUpdatedAtColumn: 'inv."updatedAt"',
        invoiceIdColumn: 'inv."id"',
        archivedColumn: 'it."isArchived"'
    });
    const sql = `
      SELECT
          it.*,
          COUNT(DISTINCT CASE WHEN inv."invoiceType" = 'invoice' THEN ii."parentInvoiceId" END) AS "invoiceCount",
          COUNT(DISTINCT CASE WHEN inv."invoiceType" = 'quotation' THEN ii."parentInvoiceId" END) AS "quotesCount",
          u."name" AS "unitName",
          c."name" AS "categoryName"
      FROM items it
      LEFT JOIN units u ON it."unitId" = u."id"
      LEFT JOIN categories c ON it."categoryId" = c."id"
      LEFT JOIN invoice_items ii ON ii."itemId" = it."id"
      LEFT JOIN invoices inv ON ii."parentInvoiceId" = inv."id"
      GROUP BY it."id", u."name", c."name"
      ${havingClause ? havingClause : ''}
      ORDER BY it."createdAt" DESC
    `;
    const data = await db.all(sql);
    return { success: true, data };
};
exports.getAllItemEntities = getAllItemEntities;
const getAllItems = async (db, filter) => {
    const getAll = await (0, exports.getAllItemEntities)(db);
    return getAll(filter ?? []);
};
exports.getAllItems = getAllItems;
const addItem = async (db, data) => {
    const handle = handleItemEntity(db, 'items', itemFields);
    return handle(data);
};
exports.addItem = addItem;
const updateItem = async (db, data) => {
    const handle = handleItemEntity(db, 'items', itemFields);
    return handle(data, true);
};
exports.updateItem = updateItem;
const deleteItem = async (db, id) => {
    try {
        await db.run('DELETE FROM items WHERE "id" = ?;', [id]);
        return { success: true };
    }
    catch (error) {
        return { success: false, ...(0, errorFunctions_1.mapDatabaseError)(error, db.type) };
    }
};
exports.deleteItem = deleteItem;
const batchAddItem = async (db, data) => {
    const handle = handleItemEntity(db, 'items', itemFields);
    try {
        await db.run('BEGIN');
        for (const row of data) {
            const finalItem = await (0, relationsFunctions_1.resolveItemRelations)(db, row);
            const result = await handle(finalItem);
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
exports.batchAddItem = batchAddItem;
