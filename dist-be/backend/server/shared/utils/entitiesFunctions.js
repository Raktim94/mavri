"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.handleEntity = exports.getAllEntities = void 0;
const dbHelper_1 = require("./dbHelper");
const errorFunctions_1 = require("./errorFunctions");
const filterFunctions_1 = require("./filterFunctions");
const getAllEntities = (db, table, alias, invoiceAlias, aggregation) => async (filter) => {
    const havingClause = (0, filterFunctions_1.getHavingClauseFromFilters)({
        dbType: db.type,
        filters: filter,
        invoiceUpdatedAtColumn: `${invoiceAlias}."updatedAt"`,
        invoiceIdColumn: `${invoiceAlias}."id"`,
        archivedColumn: `${alias}."isArchived"`
    });
    const sql = `
      SELECT
        ${alias}.*,
        ${aggregation.invoiceCountExpr} AS "invoiceCount",
        ${aggregation.quotesCountExpr} AS "quotesCount"
      FROM ${table} ${alias}
      ${aggregation.joins}
      GROUP BY ${alias}."id"
      ${havingClause || ''}
      ORDER BY ${alias}."createdAt" DESC
    `;
    const data = await db.all(sql);
    return { success: true, data };
};
exports.getAllEntities = getAllEntities;
const handleEntity = (db, table, alias, fields, aggregation) => async (data, isUpdate = false) => {
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
          ${alias}.*,
          ${aggregation.invoiceCountExpr} AS "invoiceCount",
          ${aggregation.quotesCountExpr} AS "quotesCount"
        FROM ${table} ${alias}
        ${aggregation.joins}
        WHERE ${alias}."id" = ?
        GROUP BY ${alias}."id"
      `;
        const row = await db.get(sql, [lastID]);
        return { success: true, data: row ?? undefined };
    }
    catch (error) {
        return { success: false, ...(0, errorFunctions_1.mapDatabaseError)(error, db.type) };
    }
};
exports.handleEntity = handleEntity;
