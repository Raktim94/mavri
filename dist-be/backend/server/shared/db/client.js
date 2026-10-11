"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createPostgresAdapter = exports.createSqliteAdapter = void 0;
const pg_1 = require("pg");
const databaseType_1 = require("../enums/databaseType");
const dbHelper_1 = require("../utils/dbHelper");
const convertQuestionToDollar = (sql) => {
    let i = 0;
    return sql.replace(/\?/g, () => `$${++i}`);
};
const createSqliteAdapter = (db) => {
    return {
        type: databaseType_1.DatabaseType.sqlite,
        run: (sql, params = [], returningId = false) => new Promise((resolve, reject) => {
            db.run(sql, params, function (err) {
                if (err)
                    return reject(err);
                resolve(returningId ? this.lastID : -1);
            });
        }),
        get: (sql, params = []) => new Promise((resolve, reject) => {
            db.get(sql, params, (err, row) => {
                if (err)
                    return reject(err);
                if (!row)
                    return resolve(null);
                const convertedRow = (0, dbHelper_1.convertBooleanFields)(row);
                resolve(convertedRow);
            });
        }),
        all: (sql, params = []) => new Promise((resolve, reject) => {
            db.all(sql, params, (err, rows) => {
                if (err)
                    return reject(err);
                const convertedRows = (0, dbHelper_1.convertBooleanFieldsArray)(rows);
                resolve(convertedRows);
            });
        }),
        query: async (sql, params = []) => {
            const rows = await new Promise((resolve, reject) => {
                db.all(sql, params, (err, rows) => {
                    if (err)
                        return reject(err);
                    const convertedRows = (0, dbHelper_1.convertBooleanFieldsArray)(rows);
                    resolve(convertedRows);
                });
            });
            return { rows };
        },
        close: () => new Promise((resolve, reject) => {
            db.close(err => (err ? reject(err) : resolve()));
        })
    };
};
exports.createSqliteAdapter = createSqliteAdapter;
const createPostgresAdapter = (connectionString) => {
    const pool = new pg_1.Pool({ connectionString });
    let clientInTransaction = null;
    const acquireClient = async () => {
        if (clientInTransaction)
            return clientInTransaction;
        clientInTransaction = await pool.connect();
        return clientInTransaction;
    };
    const releaseClient = async () => {
        if (clientInTransaction) {
            try {
                clientInTransaction.release();
            }
            catch {
                throw new Error(`error.failedPGrelease`);
            }
            clientInTransaction = null;
        }
    };
    const runQuery = async (sql, params = []) => {
        const text = convertQuestionToDollar(sql);
        const trimmed = text.trim().toUpperCase();
        if (trimmed === 'BEGIN' || trimmed.startsWith('BEGIN ')) {
            const client = await acquireClient();
            await client.query(text, params);
            return { rows: [], rowCount: 0 };
        }
        if (trimmed === 'COMMIT' || trimmed === 'ROLLBACK') {
            if (!clientInTransaction) {
                return { rows: [], rowCount: 0 };
            }
            try {
                const res = await clientInTransaction.query(text, params);
                return res;
            }
            finally {
                await releaseClient();
            }
        }
        if (clientInTransaction) {
            return clientInTransaction.query(text, params);
        }
        return pool.query(text, params);
    };
    return {
        type: databaseType_1.DatabaseType.postgre,
        run: async (sql, params = [], returningId = false) => {
            const isInsert = sql.trim().toUpperCase().startsWith('INSERT');
            const isUpdate = sql.trim().toUpperCase().startsWith('UPDATE');
            if (returningId && isInsert && !sql.toUpperCase().includes('RETURNING')) {
                sql += ' RETURNING id';
            }
            if (isInsert || isUpdate) {
                params = params.map(dbHelper_1.boolToInt);
            }
            const res = await runQuery(sql, params);
            if (isInsert && returningId) {
                return res.rows[0]?.id ?? -1;
            }
            return res.rowCount ?? 0;
        },
        get: async (sql, params = []) => {
            const res = await runQuery(sql, params);
            if (!res.rows[0])
                return null;
            const convertedBooleanRow = (0, dbHelper_1.convertBooleanFields)(res.rows[0]);
            const convertedDateRow = (0, dbHelper_1.convertDateFields)(convertedBooleanRow);
            return convertedDateRow;
        },
        all: async (sql, params = []) => {
            const res = await runQuery(sql, params);
            const convertedBooleanRow = (0, dbHelper_1.convertBooleanFieldsArray)(res.rows);
            const convertedDateRow = (0, dbHelper_1.convertDateFieldsArray)(convertedBooleanRow);
            return convertedDateRow;
        },
        query: async (sql, params = []) => {
            const res = await runQuery(sql, params);
            const convertedBooleanRow = (0, dbHelper_1.convertBooleanFieldsArray)(res.rows);
            const convertedDateRow = (0, dbHelper_1.convertDateFieldsArray)(convertedBooleanRow);
            return { rows: convertedDateRow };
        },
        close: async () => {
            await releaseClient();
            await pool.end();
        }
    };
};
exports.createPostgresAdapter = createPostgresAdapter;
