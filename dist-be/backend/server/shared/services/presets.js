"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.batchAddPreset = exports.deletePreset = exports.updatePreset = exports.addPreset = exports.getAllPresets = void 0;
const dbHelper_1 = require("../utils/dbHelper");
const errorFunctions_1 = require("../utils/errorFunctions");
const filterFunctions_1 = require("../utils/filterFunctions");
const presetFields = [
    'name',
    'businessId',
    'clientId',
    'currencyId',
    'bankId',
    'styleProfilesId',
    'customerNotes',
    'thanksNotes',
    'termsConditionNotes',
    'language',
    'signatureData',
    'signatureSize',
    'signatureType',
    'signatureName',
    'isArchived'
];
const rollbackOrThrow = async (db) => {
    try {
        await db.run('ROLLBACK');
    }
    catch {
        throw new Error(`error.rollbackFailed`);
    }
};
const handleEntity = (db, table, fields) => async (data, isUpdate = false) => {
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
        return { success: true, data: lastID };
    }
    catch (error) {
        return { success: false, ...(0, errorFunctions_1.mapDatabaseError)(error, db.type) };
    }
};
const getPresets = async (db, options) => {
    const { id, filter } = options;
    const whereClause = filter
        ? (0, filterFunctions_1.getWhereClauseFromFilters)({
            filters: filter,
            archivedColumn: 't."isArchived"'
        })
        : '';
    const conditions = [];
    if (id)
        conditions.push(`t."id" = ${id}`);
    if (whereClause)
        conditions.push(whereClause);
    const whereSql = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
    const sql = `
        SELECT
          t.*,
          bu."name" as "businessName",
          bu."address" as "businessAddress",
          bu."role" as "businessRole",
          bu."shortName" as "businessShortName",
          bu."email" as "businessEmail",
          bu."phone" as "businessPhone",
          bu."additional" as "businessAdditional",
          bu."logo" as "businessLogo",
          bu."fileSize" as "businessFileSize",
          bu."fileSize" as "businessFileSize",
          bu."fileType" as "businessFileType",
          bu."fileName" as "businessFileName",
          bu."vatCode" as "businessVatCode",
          cl."name" as "clientName",
          cl."address" as "clientAddress",
          cl."email" as "clientEmail",
          cl."phone" as "clientPhone",
          cl."code" as "clientCode",
          cl."additional" as "clientAdditional",
          cl."vatCode" as "clientVatCode",
          cur."code" as "currencyCode",
          cur."symbol" as "currencySymbol",
          cur."subunit" as "currencySubunit",
          cur."format" as "currencyFormat",
          ba."name" as "bankLabel",
          ba."bankName" as "bankName",
          ba."accountNumber" as "accountNumber",
          ba."swiftCode" as "swiftCode",
          ba."address" as "address",
          ba."branchCode" as "branchCode",
          ba."type" as "type",
          ba."routingNumber" as "routingNumber",
          ba."accountHolder" as "accountHolder",
          ba."sortOrder" as "sortOrder",
          ba."upiCode" as "upiCode",
          ba."qrCodeFileSize" as "qrCodeFileSize",
          ba."qrCodeFileType" as "qrCodeFileType",
          ba."qrCodeFileName" as "qrCodeFileName",
          ba."qrCode" as "qrCode",
          l."id" as "layoutId",
          l."schema" as "layoutSchema",
          sp."name" as "styleProfileName",
          sp."color" as "styleProfileColor",
          sp."logoSize" as "styleProfileLogoSize",
          sp."fontSize" as "styleProfileFontSize",
          sp."fontFamily" as "styleProfileFontFamily",
          sp."tableHeaderStyle" as "styleProfileTableHeaderStyle",
          sp."tableRowStyle" as "styleProfileTableRowStyle",
          sp."pageFormat" as "styleProfilePageFormat",
          sp."labelUpperCase" as "styleProfileLabelUpperCase",
          sp."showQuantity" as "styleProfileShowQuantity",
          sp."showUnit" as "styleProfileShowUnit",
          sp."showRowNo" as "styleProfileShowRowNo",
          sp."fieldSortOrders" as "styleProfileFieldSortOrders",          
          sp."pdfTexts" as "styleProfilePdfTexts",       
          sp."watermarkFileName" as "styleProfileWatermarkFileName",
          sp."watermarkFileType" as "styleProfileWatermarkFileType",
          sp."watermarkFileSize" as "styleProfileWatermarkFileSize",
          sp."watermarkFileData" as "styleProfileWatermarkFileData",
          sp."paidWatermarkFileName" as "styleProfilePaidWatermarkFileName",
          sp."paidWatermarkFileType" as "styleProfilePaidWatermarkFileType",
          sp."paidWatermarkFileSize" as "styleProfilePaidWatermarkFileSize",
          sp."paidWatermarkFileData" as "styleProfilePaidWatermarkFileData"                 
        FROM presets t
        LEFT JOIN style_profiles sp ON sp."id" = t."styleProfilesId"
        LEFT JOIN layouts l ON l."id" = sp."layoutId"
        LEFT JOIN banks ba ON ba."id" = t."bankId"
        LEFT JOIN currencies cur ON cur."id" = t."currencyId"
        LEFT JOIN clients cl ON cl."id" = t."clientId"
        LEFT JOIN businesses bu ON bu."id" = t."businessId"
        ${whereSql}
        ORDER BY t."createdAt" DESC
      `;
    const presets = await db.all(sql);
    const final = presets.map(preset => {
        return {
            ...preset,
            layoutSchema: preset.layoutSchema && typeof preset.layoutSchema === 'string' ? JSON.parse(preset.layoutSchema) : undefined,
            styleProfileFieldSortOrders: preset.styleProfileFieldSortOrders && typeof preset.styleProfileFieldSortOrders === 'string'
                ? JSON.parse(preset.styleProfileFieldSortOrders)
                : preset.styleProfileFieldSortOrders,
            styleProfilePdfTexts: preset.styleProfilePdfTexts && typeof preset.styleProfilePdfTexts === 'string'
                ? JSON.parse(preset.styleProfilePdfTexts)
                : preset.styleProfilePdfTexts
        };
    });
    return final;
};
const getAllPresets = async (db, filter) => {
    const presets = await getPresets(db, { filter });
    return { success: true, data: presets };
};
exports.getAllPresets = getAllPresets;
const addPreset = async (db, data) => {
    try {
        await db.run('BEGIN');
        const handle = handleEntity(db, 'presets', presetFields);
        const result = await handle(data);
        if (!result.success || result.data == undefined) {
            await rollbackOrThrow(db);
            return { success: false, key: result.key };
        }
        await db.run('COMMIT');
        const newId = result.data;
        const newResult = await getPresets(db, { id: newId });
        return { success: true, data: newResult.length > 0 ? newResult[0] : undefined };
    }
    catch (error) {
        await rollbackOrThrow(db);
        return { success: false, ...(0, errorFunctions_1.mapDatabaseError)(error, db.type) };
    }
};
exports.addPreset = addPreset;
const updatePreset = async (db, data) => {
    try {
        await db.run('BEGIN');
        const handle = handleEntity(db, 'presets', presetFields);
        const result = await handle(data, true);
        if (!result.success || result.data == undefined) {
            await rollbackOrThrow(db);
            return { success: false, key: result.key };
        }
        await db.run('COMMIT');
        const newId = result.data;
        const newResult = await getPresets(db, { id: newId });
        return { success: true, data: newResult.length > 0 ? newResult[0] : undefined };
    }
    catch (error) {
        await rollbackOrThrow(db);
        return { success: false, ...(0, errorFunctions_1.mapDatabaseError)(error, db.type) };
    }
};
exports.updatePreset = updatePreset;
const deletePreset = async (db, id) => {
    try {
        await db.run('DELETE FROM presets WHERE "id" = ?;', [id]);
        return { success: true };
    }
    catch (error) {
        return { success: false, ...(0, errorFunctions_1.mapDatabaseError)(error, db.type) };
    }
};
exports.deletePreset = deletePreset;
const batchAddPreset = async (db, data) => {
    const handle = handleEntity(db, 'presets', presetFields);
    try {
        await db.run('BEGIN');
        for (const row of data) {
            const result = await handle(row);
            if (!result.success) {
                try {
                    await db.run('ROLLBACK');
                }
                catch {
                    throw new Error(`error.rollbackFailed`);
                }
                return result;
            }
        }
        await db.run('COMMIT');
        return { success: true };
    }
    catch (error) {
        try {
            await db.run('ROLLBACK');
        }
        catch {
            throw new Error(`error.rollbackFailed`);
        }
        return { success: false, ...(0, errorFunctions_1.mapDatabaseError)(error, db.type) };
    }
};
exports.batchAddPreset = batchAddPreset;
