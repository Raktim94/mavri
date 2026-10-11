"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.updateSettings = exports.getAllSettings = void 0;
const dbHelper_1 = require("../utils/dbHelper");
const errorFunctions_1 = require("../utils/errorFunctions");
const getAllSettings = async (db) => {
    const row = await db.get('SELECT * FROM settings LIMIT 1');
    if (!row)
        return { success: true, data: null };
    return { success: true, data: row };
};
exports.getAllSettings = getAllSettings;
const updateSettings = async (db, data) => {
    try {
        const { createdAt, updatedAt, id, ...rest } = data;
        void createdAt;
        void updatedAt;
        void id;
        const { fields, params } = (0, dbHelper_1.prepareUpdate)(rest);
        if (!fields.length)
            return { success: true };
        fields.push(`"updatedAt" = ${(0, dbHelper_1.getDefaultValue)("datetime('now')", db.type)}`);
        await db.run(`UPDATE settings SET ${fields.join(', ')} WHERE id = (SELECT "id" FROM settings LIMIT 1)`, params);
        return { success: true };
    }
    catch (error) {
        return { success: false, ...(0, errorFunctions_1.mapDatabaseError)(error, db.type) };
    }
};
exports.updateSettings = updateSettings;
