"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.InvoiceTaxOptionType = void 0;
var InvoiceTaxOptionType;
(function (InvoiceTaxOptionType) {
    InvoiceTaxOptionType[InvoiceTaxOptionType["onTotal"] = 0] = "onTotal";
    InvoiceTaxOptionType[InvoiceTaxOptionType["deducted"] = 1] = "deducted";
    InvoiceTaxOptionType[InvoiceTaxOptionType["perItem"] = 2] = "perItem";
})(InvoiceTaxOptionType || (exports.InvoiceTaxOptionType = InvoiceTaxOptionType = {}));
