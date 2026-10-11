"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getUsSalesTaxRateByState = exports.getAllUsSalesTaxRates = void 0;
const errorFunctions_1 = require("../utils/errorFunctions");
const getAllUsSalesTaxRates = async (db) => {
    try {
        const rows = await db.all(`SELECT * FROM us_sales_tax_rates ORDER BY "stateName" ASC`);
        return { success: true, message: undefined, key: undefined, data: rows };
    }
    catch (error) {
        return { success: false, ...(0, errorFunctions_1.mapDatabaseError)(error, db.type) };
    }
};
exports.getAllUsSalesTaxRates = getAllUsSalesTaxRates;
const getUsSalesTaxRateByState = async (db, stateCode) => {
    try {
        const row = await db.get(`SELECT * FROM us_sales_tax_rates WHERE "stateCode" = ?`, [
            stateCode.toUpperCase()
        ]);
        return { success: true, message: undefined, key: undefined, data: row ?? null };
    }
    catch (error) {
        return { success: false, ...(0, errorFunctions_1.mapDatabaseError)(error, db.type) };
    }
};
exports.getUsSalesTaxRateByState = getUsSalesTaxRateByState;
