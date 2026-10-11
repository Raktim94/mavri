"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.up = void 0;
const errorFunctions_1 = require("../utils/errorFunctions");
const up = async (db) => {
    try {
        await db.run('delete from invoice_items where "parentInvoiceId" not in (select "id" from invoices)');
        await db.run('delete from invoice_payments where "parentInvoiceId" not in (select "id" from invoices)');
        await db.run('delete from attachments where "parentInvoiceId" not in (select "id" from invoices)');
    }
    catch (error) {
        return { success: false, ...(0, errorFunctions_1.mapDatabaseError)(error, db.type) };
    }
};
exports.up = up;
