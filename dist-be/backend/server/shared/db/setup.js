"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.initInitialData = exports.initSchema = exports.openSqlLite = exports.openPostgreSql = exports.testPostgresConnection = void 0;
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
const pg_1 = require("pg");
const sqlite3_1 = __importDefault(require("sqlite3"));
const databaseType_1 = require("../enums/databaseType");
const dbHelper_1 = require("../utils/dbHelper");
const client_1 = require("./client");
const sanitizeDatabaseName = (database) => {
    if (typeof database !== 'string' || database.trim().length === 0) {
        throw new Error('error.invalidDBName');
    }
    const trimmed = database.trim();
    const maxLength = 63;
    if (trimmed.length > maxLength) {
        throw new Error('error.databaseNameTooLong');
    }
    if (!/^[A-Za-z0-9_]+$/.test(trimmed)) {
        throw new Error('error.databaseNameInvalid');
    }
    return trimmed;
};
const testPostgresConnection = async (data) => {
    if (!data)
        throw new Error('error.connectionFailed');
    const { host, port, user, password, ssl } = data;
    const client = new pg_1.Client({
        host,
        port,
        user,
        password,
        database: 'postgres',
        ssl
    });
    try {
        await client.connect();
        await client.query('SELECT 1');
    }
    catch {
        throw new Error('error.connectionFailed');
    }
    finally {
        await client.end().catch(() => { });
    }
};
exports.testPostgresConnection = testPostgresConnection;
const openPostgreSql = async (data) => {
    const { host, port, user, password, database, ssl } = data;
    const safeDatabase = sanitizeDatabaseName(database);
    const authPart = password ? `${encodeURIComponent(user)}:${encodeURIComponent(password)}` : encodeURIComponent(user);
    const sslPart = ssl ? '?sslmode=require' : '';
    const connectionString = `postgresql://${authPart}@${host}:${port}/${safeDatabase}${sslPart}`;
    try {
        const tempClient = new pg_1.Client({
            host,
            port,
            user,
            password,
            database: 'postgres',
            ssl
        });
        await tempClient.connect();
        const res = await tempClient.query('SELECT 1 FROM pg_database WHERE datname = $1', [safeDatabase]);
        if (res.rowCount === 0) {
            await tempClient.query(`CREATE DATABASE "${safeDatabase}"`);
        }
        await tempClient.end();
    }
    catch {
        throw new Error('error.databaseCreationFailed');
    }
    const adapter = await (0, client_1.createPostgresAdapter)(connectionString);
    return { db: adapter };
};
exports.openPostgreSql = openPostgreSql;
const openSqlLite = async (data) => {
    const { fullPath, createIfMissing } = data;
    if (!fullPath)
        throw new Error('error.databasePathInvalid');
    const folder = path_1.default.dirname(fullPath);
    fs_1.default.mkdirSync(folder, { recursive: true });
    if (createIfMissing) {
        try {
            if (fs_1.default.existsSync(fullPath)) {
                fs_1.default.unlinkSync(fullPath);
            }
        }
        catch (err) {
            if (err instanceof Error) {
                throw new Error(err.message);
            }
            else {
                throw new Error(String(err));
            }
        }
    }
    else {
        if (!fs_1.default.existsSync(fullPath)) {
            throw new Error('error.databaseFileNotExist');
        }
    }
    const db = await new Promise((resolve, reject) => {
        const database = new sqlite3_1.default.Database(fullPath, err => {
            if (err) {
                reject(new Error(`error.failedToOpenDB`));
                return;
            }
            console.log('Database opened successfully.');
            resolve(database);
        });
    });
    const adapter = (0, client_1.createSqliteAdapter)(db);
    await adapter.run('PRAGMA foreign_keys = ON;');
    return { db: adapter };
};
exports.openSqlLite = openSqlLite;
const initSchema = async (db) => {
    try {
        if (db.type === databaseType_1.DatabaseType.sqlite) {
            await db.run('PRAGMA foreign_keys = ON;');
        }
        await db.run('BEGIN');
        await db.run(`CREATE TABLE IF NOT EXISTS settings (
      "id" ${(0, dbHelper_1.getColumnType)('INTEGER PRIMARY KEY AUTOINCREMENT', db.type)},
      "language" TEXT NOT NULL DEFAULT 'en',
      "amountFormat" TEXT NOT NULL DEFAULT 'en-US',
      "dateFormat" TEXT NOT NULL DEFAULT 'MM/dd/yyyy',
      "isDarkMode" INTEGER NOT NULL DEFAULT 1 CHECK ("isDarkMode" IN (0,1)),
      "invoicePrefix" TEXT,
      "invoiceSuffix" TEXT,
      "shouldIncludeYear" INTEGER NOT NULL DEFAULT 1 CHECK ("shouldIncludeYear" IN (0,1)),
      "shouldIncludeMonth" INTEGER NOT NULL DEFAULT 1 CHECK ("shouldIncludeMonth" IN (0,1)),
      "shouldIncludeBusinessName" INTEGER NOT NULL DEFAULT 1 CHECK ("shouldIncludeBusinessName" IN (0,1)),
      "quotesON" INTEGER NOT NULL DEFAULT 1 CHECK ("quotesON" IN (0,1)),
      "reportsON" INTEGER NOT NULL DEFAULT 1 CHECK ("reportsON" IN (0,1)),
      "createdAt" ${(0, dbHelper_1.getColumnType)('DATETIME', db.type)} NOT NULL DEFAULT ${(0, dbHelper_1.getDefaultValue)("(datetime('now'))", db.type)},
      "updatedAt" ${(0, dbHelper_1.getColumnType)('DATETIME', db.type)} NOT NULL DEFAULT ${(0, dbHelper_1.getDefaultValue)("(datetime('now'))", db.type)}
    )`);
        await db.run(`CREATE TABLE IF NOT EXISTS businesses (
      "id" ${(0, dbHelper_1.getColumnType)('INTEGER PRIMARY KEY AUTOINCREMENT', db.type)},
      "name" TEXT NOT NULL,
      "shortName" TEXT NOT NULL CHECK (length("shortName") <= 2),
      "address" TEXT,
      "role" TEXT,
      "email" TEXT,
      "phone" TEXT,
      "website" TEXT,
      "additional" TEXT,
      "paymentInformation" TEXT,
      "logo" ${(0, dbHelper_1.getColumnType)('BLOB', db.type)},
      "fileSize" INTEGER,
      "fileType" TEXT,
      "fileName" TEXT,
      "description" TEXT,
      "isArchived" INTEGER NOT NULL DEFAULT 0 CHECK ("isArchived" IN (0,1)),
      "createdAt" ${(0, dbHelper_1.getColumnType)('DATETIME', db.type)} NOT NULL DEFAULT ${(0, dbHelper_1.getDefaultValue)("(datetime('now'))", db.type)},
      "updatedAt" ${(0, dbHelper_1.getColumnType)('DATETIME', db.type)} NOT NULL DEFAULT ${(0, dbHelper_1.getDefaultValue)("(datetime('now'))", db.type)}
    );`);
        await db.run(`CREATE TABLE IF NOT EXISTS clients (
      "id" ${(0, dbHelper_1.getColumnType)('INTEGER PRIMARY KEY AUTOINCREMENT', db.type)},
      "name" TEXT NOT NULL,
      "shortName" TEXT NOT NULL CHECK (length("shortName") <= 2),
      "address" TEXT,
      "email" TEXT,
      "phone" TEXT,
      "code" TEXT,
      "additional" TEXT,
      "description" TEXT,
      "isArchived" INTEGER NOT NULL DEFAULT 0 CHECK ("isArchived" IN (0,1)),
      "createdAt" ${(0, dbHelper_1.getColumnType)('DATETIME', db.type)} NOT NULL DEFAULT ${(0, dbHelper_1.getDefaultValue)("(datetime('now'))", db.type)},
      "updatedAt" ${(0, dbHelper_1.getColumnType)('DATETIME', db.type)} NOT NULL DEFAULT ${(0, dbHelper_1.getDefaultValue)("(datetime('now'))", db.type)}
    );`);
        await db.run(`CREATE TABLE IF NOT EXISTS units (
      "id" ${(0, dbHelper_1.getColumnType)('INTEGER PRIMARY KEY AUTOINCREMENT', db.type)},
      "name" TEXT NOT NULL UNIQUE,
      "isArchived" INTEGER NOT NULL DEFAULT 0 CHECK ("isArchived" IN (0,1)),
      "createdAt" ${(0, dbHelper_1.getColumnType)('DATETIME', db.type)} NOT NULL DEFAULT ${(0, dbHelper_1.getDefaultValue)("(datetime('now'))", db.type)},
      "updatedAt" ${(0, dbHelper_1.getColumnType)('DATETIME', db.type)} NOT NULL DEFAULT ${(0, dbHelper_1.getDefaultValue)("(datetime('now'))", db.type)}
    );`);
        await db.run(`CREATE TABLE IF NOT EXISTS categories (
      "id" ${(0, dbHelper_1.getColumnType)('INTEGER PRIMARY KEY AUTOINCREMENT', db.type)},
      "name" TEXT NOT NULL UNIQUE,
      "isArchived" INTEGER NOT NULL DEFAULT 0 CHECK ("isArchived" IN (0,1)),
      "createdAt" ${(0, dbHelper_1.getColumnType)('DATETIME', db.type)} NOT NULL DEFAULT ${(0, dbHelper_1.getDefaultValue)("(datetime('now'))", db.type)},
      "updatedAt" ${(0, dbHelper_1.getColumnType)('DATETIME', db.type)} NOT NULL DEFAULT ${(0, dbHelper_1.getDefaultValue)("(datetime('now'))", db.type)}
    );`);
        await db.run(`CREATE TABLE IF NOT EXISTS currencies (
      "id" ${(0, dbHelper_1.getColumnType)('INTEGER PRIMARY KEY AUTOINCREMENT', db.type)},
      "code" TEXT NOT NULL UNIQUE,
      "symbol" TEXT NOT NULL,
      "text" TEXT NOT NULL,
      "format" TEXT NOT NULL,
      "subunit" INTEGER NOT NULL DEFAULT 100,
      "isArchived" INTEGER NOT NULL DEFAULT 0 CHECK ("isArchived" IN (0,1)),
      "createdAt" ${(0, dbHelper_1.getColumnType)('DATETIME', db.type)} NOT NULL DEFAULT ${(0, dbHelper_1.getDefaultValue)("(datetime('now'))", db.type)},
      "updatedAt" ${(0, dbHelper_1.getColumnType)('DATETIME', db.type)} NOT NULL DEFAULT ${(0, dbHelper_1.getDefaultValue)("(datetime('now'))", db.type)}
    );`);
        await db.run(`CREATE TABLE IF NOT EXISTS items (
      "id" ${(0, dbHelper_1.getColumnType)('INTEGER PRIMARY KEY AUTOINCREMENT', db.type)},
      "name" TEXT NOT NULL,
      "amount" TEXT NOT NULL DEFAULT '0',
      "unitId" INTEGER,
      "categoryId" INTEGER,
      "description" TEXT,
      "isArchived" INTEGER NOT NULL DEFAULT 0 CHECK ("isArchived" IN (0,1)),
      "createdAt" ${(0, dbHelper_1.getColumnType)('DATETIME', db.type)} NOT NULL DEFAULT ${(0, dbHelper_1.getDefaultValue)("(datetime('now'))", db.type)},
      "updatedAt" ${(0, dbHelper_1.getColumnType)('DATETIME', db.type)} NOT NULL DEFAULT ${(0, dbHelper_1.getDefaultValue)("(datetime('now'))", db.type)},
      FOREIGN KEY ("unitId") REFERENCES units("id"),
      FOREIGN KEY ("categoryId") REFERENCES categories("id")
    );`);
        await db.run(`CREATE TABLE IF NOT EXISTS invoices (
      "id" ${(0, dbHelper_1.getColumnType)('INTEGER PRIMARY KEY AUTOINCREMENT', db.type)},
      "invoiceType" TEXT NOT NULL CHECK("invoiceType" IN ('quotation','invoice')),
      "convertedFromQuotationId" INTEGER NULL,
      "businessId" INTEGER NOT NULL,
      "clientId" INTEGER NOT NULL,
      "currencyId" INTEGER NOT NULL,
      "createdAt" ${(0, dbHelper_1.getColumnType)('DATETIME', db.type)} NOT NULL DEFAULT ${(0, dbHelper_1.getDefaultValue)("(datetime('now'))", db.type)},
      "updatedAt" ${(0, dbHelper_1.getColumnType)('DATETIME', db.type)} NOT NULL DEFAULT ${(0, dbHelper_1.getDefaultValue)("(datetime('now'))", db.type)},
      "issuedAt" ${(0, dbHelper_1.getColumnType)('DATETIME', db.type)} NOT NULL,
      "dueDate" ${(0, dbHelper_1.getColumnType)('DATETIME', db.type)},
      "invoiceNumber" TEXT NOT NULL,
      "isArchived" INTEGER NOT NULL DEFAULT 0 CHECK ("isArchived" IN (0,1)),
      "status" TEXT NOT NULL DEFAULT 'unpaid' CHECK ("status" IN ('unpaid','open','closed','partially','paid')),
      "customerNotes" TEXT,
      "thanksNotes" TEXT,
      "termsConditionNotes" TEXT,
      "discountName" TEXT,
      "businessNameSnapshot" TEXT NOT NULL,
      "businessShortNameSnapshot" TEXT NOT NULL CHECK (length("businessShortNameSnapshot") <= 2),
      "businessAddressSnapshot" TEXT,
      "businessRoleSnapshot" TEXT,
      "businessEmailSnapshot" TEXT,
      "businessPhoneSnapshot" TEXT,
      "businessAdditionalSnapshot" TEXT,
      "businessPaymentInformationSnapshot" TEXT,
      "businessLogoSnapshot" ${(0, dbHelper_1.getColumnType)('BLOB', db.type)},
      "businessFileSizeSnapshot" INTEGER,
      "businessFileTypeSnapshot" TEXT,
      "businessFileNameSnapshot" TEXT,
      "clientNameSnapshot" TEXT NOT NULL,
      "clientAddressSnapshot" TEXT,
      "clientEmailSnapshot" TEXT,
      "clientPhoneSnapshot" TEXT,
      "clientCodeSnapshot" TEXT,
      "clientAdditionalSnapshot" TEXT,
      "currencyCodeSnapshot" TEXT NOT NULL,
      "currencySymbolSnapshot" TEXT NOT NULL,
      "currencySubunitSnapshot" INTEGER NOT NULL,
      "discountType" TEXT CHECK("discountType" IN ('fixed','percentage') OR "discountType" IS NULL),
      "discountAmountCents" INTEGER NOT NULL DEFAULT 0,
      "discountPercent" REAL NOT NULL DEFAULT 0,
      "shippingFeeCents" INTEGER NOT NULL DEFAULT 0,
      "invoicePrefixSnapshot" TEXT,
      "invoiceSuffixSnapshot" TEXT,
      "customizationColor" TEXT NOT NULL DEFAULT '#006400',
      "customizationLogoSize" TEXT NOT NULL DEFAULT 'medium',
      "customizationFontSizeSize" TEXT NOT NULL DEFAULT 'medium',
      "customizationLayout" TEXT NOT NULL DEFAULT 'classic',
      "customizationTableHeaderStyle" TEXT NOT NULL DEFAULT 'light',
      "customizationTableRowStyle" TEXT NOT NULL DEFAULT 'classic',
      "customizationPageFormat" TEXT NOT NULL DEFAULT 'A4',
      "customizationLabelUpperCase" INTEGER NOT NULL DEFAULT 0 CHECK ("customizationLabelUpperCase" IN (0,1)),
      "customizationWatermarkFileName" TEXT,
      "customizationWatermarkFileType" TEXT,
      "customizationWatermarkFileSize" INTEGER,
      "customizationWatermarkFileData" ${(0, dbHelper_1.getColumnType)('BLOB', db.type)},
      "customizationPaidWatermarkFileName" TEXT,
      "customizationPaidWatermarkFileType" TEXT,
      "customizationPaidWatermarkFileSize" INTEGER,
      "customizationPaidWatermarkFileData" ${(0, dbHelper_1.getColumnType)('BLOB', db.type)},
      "taxName" TEXT,
      "taxRate" REAL NOT NULL DEFAULT 0,
      "taxType" TEXT CHECK("taxType" IN ('exclusive','inclusive','deducted') OR "taxType" IS NULL),
      FOREIGN KEY ("businessId") REFERENCES businesses(id),
      FOREIGN KEY ("clientId") REFERENCES clients(id),
      FOREIGN KEY ("currencyId") REFERENCES currencies(id),
      FOREIGN KEY ("convertedFromQuotationId") REFERENCES invoices(id),
      UNIQUE ("businessId", "invoiceNumber"),
      CHECK (
        ("discountType" = 'fixed' AND "discountAmountCents" >= 0 AND "discountPercent" = 0) OR
        ("discountType" = 'percentage' AND "discountPercent" <= 100 AND "discountPercent" >= 0 AND "discountAmountCents" = 0) OR
        ("discountType" IS NULL AND "discountAmountCents" = 0 AND "discountPercent" = 0)
      ),
      CHECK ("dueDate" IS NULL OR "dueDate" >= "issuedAt"),
      CHECK ("convertedFromQuotationId" IS NULL OR "convertedFromQuotationId" != "id")
    );`);
        await db.run(`CREATE TABLE IF NOT EXISTS invoice_items (
      "id" ${(0, dbHelper_1.getColumnType)('INTEGER PRIMARY KEY AUTOINCREMENT', db.type)},
      "parentInvoiceId" INTEGER NOT NULL,    
      "itemId" INTEGER NOT NULL,
      "itemNameSnapshot" TEXT NOT NULL,
      "unitPriceCentsSnapshot" INTEGER NOT NULL DEFAULT 0, 
      "unitNameSnapshot" TEXT,
      "quantity" REAL NOT NULL DEFAULT 0,
      "taxRate" REAL NOT NULL DEFAULT 0,
      "taxType" TEXT CHECK("taxType" IN ('exclusive','inclusive') OR "taxType" IS NULL),
      "createdAt" ${(0, dbHelper_1.getColumnType)('DATETIME', db.type)} NOT NULL DEFAULT ${(0, dbHelper_1.getDefaultValue)("(datetime('now'))", db.type)},
      "updatedAt" ${(0, dbHelper_1.getColumnType)('DATETIME', db.type)} NOT NULL DEFAULT ${(0, dbHelper_1.getDefaultValue)("(datetime('now'))", db.type)},
      FOREIGN KEY ("parentInvoiceId") REFERENCES invoices("id") ON DELETE CASCADE,
      FOREIGN KEY ("itemId") REFERENCES items("id")
    );`);
        await db.run(`CREATE TABLE IF NOT EXISTS invoice_payments (
      "id" ${(0, dbHelper_1.getColumnType)('INTEGER PRIMARY KEY AUTOINCREMENT', db.type)},
      "parentInvoiceId" INTEGER NOT NULL,   
      "amountCents" INTEGER NOT NULL,
      "paidAt" ${(0, dbHelper_1.getColumnType)('DATETIME', db.type)} NOT NULL DEFAULT ${(0, dbHelper_1.getDefaultValue)("(datetime('now'))", db.type)},
      "paymentMethod" TEXT NOT NULL,           
      "notes" TEXT,
      "createdAt" ${(0, dbHelper_1.getColumnType)('DATETIME', db.type)} NOT NULL DEFAULT ${(0, dbHelper_1.getDefaultValue)("(datetime('now'))", db.type)},
      "updatedAt" ${(0, dbHelper_1.getColumnType)('DATETIME', db.type)} NOT NULL DEFAULT ${(0, dbHelper_1.getDefaultValue)("(datetime('now'))", db.type)},
      FOREIGN KEY ("parentInvoiceId") REFERENCES invoices("id") ON DELETE CASCADE
    );`);
        await db.run(`CREATE TABLE IF NOT EXISTS attachments (
      id ${(0, dbHelper_1.getColumnType)('INTEGER PRIMARY KEY AUTOINCREMENT', db.type)},
      "parentInvoiceId" INTEGER NOT NULL,   
      "fileName" TEXT NOT NULL,
      "fileType" TEXT NOT NULL,            
      "fileSize" INTEGER NOT NULL,        
      "data" ${(0, dbHelper_1.getColumnType)('BLOB', db.type)} NOT NULL,                
      "createdAt" ${(0, dbHelper_1.getColumnType)('DATETIME', db.type)} NOT NULL DEFAULT ${(0, dbHelper_1.getDefaultValue)("(datetime('now'))", db.type)},
      "updatedAt" ${(0, dbHelper_1.getColumnType)('DATETIME', db.type)} NOT NULL DEFAULT ${(0, dbHelper_1.getDefaultValue)("(datetime('now'))", db.type)},
      FOREIGN KEY ("parentInvoiceId") REFERENCES invoices("id") ON DELETE CASCADE
    );`);
        await db.run(`CREATE INDEX IF NOT EXISTS idx_invoice_items_invoiceId ON invoice_items("parentInvoiceId")`);
        await db.run(`CREATE INDEX IF NOT EXISTS idx_invoice_payments_invoiceId ON invoice_payments("parentInvoiceId")`);
        await db.run(`CREATE INDEX IF NOT EXISTS idx_attachments_invoiceId ON attachments("parentInvoiceId")`);
        await db.run(`CREATE INDEX IF NOT EXISTS idx_invoices_clientId ON invoices("clientId")`);
        await db.run(`CREATE INDEX IF NOT EXISTS idx_invoices_businessId ON invoices("businessId")`);
        await db.run(`CREATE INDEX IF NOT EXISTS idx_invoices_business_client ON invoices("businessId", "clientId")`);
        await db.run(`CREATE INDEX IF NOT EXISTS idx_invoices_type ON invoices("invoiceType")`);
        await db.run(`CREATE INDEX IF NOT EXISTS idx_invoices_convertedFromQuotationId ON invoices("convertedFromQuotationId")`);
        await db.run(`CREATE INDEX IF NOT EXISTS idx_invoice_items_itemId ON invoice_items("itemId")`);
        await db.run(`CREATE INDEX IF NOT EXISTS idx_items_unitId ON items("unitId")`);
        await db.run(`CREATE INDEX IF NOT EXISTS idx_items_categoryId ON items("categoryId")`);
        await db.run(`CREATE INDEX IF NOT EXISTS idx_clients_active ON clients("isArchived")`);
        await db.run(`CREATE INDEX IF NOT EXISTS idx_items_active ON items("isArchived")`);
        await db.run(`CREATE INDEX IF NOT EXISTS idx_businesses_active ON businesses("isArchived")`);
        await db.run(`CREATE INDEX IF NOT EXISTS idx_categories_active ON categories("isArchived")`);
        await db.run(`CREATE INDEX IF NOT EXISTS idx_units_active ON units("isArchived")`);
        await db.run(`CREATE INDEX IF NOT EXISTS idx_currencies_active ON currencies("isArchived")`);
        await db.run(`CREATE INDEX IF NOT EXISTS idx_invoices_invoiceNumber ON invoices("invoiceNumber")`);
        await db.run(`CREATE INDEX IF NOT EXISTS idx_invoices_status ON invoices("status")`);
        await db.run(`CREATE INDEX IF NOT EXISTS idx_invoices_issuedAt ON invoices("issuedAt")`);
        await db.run('COMMIT');
    }
    catch {
        try {
            await db.run('ROLLBACK');
        }
        catch {
            throw new Error(`error.rollbackFailed`);
        }
        throw new Error(`error.schemaInitFailed`);
    }
};
exports.initSchema = initSchema;
const initInitialData = async (db) => {
    const row = await db.query('SELECT * FROM settings LIMIT 1');
    if (row && row.rows.length > 0)
        return;
    await db.run((0, dbHelper_1.insertOrIgnore)('settings', [], [[]], db.type, 'id'));
    await db.run((0, dbHelper_1.insertOrIgnore)('currencies', ['code', 'symbol', 'text', 'format', 'subunit'], [
        ['USD', '$', 'United States Dollar', '{symbol}{amount}', '100'],
        ['EUR', '€', 'Euro', '{symbol}{amount}', '100'],
        ['SEK', 'kr', 'Swedish Krona', '{symbol} {amount}', '100'],
        ['GBP', '£', 'British Pound', '{symbol}{amount}', '100'],
        ['JPY', '¥', 'Japanese Yen', '{symbol}{amount}', '1'],
        ['AUD', 'A$', 'Australian Dollar', '{symbol}{amount}', '100'],
        ['CAD', 'CA$', 'Canadian Dollar', '{symbol}{amount}', '100'],
        ['CHF', 'CHF', 'Swiss Franc', '{symbol} {amount}', '100'],
        ['CNY', '¥', 'Chinese Yuan', '{symbol}{amount}', '100'],
        ['INR', '₹', 'Indian Rupee', '{symbol}{amount}', '100']
    ], db.type, 'code'));
    await db.run((0, dbHelper_1.insertOrIgnore)('units', ['name'], [
        ['pcs'],
        ['kgs'],
        ['gs'],
        ['lbs'],
        ['ozs'],
        ['ls'],
        ['mls'],
        ['ms'],
        ['cms'],
        ['fts'],
        ['hrs'],
        ['mins'],
        ['secs']
    ], db.type, 'name'));
    await db.run((0, dbHelper_1.insertOrIgnore)('categories', ['name'], [['Goods'], ['Services']], db.type, 'name'));
};
exports.initInitialData = initInitialData;
