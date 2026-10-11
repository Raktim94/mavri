"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.InvoiceStatus = void 0;
var InvoiceStatus;
(function (InvoiceStatus) {
    InvoiceStatus["open"] = "open";
    InvoiceStatus["unpaid"] = "unpaid";
    InvoiceStatus["closed"] = "closed";
    InvoiceStatus["partiallyPaid"] = "partially";
    InvoiceStatus["paid"] = "paid";
})(InvoiceStatus || (exports.InvoiceStatus = InvoiceStatus = {}));
