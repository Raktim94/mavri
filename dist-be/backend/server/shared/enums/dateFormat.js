"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.DateFormat = void 0;
var DateFormat;
(function (DateFormat) {
    DateFormat["MMddyyyy"] = "MM/dd/yyyy";
    DateFormat["ddMMyyyy"] = "dd/MM/yyyy";
    DateFormat["yyyyMMdd"] = "yyyy/MM/dd";
    DateFormat["MMddyyyyDash"] = "MM-dd-yyyy";
    DateFormat["ddMMyyyyDash"] = "dd-MM-yyyy";
    DateFormat["yyyyMMddDash"] = "yyyy-MM-dd";
    DateFormat["MMddyyyyDot"] = "MM.dd.yyyy";
    DateFormat["ddMMyyyyDot"] = "dd.MM.yyyy";
    DateFormat["yyyyMMddDot"] = "yyyy.MM.dd";
    DateFormat["MMMdyyyy"] = "MMM d, yyyy";
    DateFormat["dMMMMyyyy"] = "d MMM yyyy";
    DateFormat["yyyyMMMdd"] = "yyyy MMM d";
})(DateFormat || (exports.DateFormat = DateFormat = {}));
