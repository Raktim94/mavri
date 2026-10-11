"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.importAllData = exports.exportAllData = void 0;
const databaseType_1 = require("../enums/databaseType");
const dataUrlFunctions_1 = require("../utils/dataUrlFunctions");
const dbHelper_1 = require("../utils/dbHelper");
const errorFunctions_1 = require("../utils/errorFunctions");
const exportAllData = async (db) => {
    try {
        const presets = await db.all('SELECT * FROM presets');
        const invoiceSequences = await db.all('SELECT * FROM invoice_sequences');
        const banks = await db.all('SELECT * FROM banks');
        const layouts = await db.all('SELECT * FROM layouts');
        const styleProfiles = await db.all('SELECT * FROM style_profiles');
        const settingsRow = await db.get('SELECT * FROM settings LIMIT 1');
        const businesses = await db.all('SELECT * FROM businesses');
        const clients = await db.all('SELECT * FROM clients');
        const items = await db.all('SELECT * FROM items');
        const units = await db.all('SELECT * FROM units');
        const categories = await db.all('SELECT * FROM categories');
        const currencies = await db.all('SELECT * FROM currencies');
        const invoices = await db.all('SELECT * FROM invoices');
        const invoiceLayoutSnapshots = await db.all('SELECT * FROM invoice_layout_snapshots');
        const invoiceBankSnapshots = await db.all('SELECT * FROM invoice_bank_snapshots');
        const invoiceBusinessSnapshots = await db.all('SELECT * FROM invoice_business_snapshots');
        const invoiceClientSnapshots = await db.all('SELECT * FROM invoice_client_snapshots');
        const invoiceCurrencySnapshots = await db.all('SELECT * FROM invoice_currency_snapshots');
        const invoiceStyleProfileSnapshots = await db.all('SELECT * FROM invoice_style_profile_snapshots');
        const invoiceItemSnapshots = await db.all('SELECT * FROM invoice_item_snapshots');
        const invoiceCustomizations = await db.all('SELECT * FROM invoice_customizations');
        const invoiceItems = await db.all('SELECT * FROM invoice_items');
        const invoicePayments = await db.all('SELECT * FROM invoice_payments');
        const attachments = await db.all('SELECT * FROM attachments');
        const presetsModified = presets.map(item => (0, dataUrlFunctions_1.encodePreset)(item, true));
        const attachmentsModified = attachments.map(dataUrlFunctions_1.encodeInvoiceAttachment);
        const businessesModified = businesses.map(dataUrlFunctions_1.encodeLogo);
        const styleProfilesModified = styleProfiles.map(dataUrlFunctions_1.encodeStyleProfile);
        const banksModified = banks.map(dataUrlFunctions_1.encodeBank);
        const invoicesModified = invoices.map(dataUrlFunctions_1.encodeInvoiceExport);
        const invoiceBankSnapshotsModified = invoiceBankSnapshots.map(dataUrlFunctions_1.encodeInvoiceBankSnapshotExport);
        const invoiceBusinessSnapshotsModified = invoiceBusinessSnapshots.map(dataUrlFunctions_1.encodeInvoiceBusinessSnapshotExport);
        const invoiceCustomizationsModified = invoiceCustomizations.map(dataUrlFunctions_1.encodeInvoiceCustomizationExport);
        const payload = {
            presets: presetsModified,
            settings: settingsRow ?? null,
            businesses: businessesModified,
            clients,
            invoiceSequences,
            items,
            units,
            categories,
            currencies,
            layouts,
            invoices: invoicesModified,
            invoiceBankSnapshots: invoiceBankSnapshotsModified,
            invoiceBusinessSnapshots: invoiceBusinessSnapshotsModified,
            invoiceCustomizations: invoiceCustomizationsModified,
            invoiceClientSnapshots,
            invoiceCurrencySnapshots,
            invoiceStyleProfileSnapshots,
            invoiceLayoutSnapshots,
            styleProfiles: styleProfilesModified,
            banks: banksModified,
            invoiceItems,
            invoiceItemSnapshots,
            invoicePayments,
            attachments: attachmentsModified
        };
        return { success: true, data: payload };
    }
    catch (error) {
        return { success: false, ...(0, errorFunctions_1.mapDatabaseError)(error, db.type) };
    }
};
exports.exportAllData = exportAllData;
const importAllData = async (db, parsed) => {
    const runInTransaction = async (fn) => {
        try {
            if (db.type === databaseType_1.DatabaseType.sqlite) {
                await db.run('PRAGMA foreign_keys = OFF;');
            }
            await db.run('BEGIN');
            await fn();
            await db.run('COMMIT');
        }
        catch (err) {
            try {
                await db.run('ROLLBACK');
            }
            catch {
                throw new Error(`error.rollbackFailed`);
            }
            throw err;
        }
        finally {
            if (db.type === databaseType_1.DatabaseType.sqlite) {
                await db.run('PRAGMA foreign_keys = ON;');
            }
        }
    };
    const insertRows = async (table, rows) => {
        for (let row of rows) {
            row = (0, dbHelper_1.convertBooleanFieldsToInt)(row);
            const keys = Object.keys(row).filter(k => k !== 'invoiceFullNumber');
            if (!keys.length)
                continue;
            const cols = keys.map(k => `"${k}"`).join(',');
            const placeholders = keys.map(() => '?').join(',');
            const params = keys.map(k => (0, dbHelper_1.toDbValue)(row[k]));
            if (db.type === databaseType_1.DatabaseType.postgre) {
                await db.run(`INSERT INTO ${table} (${cols}) 
          OVERRIDING SYSTEM VALUE
          VALUES (${placeholders})`, params);
            }
            else {
                await db.run(`INSERT INTO ${table} (${cols}) VALUES (${placeholders})`, params);
            }
        }
    };
    const updateSettings = async (settings) => {
        settings = (0, dbHelper_1.convertBooleanFieldsToInt)(settings);
        const fields = [];
        const params = [];
        Object.entries(settings).forEach(([k, v]) => {
            if (k === 'id')
                return;
            fields.push(`"${k}" = ?`);
            params.push((0, dbHelper_1.toDbValue)(v));
        });
        if (fields.length) {
            await db.run(`UPDATE settings SET ${fields.join(', ')} WHERE "id" = (SELECT "id" FROM settings LIMIT 1)`, params);
        }
    };
    try {
        if (!parsed || typeof parsed !== 'object')
            return { success: false, key: 'invalidFile' };
        await runInTransaction(async () => {
            const deleteOrder = [
                'presets',
                'invoice_sequences',
                'invoice_style_profile_snapshots',
                'invoice_customizations',
                'invoice_currency_snapshots',
                'invoice_client_snapshots',
                'invoice_bank_snapshots',
                'invoice_business_snapshots',
                'invoice_item_snapshots',
                'invoice_items',
                'invoice_layout_snapshots',
                'attachments',
                'invoices',
                'items',
                'businesses',
                'clients',
                'units',
                'categories',
                'currencies',
                'style_profiles',
                'layouts',
                'banks'
            ];
            for (const table of deleteOrder) {
                await db.run(`DELETE FROM ${table}`);
            }
            const tableDataMap = {
                currencies: 'currencies',
                units: 'units',
                categories: 'categories',
                businesses: 'businesses',
                layouts: 'layouts',
                style_profiles: 'styleProfiles',
                banks: 'banks',
                clients: 'clients',
                items: 'items',
                invoices: 'invoices',
                invoice_sequences: 'invoiceSequences',
                invoice_style_profile_snapshots: 'invoiceStyleProfileSnapshots',
                invoice_business_snapshots: 'invoiceBusinessSnapshots',
                invoice_bank_snapshots: 'invoiceBankSnapshots',
                invoice_customizations: 'invoiceCustomizations',
                invoice_client_snapshots: 'invoiceClientSnapshots',
                invoice_currency_snapshots: 'invoiceCurrencySnapshots',
                invoice_items: 'invoiceItems',
                invoice_item_snapshots: 'invoiceItemSnapshots',
                invoice_layout_snapshots: 'invoiceLayoutSnapshots',
                invoice_payments: 'invoicePayments',
                attachments: 'attachments',
                presets: 'presets'
            };
            const parsedMut = { ...parsed };
            if (Array.isArray(parsedMut.attachments)) {
                parsedMut.attachments = parsedMut.attachments.map(dataUrlFunctions_1.decodeInvoiceAttachment);
            }
            if (Array.isArray(parsedMut.styleProfiles)) {
                parsedMut.styleProfiles = parsedMut.styleProfiles.map(dataUrlFunctions_1.decodeStyleProfile);
            }
            if (Array.isArray(parsedMut.banks)) {
                parsedMut.banks = parsedMut.banks.map(dataUrlFunctions_1.decodeBank);
            }
            if (Array.isArray(parsedMut.businesses)) {
                parsedMut.businesses = parsedMut.businesses.map(dataUrlFunctions_1.decodeLogo);
            }
            if (Array.isArray(parsedMut.invoices)) {
                parsedMut.invoices = parsedMut.invoices.map(dataUrlFunctions_1.decodeInvoiceImport);
            }
            if (Array.isArray(parsedMut.invoiceBusinessSnapshots)) {
                parsedMut.invoiceBusinessSnapshots = parsedMut.invoiceBusinessSnapshots.map(dataUrlFunctions_1.decodeInvoiceBusinessSnapshotImport);
            }
            if (Array.isArray(parsedMut.invoiceBankSnapshots)) {
                parsedMut.invoiceBankSnapshots = parsedMut.invoiceBankSnapshots.map(dataUrlFunctions_1.decodeInvoiceBankSnapshotImport);
            }
            if (Array.isArray(parsedMut.invoiceCustomizations)) {
                parsedMut.invoiceCustomizations = parsedMut.invoiceCustomizations.map(dataUrlFunctions_1.decodeInvoiceCustomizationImport);
            }
            if (Array.isArray(parsedMut.presets)) {
                parsedMut.presets = parsedMut.presets.map(item => (0, dataUrlFunctions_1.decodePreset)(item, true));
            }
            for (const [table, key] of Object.entries(tableDataMap)) {
                await insertRows(table, parsedMut[key] ?? []);
                if (db.type === databaseType_1.DatabaseType.postgre) {
                    await db.run(`
            SELECT setval(
              pg_get_serial_sequence('${table}', 'id'),
              (SELECT MAX(id) FROM ${table})
            );`);
                }
            }
            if (parsedMut.settings && typeof parsedMut.settings === 'object') {
                await updateSettings(parsedMut.settings);
            }
        });
        return { success: true };
    }
    catch (error) {
        return { success: false, ...(0, errorFunctions_1.mapDatabaseError)(error, db.type) };
    }
};
exports.importAllData = importAllData;
