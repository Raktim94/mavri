"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.toDbValue = exports.getTableColumns = exports.isTableExists = exports.insertOrIgnore = exports.getDefaultValue = exports.getColumnType = exports.prepareUpdate = exports.convertBooleanFieldsArray = exports.convertBooleanFields = exports.convertDateFieldsArray = exports.convertDateFields = exports.convertBooleanFieldsToInt = exports.convertBooleanFieldsToIntArray = exports.boolToInt = void 0;
const constant_1 = require("../constant");
const databaseType_1 = require("../enums/databaseType");
const boolToInt = (value) => {
    if (typeof value === 'boolean') {
        return value ? 1 : 0;
    }
    return value;
};
exports.boolToInt = boolToInt;
const convertBooleanFieldsToIntArray = (rows) => rows.map(exports.convertBooleanFieldsToInt);
exports.convertBooleanFieldsToIntArray = convertBooleanFieldsToIntArray;
const convertBooleanFieldsToInt = (row) => {
    const converted = { ...row };
    constant_1.BOOLEAN_FIELDS.forEach(key => {
        if (key in converted) {
            const value = converted[key];
            converted[key] = (0, exports.boolToInt)(value);
        }
    });
    return converted;
};
exports.convertBooleanFieldsToInt = convertBooleanFieldsToInt;
const convertDateFields = (row) => {
    const convertedRow = { ...row };
    constant_1.DATE_FIELDS.forEach(key => {
        if (key in convertedRow && convertedRow[key] != null) {
            const value = convertedRow[key];
            if (value instanceof Date) {
                convertedRow[key] = value.toISOString().replace('T', ' ').replace('Z', '');
            }
        }
    });
    return convertedRow;
};
exports.convertDateFields = convertDateFields;
const convertDateFieldsArray = (rows) => rows.map(exports.convertDateFields);
exports.convertDateFieldsArray = convertDateFieldsArray;
const convertBooleanFields = (row) => {
    const convertedRow = { ...row };
    constant_1.BOOLEAN_FIELDS.forEach(key => {
        if (key in convertedRow) {
            convertedRow[key] = Boolean(convertedRow[key]);
        }
    });
    return convertedRow;
};
exports.convertBooleanFields = convertBooleanFields;
const convertBooleanFieldsArray = (rows) => rows.map(exports.convertBooleanFields);
exports.convertBooleanFieldsArray = convertBooleanFieldsArray;
const prepareUpdate = (data, id) => {
    const fields = [];
    const params = [];
    Object.entries(data).forEach(([key, value]) => {
        if (value !== undefined) {
            fields.push(`"${key}" = ?`);
            let param;
            if (typeof value === 'boolean')
                param = value ? 1 : 0;
            else if (value === null)
                param = null;
            else if (typeof value === 'string' || typeof value === 'number')
                param = value;
            else
                throw new Error(`error.unsupportedValue`);
            params.push(param);
        }
    });
    if (id != null)
        params.push(id);
    return { fields, params };
};
exports.prepareUpdate = prepareUpdate;
const getColumnType = (sqliteType, dbType) => {
    if (dbType === databaseType_1.DatabaseType.postgre) {
        switch (sqliteType) {
            case 'DATETIME':
                return 'TIMESTAMP';
            case 'INTEGER PRIMARY KEY AUTOINCREMENT':
                return 'INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY';
            case 'BLOB':
                return 'BYTEA';
            default:
                return sqliteType;
        }
    }
    return sqliteType;
};
exports.getColumnType = getColumnType;
const getDefaultValue = (sqliteExpr, dbType) => {
    if (dbType === databaseType_1.DatabaseType.postgre) {
        switch (sqliteExpr) {
            case "datetime('now', '-30 days')":
                return "NOW() - INTERVAL '30 days'";
            case "datetime('now', '-60 days')":
                return "NOW() - INTERVAL '60 days'";
            case "datetime('now', '-90 days')":
                return "NOW() - INTERVAL '90 days'";
            case "date('now','start of month','+2 months','-1 day')":
                return "DATE_TRUNC('month', NOW()) + INTERVAL '2 month' - INTERVAL '1 day'";
            case "(datetime('now'))":
                return 'NOW()';
            case "datetime('now')":
                return 'NOW()';
            default:
                return sqliteExpr;
        }
    }
    return sqliteExpr;
};
exports.getDefaultValue = getDefaultValue;
const insertOrIgnore = (table, columns, values, dbType, conflictTarget) => {
    if (columns.length === 0) {
        if (dbType === databaseType_1.DatabaseType.sqlite) {
            return `INSERT OR IGNORE INTO ${table} DEFAULT VALUES;`;
        }
        else {
            if (!conflictTarget) {
                throw new Error(`error.postgresConflictTarget`);
            }
            return `INSERT INTO ${table} DEFAULT VALUES ON CONFLICT (${conflictTarget}) DO NOTHING;`;
        }
    }
    const columnsList = columns.map(c => `"${c}"`).join(', ');
    const valuesList = values.map(v => `(${v.map(val => `'${val}'`).join(', ')})`).join(',\n  ');
    if (dbType === databaseType_1.DatabaseType.sqlite) {
        return `INSERT OR IGNORE INTO ${table} (${columnsList}) VALUES ${valuesList};`;
    }
    else {
        if (!conflictTarget) {
            throw new Error(`error.postgresConflictTarget`);
        }
        return `INSERT INTO ${table} (${columnsList}) VALUES ${valuesList} ON CONFLICT (${conflictTarget}) DO NOTHING;`;
    }
};
exports.insertOrIgnore = insertOrIgnore;
const isTableExists = async (db, tableName) => {
    if (db.type === databaseType_1.DatabaseType.sqlite) {
        const row = await db.get(`
      SELECT name
      FROM sqlite_master
      WHERE type = 'table'
        AND name = ?
      `, [tableName]);
        return !!row;
    }
    if (db.type === databaseType_1.DatabaseType.postgre) {
        const row = await db.get(`
      SELECT table_name
      FROM information_schema.tables
      WHERE table_schema = 'public'
        AND table_name = ?
      `, [tableName]);
        return !!row;
    }
    return false;
};
exports.isTableExists = isTableExists;
const getTableColumns = async (db, tableName) => {
    if (db.type === databaseType_1.DatabaseType.sqlite) {
        const rows = await db.all(`
      SELECT *
      FROM pragma_table_info('${tableName}')
    `);
        return rows;
    }
    if (db.type === databaseType_1.DatabaseType.postgre) {
        const rows = await db.all(`SELECT column_name AS name, 
      data_type AS type
      FROM information_schema.columns WHERE table_name = ?`, [tableName]);
        return rows;
    }
    return [];
};
exports.getTableColumns = getTableColumns;
const toDbValue = (value) => {
    if (value === undefined || value === null)
        return null;
    if (Buffer.isBuffer(value))
        return value;
    if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean')
        return value;
    return JSON.stringify(value);
};
exports.toDbValue = toDbValue;
