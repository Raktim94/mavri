"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.deleteLayout = exports.updateLayout = exports.addLayout = exports.exportLayout = exports.getAllLayouts = void 0;
const entitiesFunctions_1 = require("../utils/entitiesFunctions");
const errorFunctions_1 = require("../utils/errorFunctions");
const fields = ['isArchived', 'schema'];
const parse = (template) => ({ ...template, schema: typeof template.schema === 'string' ? JSON.parse(template.schema) : template.schema });
const getAllLayouts = async (db, filter) => {
    const result = await (0, entitiesFunctions_1.getAllEntities)(db, 'layouts', 'l', 'i', {
        joins: 'LEFT JOIN invoices i ON i."layoutId" = l."id"',
        invoiceCountExpr: 'COUNT(DISTINCT CASE WHEN i."invoiceType" = \'invoice\' THEN i."id" END)',
        quotesCountExpr: 'COUNT(DISTINCT CASE WHEN i."invoiceType" = \'quotation\' THEN i."id" END)'
    })(filter ?? []);
    result.data = result.data?.map(parse);
    return result;
};
exports.getAllLayouts = getAllLayouts;
const handleTemplate = (db) => (0, entitiesFunctions_1.handleEntity)(db, 'layouts', 'l', fields, {
    joins: 'LEFT JOIN invoices i ON i."layoutId" = l."id"',
    invoiceCountExpr: 'COUNT(DISTINCT CASE WHEN i."invoiceType" = \'invoice\' THEN i."id" END)',
    quotesCountExpr: 'COUNT(DISTINCT CASE WHEN i."invoiceType" = \'quotation\' THEN i."id" END)'
});
const exportLayout = async (db, id) => {
    try {
        const result = await db.get('SELECT * FROM layouts WHERE "id" = ?', [id]);
        return {
            success: true,
            data: result
                ? { ...result, schema: typeof result.schema === 'string' ? JSON.parse(result.schema) : result.schema }
                : null
        };
    }
    catch (error) {
        return { success: false, ...(0, errorFunctions_1.mapDatabaseError)(error, db.type) };
    }
};
exports.exportLayout = exportLayout;
const addLayout = async (db, data) => {
    const result = await handleTemplate(db)({ ...data, schema: JSON.stringify(data.schema) });
    result.data = result.data ? parse(result.data) : result.data;
    return result;
};
exports.addLayout = addLayout;
const updateLayout = async (db, data) => {
    const result = await handleTemplate(db)({ ...data, schema: JSON.stringify(data.schema) }, true);
    result.data = result.data ? parse(result.data) : result.data;
    return result;
};
exports.updateLayout = updateLayout;
const deleteLayout = async (db, id) => {
    try {
        await db.run('DELETE FROM layouts WHERE "id" = ?', [id]);
        return { success: true };
    }
    catch (error) {
        return { success: false, ...(0, errorFunctions_1.mapDatabaseError)(error, db.type) };
    }
};
exports.deleteLayout = deleteLayout;
