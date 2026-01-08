import type { BrowserWindow } from 'electron';
import fs from 'fs';
import path from 'path';
import sqlite3 from 'sqlite3';
import { initIpcHandler } from './ipc';
import { runMigrations } from './migration';
import { getFirstRow, runAsync } from './utils/dbFuntions';

let db: sqlite3.Database;
let dbPath: string | undefined;

const initInitialData = async () => {
  const row = await getFirstRow(db, 'SELECT * FROM settings LIMIT 1');

  if (row) return null;

  await runAsync(db, `INSERT OR IGNORE INTO settings DEFAULT VALUES`);
  await runAsync(
    db,
    `
      INSERT OR IGNORE INTO currencies (code, symbol, text, format, subunit)
      VALUES
        ('USD', '$', 'United States Dollar', '{symbol}{amount}', 100),
        ('EUR', '€', 'Euro', '{symbol}{amount}', 100),
        ('SEK', 'kr', 'Swedish Krona', '{symbol} {amount}', 100),
        ('GBP', '£', 'British Pound', '{symbol}{amount}', 100),
        ('JPY', '¥', 'Japanese Yen', '{symbol}{amount}', 1),
        ('AUD', 'A$', 'Australian Dollar', '{symbol}{amount}', 100),
        ('CAD', 'CA$', 'Canadian Dollar', '{symbol}{amount}', 100),
        ('CHF', 'CHF', 'Swiss Franc', '{symbol} {amount}', 100),
        ('CNY', '¥', 'Chinese Yuan', '{symbol}{amount}', 100),
        ('INR', '₹', 'Indian Rupee', '{symbol}{amount}', 100);
    `
  );
  await runAsync(
    db,
    `
      INSERT OR IGNORE INTO units (name)
      VALUES
        ('pcs'),
        ('kgs'),
        ('gs'),
        ('lbs'),
        ('ozs'),
        ('ls'),
        ('mls'),
        ('ms'),
        ('cms'),
        ('fts'),
        ('hrs'),
        ('mins'),
        ('secs');
    `
  );
  await runAsync(
    db,
    `
      INSERT OR IGNORE INTO categories (name)
      VALUES
        ('Goods'),
        ('Services');
    `
  );
};

const init = async () => {
  await runAsync(db, 'PRAGMA foreign_keys = ON;');
  await runAsync(
    db,
    `
    CREATE TABLE IF NOT EXISTS settings (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      language TEXT NOT NULL DEFAULT 'en',
      amountFormat TEXT NOT NULL DEFAULT 'en-US',
      dateFormat TEXT NOT NULL DEFAULT 'MM/dd/yyyy',
      isDarkMode INTEGER NOT NULL DEFAULT 1 CHECK (isDarkMode IN (0,1)),
      invoicePrefix TEXT,
      invoiceSuffix TEXT,
      shouldIncludeYear INTEGER NOT NULL DEFAULT 1 CHECK (shouldIncludeYear IN (0,1)),
      shouldIncludeMonth INTEGER NOT NULL DEFAULT 1 CHECK (shouldIncludeMonth IN (0,1)),
      shouldIncludeBusinessName INTEGER NOT NULL DEFAULT 1 CHECK (shouldIncludeBusinessName IN (0,1)),
      quotesON INTEGER NOT NULL DEFAULT 1 CHECK (quotesON IN (0,1)),
      reportsON INTEGER NOT NULL DEFAULT 1 CHECK (reportsON IN (0,1)),
      createdAt DATETIME NOT NULL DEFAULT (datetime('now')),
      updatedAt DATETIME NOT NULL DEFAULT (datetime('now'))
    )
  `
  );
  await runAsync(
    db,
    `
    CREATE TABLE IF NOT EXISTS businesses (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      shortName TEXT NOT NULL CHECK (length(shortName) <= 2),
      address TEXT,
      role TEXT,
      email TEXT,
      phone TEXT,
      website TEXT,
      additional TEXT,
      paymentInformation TEXT,
      logo BLOB,
      fileSize INTEGER,
      fileType TEXT,
      fileName TEXT,
      description TEXT,
      isArchived INTEGER NOT NULL DEFAULT 0 CHECK (isArchived IN (0,1)),
      createdAt DATETIME NOT NULL DEFAULT (datetime('now')),
      updatedAt DATETIME NOT NULL DEFAULT (datetime('now'))
    );
  `
  );
  await runAsync(
    db,
    `
    CREATE TABLE IF NOT EXISTS clients (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      shortName TEXT NOT NULL CHECK (length(shortName) <= 2),
      address TEXT,
      email TEXT,
      phone TEXT,
      code TEXT,
      additional TEXT,
      description TEXT,
      isArchived INTEGER NOT NULL DEFAULT 0 CHECK (isArchived IN (0,1)),
      createdAt DATETIME NOT NULL DEFAULT (datetime('now')),
      updatedAt DATETIME NOT NULL DEFAULT (datetime('now'))
    );
  `
  );
  await runAsync(
    db,
    `
    CREATE TABLE IF NOT EXISTS units (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL UNIQUE,
      isArchived INTEGER NOT NULL DEFAULT 0 CHECK (isArchived IN (0,1)),
      createdAt DATETIME NOT NULL DEFAULT (datetime('now')),
      updatedAt DATETIME NOT NULL DEFAULT (datetime('now'))
    );
  `
  );
  await runAsync(
    db,
    `
    CREATE TABLE IF NOT EXISTS categories (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL UNIQUE,
      isArchived INTEGER NOT NULL DEFAULT 0 CHECK (isArchived IN (0,1)),
      createdAt DATETIME NOT NULL DEFAULT (datetime('now')),
      updatedAt DATETIME NOT NULL DEFAULT (datetime('now'))
    );
  `
  );
  await runAsync(
    db,
    `
    CREATE TABLE IF NOT EXISTS currencies (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      code TEXT NOT NULL UNIQUE,
      symbol TEXT NOT NULL,
      text TEXT NOT NULL,
      format TEXT NOT NULL,
      subunit INTEGER NOT NULL DEFAULT 100,
      isArchived INTEGER NOT NULL DEFAULT 0 CHECK (isArchived IN (0,1)),
      createdAt DATETIME NOT NULL DEFAULT (datetime('now')),
      updatedAt DATETIME NOT NULL DEFAULT (datetime('now'))
    );
  `
  );
  await runAsync(
    db,
    `
    CREATE TABLE IF NOT EXISTS items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      amount TEXT NOT NULL DEFAULT '0',
      unitId INTEGER,
      categoryId INTEGER,
      description TEXT,
      isArchived INTEGER NOT NULL DEFAULT 0 CHECK (isArchived IN (0,1)),
      createdAt DATETIME NOT NULL DEFAULT (datetime('now')),
      updatedAt DATETIME NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (unitId) REFERENCES units(id),
      FOREIGN KEY (categoryId) REFERENCES categories(id)
    );
  `
  );
  await runAsync(
    db,
    `
    CREATE TABLE IF NOT EXISTS invoices (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      invoiceType TEXT NOT NULL CHECK(invoiceType IN ('quotation','invoice')),
      convertedFromQuotationId INTEGER NULL,
      businessId INTEGER NOT NULL,
      clientId INTEGER NOT NULL,
      currencyId INTEGER NOT NULL,
      createdAt DATETIME NOT NULL DEFAULT (datetime('now')),
      updatedAt DATETIME NOT NULL DEFAULT (datetime('now')),
      issuedAt DATETIME NOT NULL,
      dueDate DATETIME,
      invoiceNumber TEXT NOT NULL,
      isArchived INTEGER NOT NULL DEFAULT 0 CHECK (isArchived IN (0,1)),
      status TEXT NOT NULL DEFAULT 'unpaid' CHECK (status IN ('unpaid','open','closed','partially','paid')),
      customerNotes TEXT,
      thanksNotes TEXT,
      termsConditionNotes TEXT,
      discountName TEXT,
      businessNameSnapshot TEXT NOT NULL,
      businessShortNameSnapshot TEXT NOT NULL CHECK (length(businessShortNameSnapshot) <= 2),
      businessAddressSnapshot TEXT,
      businessRoleSnapshot TEXT,
      businessEmailSnapshot TEXT,
      businessPhoneSnapshot TEXT,
      businessAdditionalSnapshot TEXT,
      businessPaymentInformationSnapshot TEXT,
      businessLogoSnapshot BLOB,
      businessFileSizeSnapshot INTEGER,
      businessFileTypeSnapshot TEXT,
      businessFileNameSnapshot TEXT,
      clientNameSnapshot TEXT NOT NULL,
      clientAddressSnapshot TEXT,
      clientEmailSnapshot TEXT,
      clientPhoneSnapshot TEXT,
      clientCodeSnapshot TEXT,
      clientAdditionalSnapshot TEXT,
      currencyCodeSnapshot TEXT NOT NULL,
      currencySymbolSnapshot TEXT NOT NULL,
      currencySubunitSnapshot INTEGER NOT NULL,
      discountType TEXT CHECK(discountType IN ('fixed','percentage') OR discountType IS NULL),
      discountAmountCents INTEGER NOT NULL DEFAULT 0,
      discountPercent REAL NOT NULL DEFAULT 0,
      shippingFeeCents INTEGER NOT NULL DEFAULT 0,
      invoicePrefixSnapshot TEXT,
      invoiceSuffixSnapshot TEXT,
      customizationColor TEXT NOT NULL DEFAULT '#006400',
      customizationLogoSize TEXT NOT NULL DEFAULT 'medium',
      customizationFontSizeSize TEXT NOT NULL DEFAULT 'medium',
      customizationLayout TEXT NOT NULL DEFAULT 'classic',
      customizationTableHeaderStyle TEXT NOT NULL DEFAULT 'light',
      customizationTableRowStyle TEXT NOT NULL DEFAULT 'classic',
      customizationPageFormat TEXT NOT NULL DEFAULT 'A4',
      customizationLabelUpperCase INTEGER NOT NULL DEFAULT 0 CHECK (customizationLabelUpperCase IN (0,1)),
      customizationWatermarkFileName TEXT,
      customizationWatermarkFileType TEXT,            
      customizationWatermarkFileSize INTEGER,        
      customizationWatermarkFileData BLOB,         
      customizationPaidWatermarkFileName TEXT,
      customizationPaidWatermarkFileType TEXT,            
      customizationPaidWatermarkFileSize INTEGER,        
      customizationPaidWatermarkFileData BLOB,      
      taxName TEXT,              
      taxRate REAL NOT NULL DEFAULT 0,           
      taxType TEXT CHECK(taxType IN ('exclusive','inclusive','deducted') OR taxType IS NULL), 
      FOREIGN KEY (businessId) REFERENCES businesses(id),
      FOREIGN KEY (clientId) REFERENCES clients(id),
      FOREIGN KEY (currencyId) REFERENCES currencies(id),
      FOREIGN KEY (convertedFromQuotationId) REFERENCES invoices(id),
      UNIQUE (businessId, invoiceNumber),
      CHECK (
        (discountType = 'fixed' AND discountAmountCents >= 0 AND discountPercent = 0) OR
        (discountType = 'percentage' AND discountPercent <= 100 AND discountPercent >= 0 AND discountAmountCents = 0) OR
        (discountType IS NULL AND discountAmountCents = 0 AND discountPercent = 0)
      ),
      CHECK (dueDate IS NULL OR dueDate >= issuedAt),
      CHECK (convertedFromQuotationId IS NULL OR convertedFromQuotationId != id)
    )
  `
  );
  await runAsync(
    db,
    `
    CREATE TABLE IF NOT EXISTS invoice_items (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        parentInvoiceId INTEGER NOT NULL,    
        itemId INTEGER NOT NULL,
        itemNameSnapshot TEXT NOT NULL,
        unitPriceCentsSnapshot INTEGER NOT NULL DEFAULT (0), 
        unitNameSnapshot TEXT,
        quantity REAL NOT NULL DEFAULT 0,
        taxRate REAL NOT NULL DEFAULT 0,
        taxType TEXT CHECK(taxType IN ('exclusive','inclusive') OR taxType IS NULL),
        createdAt DATETIME NOT NULL DEFAULT (datetime('now')),
        updatedAt DATETIME NOT NULL DEFAULT (datetime('now')),
        FOREIGN KEY (parentInvoiceId) REFERENCES invoices(id) ON DELETE CASCADE,
        FOREIGN KEY (itemId) REFERENCES items(id)
    )
  `
  );
  await runAsync(
    db,
    `
    CREATE TABLE IF NOT EXISTS invoice_payments (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        parentInvoiceId INTEGER NOT NULL,   
        amountCents INTEGER NOT NULL,
        paidAt DATETIME NOT NULL DEFAULT (datetime('now')),
        paymentMethod TEXT NOT NULL,           
        notes TEXT,
        createdAt DATETIME NOT NULL DEFAULT (datetime('now')),
        updatedAt DATETIME NOT NULL DEFAULT (datetime('now')),
        FOREIGN KEY (parentInvoiceId) REFERENCES invoices(id) ON DELETE CASCADE
    )
  `
  );
  await runAsync(
    db,
    `
    CREATE TABLE IF NOT EXISTS attachments (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      parentInvoiceId INTEGER NOT NULL,   
      fileName TEXT NOT NULL,
      fileType TEXT NOT NULL,            
      fileSize INTEGER NOT NULL,        
      data BLOB NOT NULL,                
      createdAt DATETIME NOT NULL DEFAULT (datetime('now')),
      updatedAt DATETIME NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (parentInvoiceId) REFERENCES invoices(id) ON DELETE CASCADE
    )
  `
  );

  await runAsync(db, `CREATE INDEX IF NOT EXISTS idx_invoice_items_invoiceId ON invoice_items(parentInvoiceId)`);
  await runAsync(db, `CREATE INDEX IF NOT EXISTS idx_invoice_payments_invoiceId ON invoice_payments(parentInvoiceId)`);
  await runAsync(db, `CREATE INDEX IF NOT EXISTS idx_attachments_invoiceId ON attachments(parentInvoiceId)`);
  await runAsync(db, `CREATE INDEX IF NOT EXISTS idx_invoices_clientId ON invoices(clientId)`);
  await runAsync(db, `CREATE INDEX IF NOT EXISTS idx_invoices_businessId ON invoices(businessId)`);
  await runAsync(db, `CREATE INDEX IF NOT EXISTS idx_invoices_business_client ON invoices(businessId, clientId)`);
  await runAsync(db, `CREATE INDEX IF NOT EXISTS idx_invoices_type ON invoices(invoiceType)`);
  await runAsync(
    db,
    `CREATE INDEX IF NOT EXISTS idx_invoices_convertedFromQuotationId ON invoices(convertedFromQuotationId)`
  );
  await runAsync(db, `CREATE INDEX IF NOT EXISTS idx_invoice_items_itemId ON invoice_items(itemId)`);
  await runAsync(db, `CREATE INDEX IF NOT EXISTS idx_items_unitId ON items(unitId)`);
  await runAsync(db, `CREATE INDEX IF NOT EXISTS idx_items_categoryId ON items(categoryId)`);
  await runAsync(db, `CREATE INDEX IF NOT EXISTS idx_clients_active ON clients(isArchived)`);
  await runAsync(db, `CREATE INDEX IF NOT EXISTS idx_items_active ON items(isArchived)`);
  await runAsync(db, `CREATE INDEX IF NOT EXISTS idx_businesses_active ON businesses(isArchived)`);
  await runAsync(db, `CREATE INDEX IF NOT EXISTS idx_categories_active ON categories(isArchived)`);
  await runAsync(db, `CREATE INDEX IF NOT EXISTS idx_units_active ON units(isArchived)`);
  await runAsync(db, `CREATE INDEX IF NOT EXISTS idx_currencies_active ON currencies(isArchived)`);
  await runAsync(db, `CREATE INDEX IF NOT EXISTS idx_invoices_invoiceNumber ON invoices(invoiceNumber)`);
  await runAsync(db, `CREATE INDEX IF NOT EXISTS idx_invoices_status ON invoices(status)`);
  await runAsync(db, `CREATE INDEX IF NOT EXISTS idx_invoices_issuedAt ON invoices(issuedAt)`);
};

const initDatabase = async () => {
  if (!dbPath) throw new Error('Database path not set');

  await new Promise<void>((resolve, reject) => {
    db = new sqlite3.Database(dbPath!, err => {
      if (err) {
        reject(new Error(`Failed to open database: ${err.message}`));
        return;
      }
      console.log('Database opened successfully.');
      resolve();
    });
  });
  await runAsync(db, 'PRAGMA foreign_keys = ON;');
};

const setupDB = async (opts: { fullPath: string; createIfMissing?: boolean; mainWindow: BrowserWindow }) => {
  const { fullPath, createIfMissing = true, mainWindow } = opts;
  const folder = path.dirname(fullPath);
  fs.mkdirSync(folder, { recursive: true });

  if (createIfMissing) {
    try {
      if (fs.existsSync(fullPath)) {
        db?.close();
        fs.unlinkSync(fullPath);
      }
    } catch (err) {
      if (err instanceof Error) {
        throw new Error(err.message);
      } else {
        throw new Error(String(err));
      }
    }
  } else {
    if (!fs.existsSync(fullPath)) {
      throw new Error('Database file does not exist');
    }
  }

  dbPath = fullPath;

  await initDatabase();

  if (createIfMissing) {
    await init();
    await initInitialData();
  }

  await runMigrations(db);

  initIpcHandler(db, dbPath, mainWindow);
};

export { db, setupDB };
