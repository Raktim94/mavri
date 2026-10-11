"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getHavingClauseFromFilters = exports.getWhereClauseFromFilters = void 0;
const filterType_1 = require("../../shared/enums/filterType");
const dbHelper_1 = require("./dbHelper");
const getWhereClauseFromFilters = (data) => {
    const { filters, archivedColumn, clientNameSnapshotColumn, businessNameSnapshotColumn, issuedAtColumn, statusColumn } = data;
    const clauses = [];
    filters.forEach(({ type, value }) => {
        switch (type) {
            case filterType_1.FilterType.active:
                if (archivedColumn)
                    clauses.push(`${archivedColumn} = 0`);
                break;
            case filterType_1.FilterType.archived:
                if (archivedColumn)
                    clauses.push(`${archivedColumn} = 1`);
                break;
            case filterType_1.FilterType.client:
                if (clientNameSnapshotColumn && value)
                    clauses.push(`${clientNameSnapshotColumn} = '${value.replace(/'/g, "''")}'`);
                break;
            case filterType_1.FilterType.business:
                if (businessNameSnapshotColumn && value)
                    clauses.push(`${businessNameSnapshotColumn} = '${value.replace(/'/g, "''")}'`);
                break;
            case filterType_1.FilterType.date:
                if (issuedAtColumn && value) {
                    const dates = value.split(',');
                    if (dates.length === 2)
                        clauses.push(`${issuedAtColumn} BETWEEN '${dates[0]}' AND '${dates[1]}'`);
                }
                break;
            case filterType_1.FilterType.status:
                if (statusColumn && value)
                    clauses.push(`${statusColumn} = '${value.replace(/'/g, "''")}'`);
                break;
            case filterType_1.FilterType.all:
            default:
                break;
        }
    });
    return clauses.length ? clauses.join(' AND ') : '1=1';
};
exports.getWhereClauseFromFilters = getWhereClauseFromFilters;
const getHavingClauseFromFilters = (data) => {
    const { filters, dbType, invoiceUpdatedAtColumn, issuedAtColumn, invoiceIdColumn, archivedColumn, businessNameSnapshotColumn, clientNameSnapshotColumn, statusColumn } = data;
    if (!filters?.length)
        return '';
    const clauses = [];
    filters.forEach(({ type, value }) => {
        switch (type) {
            case filterType_1.FilterType.noInvoices30:
                if (invoiceUpdatedAtColumn)
                    clauses.push(`(MAX(${invoiceUpdatedAtColumn}) IS NULL OR MAX(${invoiceUpdatedAtColumn}) < ${(0, dbHelper_1.getDefaultValue)("datetime('now', '-30 days')", dbType)})`);
                break;
            case filterType_1.FilterType.noInvoices60:
                if (invoiceUpdatedAtColumn)
                    clauses.push(`(MAX(${invoiceUpdatedAtColumn}) IS NULL OR MAX(${invoiceUpdatedAtColumn}) < ${(0, dbHelper_1.getDefaultValue)("datetime('now', '-60 days')", dbType)})`);
                break;
            case filterType_1.FilterType.noInvoices90:
                if (invoiceUpdatedAtColumn)
                    clauses.push(`(MAX(${invoiceUpdatedAtColumn}) IS NULL OR MAX(${invoiceUpdatedAtColumn}) < ${(0, dbHelper_1.getDefaultValue)("datetime('now', '-90 days')", dbType)})`);
                break;
            case filterType_1.FilterType.noInvoices:
                if (invoiceIdColumn)
                    clauses.push(`(COUNT(${invoiceIdColumn}) = 0)`);
                break;
            case filterType_1.FilterType.atleastOneInvoice:
                if (invoiceIdColumn)
                    clauses.push(`(COUNT(${invoiceIdColumn}) > 0)`);
                break;
            case filterType_1.FilterType.active:
                if (archivedColumn)
                    clauses.push(`(${archivedColumn} = 0)`);
                break;
            case filterType_1.FilterType.archived:
                if (archivedColumn)
                    clauses.push(`(${archivedColumn} = 1)`);
                break;
            case filterType_1.FilterType.client:
                if (clientNameSnapshotColumn)
                    clauses.push(`${clientNameSnapshotColumn} = '${value.replace(/'/g, "''")}'`);
                break;
            case filterType_1.FilterType.business:
                if (businessNameSnapshotColumn)
                    clauses.push(`${businessNameSnapshotColumn} = '${value.replace(/'/g, "''")}'`);
                break;
            case filterType_1.FilterType.date:
                const dates = value.split(',');
                if (dates.length === 2 && issuedAtColumn) {
                    clauses.push(`${issuedAtColumn} BETWEEN '${dates[0]}' AND '${dates[1]}'`);
                }
                break;
            case filterType_1.FilterType.status:
                if (statusColumn)
                    clauses.push(`${statusColumn} = '${value.replace(/'/g, "''")}'`);
                break;
            case filterType_1.FilterType.all:
            default:
                break;
        }
    });
    if (!clauses.length)
        return '';
    return `HAVING ${clauses.join(' AND ')}`;
};
exports.getHavingClauseFromFilters = getHavingClauseFromFilters;
