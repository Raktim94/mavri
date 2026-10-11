"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.FilterType = void 0;
var FilterType;
(function (FilterType) {
    FilterType["all"] = "All";
    FilterType["active"] = "Active";
    FilterType["archived"] = "Archived";
    FilterType["atleastOneInvoice"] = "AtleastOneInvoice";
    FilterType["noInvoices"] = "NoInvoices";
    FilterType["noInvoices30"] = "NoInvoices30";
    FilterType["noInvoices60"] = "NoInvoices60";
    FilterType["noInvoices90"] = "NoInvoices90";
    FilterType["client"] = "Client";
    FilterType["business"] = "Business";
    FilterType["date"] = "Date";
    FilterType["status"] = "Status";
})(FilterType || (exports.FilterType = FilterType = {}));
