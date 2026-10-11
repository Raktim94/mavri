"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.up = void 0;
const errorFunctions_1 = require("../utils/errorFunctions");
const up = async (db) => {
    try {
        await db.run(`
      UPDATE style_profiles
      SET "fontFamily" = 'Roboto'
      WHERE "fontFamily" IS NULL;
    `);
    }
    catch (error) {
        return { success: false, ...(0, errorFunctions_1.mapDatabaseError)(error, db.type) };
    }
};
exports.up = up;
