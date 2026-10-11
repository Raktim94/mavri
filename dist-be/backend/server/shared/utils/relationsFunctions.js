"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.resolveItemRelations = exports.getOrCreateByName = void 0;
const getOrCreateByName = async (db, table, name) => {
    const row = await db.get(`SELECT "id" FROM ${table} WHERE "name" = ? LIMIT 1`, [name]);
    if (row?.id)
        return row.id;
    await db.run(`INSERT INTO ${table} ("name") VALUES (?)`, [name]);
    const newRow = await db.get(`SELECT id FROM ${table} WHERE "name" = ? LIMIT 1`, [name]);
    if (newRow?.id)
        return newRow.id;
    return undefined;
};
exports.getOrCreateByName = getOrCreateByName;
const resolveItemRelations = async (db, data) => {
    const item = { ...data };
    if (typeof item.categoryId === 'undefined' && item.categoryName) {
        item.categoryId = await (0, exports.getOrCreateByName)(db, 'categories', item.categoryName);
    }
    if (typeof item.unitId === 'undefined' && item.unitName) {
        item.unitId = await (0, exports.getOrCreateByName)(db, 'units', item.unitName);
    }
    return item;
};
exports.resolveItemRelations = resolveItemRelations;
