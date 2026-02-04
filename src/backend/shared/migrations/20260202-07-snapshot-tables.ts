import sqlite3 from 'sqlite3';
import { getFirstRow, runAsync } from '../utils/dbFuntions';
import { mapSqliteError } from '../utils/errorFunctions';

export const up = async (db: sqlite3.Database) => {
  try {
    const colInfo = await getFirstRow(
      db,
      `
        SELECT name
        FROM sqlite_master
        WHERE type = 'table'
        AND name = 'invoice_business_snapshots';
      `
    );

    if (colInfo) return;

    await runAsync(db, 'PRAGMA foreign_keys = OFF;');
    await runAsync(db, 'BEGIN TRANSACTION;');

    await runAsync(
      db,
      `
      CREATE TABLE IF NOT EXISTS invoice_business_snapshots (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        parentInvoiceId INTEGER NOT NULL,  
        businessName TEXT NOT NULL,
        businessShortName TEXT NOT NULL CHECK (length(businessShortName) <= 2),
        businessAddress TEXT,
        businessRole TEXT,
        businessEmail TEXT,
        businessPhone TEXT,
        businessAdditional TEXT,
        businessPaymentInformation TEXT,
        businessLogo BLOB,
        businessFileSize INTEGER,
        businessFileType TEXT,
        businessFileName TEXT, 
        createdAt DATETIME NOT NULL DEFAULT (datetime('now')),
        updatedAt DATETIME NOT NULL DEFAULT (datetime('now')),
        FOREIGN KEY (parentInvoiceId) REFERENCES invoices(id) ON DELETE CASCADE
      );
    `
    );
    await runAsync(
      db,
      `
      CREATE TABLE IF NOT EXISTS invoice_client_snapshots (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        parentInvoiceId INTEGER NOT NULL,
        clientName TEXT NOT NULL,
        clientAddress TEXT,
        clientEmail TEXT,
        clientPhone TEXT,
        clientCode TEXT,
        clientAdditional TEXT,
        createdAt DATETIME NOT NULL DEFAULT (datetime('now')),
        updatedAt DATETIME NOT NULL DEFAULT (datetime('now')),
        FOREIGN KEY (parentInvoiceId) REFERENCES invoices(id) ON DELETE CASCADE
      );
    `
    );
    await runAsync(
      db,
      `
      CREATE TABLE IF NOT EXISTS invoice_currency_snapshots (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        parentInvoiceId INTEGER NOT NULL,
        currencyCode TEXT NOT NULL,
        currencySymbol TEXT NOT NULL,
        currencySubunit INTEGER NOT NULL,
        createdAt DATETIME NOT NULL DEFAULT (datetime('now')),
        updatedAt DATETIME NOT NULL DEFAULT (datetime('now')),
        FOREIGN KEY (parentInvoiceId) REFERENCES invoices(id) ON DELETE CASCADE
      );
    `
    );
    await runAsync(
      db,
      `
      CREATE TABLE IF NOT EXISTS invoice_customizations (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        parentInvoiceId INTEGER NOT NULL,
        color TEXT NOT NULL DEFAULT '#006400',
        logoSize TEXT NOT NULL DEFAULT 'medium',
        fontSize TEXT NOT NULL DEFAULT 'medium',
        layout TEXT NOT NULL DEFAULT 'classic',
        tableHeaderStyle TEXT NOT NULL DEFAULT 'light',
        tableRowStyle TEXT NOT NULL DEFAULT 'classic',
        pageFormat TEXT NOT NULL DEFAULT 'A4',
        labelUpperCase INTEGER NOT NULL DEFAULT 0 CHECK (labelUpperCase IN (0,1)),
        watermarkFileName TEXT,
        watermarkFileType TEXT,
        watermarkFileSize INTEGER,
        watermarkFileData BLOB,
        paidWatermarkFileName TEXT,
        paidWatermarkFileType TEXT,
        paidWatermarkFileSize INTEGER,
        paidWatermarkFileData BLOB,
        createdAt DATETIME NOT NULL DEFAULT (datetime('now')),
        updatedAt DATETIME NOT NULL DEFAULT (datetime('now')),
        FOREIGN KEY (parentInvoiceId) REFERENCES invoices(id) ON DELETE CASCADE
      );
    `
    );
    await runAsync(
      db,
      `
      CREATE TABLE IF NOT EXISTS invoice_style_profile_snapshots (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        parentInvoiceId INTEGER NOT NULL,
        styleProfileName NOT NULL,
        createdAt DATETIME NOT NULL DEFAULT (datetime('now')),
        updatedAt DATETIME NOT NULL DEFAULT (datetime('now')),
        FOREIGN KEY (parentInvoiceId) REFERENCES invoices(id) ON DELETE CASCADE
      );
    `
    );
    await runAsync(
      db,
      `
      CREATE TABLE IF NOT EXISTS invoice_item_snaphots (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        parentInvoiceItemId INTEGER NOT NULL,
        itemName TEXT NOT NULL,
        unitPriceCents INTEGER NOT NULL DEFAULT (0),
        unitName TEXT,
        createdAt DATETIME NOT NULL DEFAULT (datetime('now')),
        updatedAt DATETIME NOT NULL DEFAULT (datetime('now')),
        FOREIGN KEY (parentInvoiceItemId) REFERENCES invoice_items(id) ON DELETE CASCADE
      );
    `
    );
    await runAsync(
      db,
      `CREATE INDEX IF NOT EXISTS idx_invoice_business_snapshots_parentInvoiceId ON invoice_business_snapshots(parentInvoiceId)`
    );
    await runAsync(
      db,
      `CREATE INDEX IF NOT EXISTS idx_invoice_business_snapshots_businessName ON invoice_business_snapshots(businessName)`
    );
    await runAsync(
      db,
      `CREATE INDEX IF NOT EXISTS idx_invoice_business_snapshots_businessShortName ON invoice_business_snapshots(businessShortName)`
    );

    await runAsync(
      db,
      `CREATE INDEX IF NOT EXISTS idx_invoice_client_snapshots_parentInvoiceId ON invoice_client_snapshots(parentInvoiceId)`
    );
    await runAsync(
      db,
      `CREATE INDEX IF NOT EXISTS idx_invoice_client_snapshots_clientName ON invoice_client_snapshots(clientName)`
    );
    await runAsync(
      db,
      `CREATE INDEX IF NOT EXISTS idx_invoice_client_snapshots_clientCode ON invoice_client_snapshots(clientCode)`
    );

    await runAsync(
      db,
      `CREATE INDEX IF NOT EXISTS idx_invoice_currency_snapshots_parentInvoiceId ON invoice_currency_snapshots(parentInvoiceId)`
    );
    await runAsync(
      db,
      `CREATE INDEX IF NOT EXISTS idx_invoice_currency_snapshots_currencyCode ON invoice_currency_snapshots(currencyCode)`
    );

    await runAsync(
      db,
      `CREATE INDEX IF NOT EXISTS idx_invoice_customizations_parentInvoiceId ON invoice_customizations(parentInvoiceId)`
    );

    await runAsync(
      db,
      `CREATE INDEX IF NOT EXISTS idx_invoice_style_profile_snapshots_parentInvoiceId ON invoice_style_profile_snapshots(parentInvoiceId)`
    );

    await runAsync(
      db,
      `CREATE INDEX IF NOT EXISTS idx_invoice_item_snapshots_parentInvoiceItemId ON invoice_item_snaphots(parentInvoiceItemId)`
    );
    await runAsync(
      db,
      `CREATE INDEX IF NOT EXISTS idx_invoice_item_snapshots_itemName ON invoice_item_snaphots(itemName)`
    );

    await runAsync(
      db,
      `INSERT INTO invoice_business_snapshots (
          parentInvoiceId,
          businessName,
          businessShortName,
          businessAddress,
          businessRole,
          businessEmail,
          businessPhone,
          businessAdditional,
          businessPaymentInformation,
          businessLogo,
          businessFileSize,
          businessFileType,
          businessFileName,
          createdAt,
          updatedAt
      )
      SELECT
          id,
          businessNameSnapshot,
          businessShortNameSnapshot,
          businessAddressSnapshot,
          businessRoleSnapshot,
          businessEmailSnapshot,
          businessPhoneSnapshot,
          businessAdditionalSnapshot,
          businessPaymentInformationSnapshot,
          businessLogoSnapshot,
          businessFileSizeSnapshot,
          businessFileTypeSnapshot,
          businessFileNameSnapshot,
          createdAt,
          updatedAt
      FROM invoices
      `
    );
    await runAsync(
      db,
      `INSERT INTO invoice_client_snapshots (
          parentInvoiceId,
          clientName,
          clientAddress,
          clientEmail,
          clientPhone,
          clientCode,
          clientAdditional,
          createdAt,
          updatedAt
      )
      SELECT
          id,
          clientNameSnapshot,
          clientAddressSnapshot,
          clientEmailSnapshot,
          clientPhoneSnapshot,
          clientCodeSnapshot,
          clientAdditionalSnapshot,
          createdAt,
          updatedAt
      FROM invoices
      `
    );
    await runAsync(
      db,
      `INSERT INTO invoice_currency_snapshots (
          parentInvoiceId,
          currencyCode,
          currencySymbol,
          currencySubunit,
          createdAt,
          updatedAt
      )
      SELECT
          id,
          currencyCodeSnapshot,
          currencySymbolSnapshot,
          currencySubunitSnapshot,
          createdAt,
          updatedAt
      FROM invoices
      `
    );
    await runAsync(
      db,
      `INSERT INTO invoice_customizations (
          parentInvoiceId,
          color,
          logoSize,
          fontSize,
          layout,
          tableHeaderStyle,
          tableRowStyle,
          pageFormat,
          labelUpperCase,
          watermarkFileName,
          watermarkFileType,
          watermarkFileSize,
          watermarkFileData,
          paidWatermarkFileName,
          paidWatermarkFileType,
          paidWatermarkFileSize,
          paidWatermarkFileData,
          createdAt,
          updatedAt
      )
      SELECT
          id,
          customizationColor,
          customizationLogoSize,
          customizationFontSizeSize,
          customizationLayout,
          customizationTableHeaderStyle,
          customizationTableRowStyle,
          customizationPageFormat,
          customizationLabelUpperCase,
          customizationWatermarkFileName,
          customizationWatermarkFileType,
          customizationWatermarkFileSize,
          customizationWatermarkFileData,
          customizationPaidWatermarkFileName,
          customizationPaidWatermarkFileType,
          customizationPaidWatermarkFileSize,
          customizationPaidWatermarkFileData,
          createdAt,
          updatedAt
      FROM invoices
      `
    );
    await runAsync(
      db,
      `INSERT INTO invoice_style_profile_snapshots (
          parentInvoiceId,
          styleProfileName,
          createdAt,
          updatedAt
      )
      SELECT
          id,
          styleProfileNameSnapshot,
          createdAt,
          updatedAt
      FROM invoices where styleProfilesId is not null
      `
    );
    await runAsync(
      db,
      `INSERT INTO invoice_item_snaphots (
          parentInvoiceItemId,
          itemName,
          unitPriceCents,
          unitName,
          createdAt,
          updatedAt
      )
      SELECT
          id,
          itemNameSnapshot,
          unitPriceCentsSnapshot,
          unitNameSnapshot,
          createdAt,
          updatedAt
      FROM invoice_items
      `
    );

    await runAsync(db, ' ALTER TABLE invoices DROP COLUMN businessNameSnapshot;');
    await runAsync(db, ' ALTER TABLE invoices DROP COLUMN businessShortNameSnapshot;');
    await runAsync(db, ' ALTER TABLE invoices DROP COLUMN businessAddressSnapshot;');
    await runAsync(db, ' ALTER TABLE invoices DROP COLUMN businessRoleSnapshot;');
    await runAsync(db, ' ALTER TABLE invoices DROP COLUMN businessEmailSnapshot;');
    await runAsync(db, ' ALTER TABLE invoices DROP COLUMN businessPhoneSnapshot;');
    await runAsync(db, ' ALTER TABLE invoices DROP COLUMN businessAdditionalSnapshot;');
    await runAsync(db, ' ALTER TABLE invoices DROP COLUMN businessPaymentInformationSnapshot;');
    await runAsync(db, ' ALTER TABLE invoices DROP COLUMN businessLogoSnapshot;');
    await runAsync(db, ' ALTER TABLE invoices DROP COLUMN businessFileSizeSnapshot;');
    await runAsync(db, ' ALTER TABLE invoices DROP COLUMN businessFileTypeSnapshot;');
    await runAsync(db, ' ALTER TABLE invoices DROP COLUMN businessFileNameSnapshot;');

    await runAsync(db, ' ALTER TABLE invoices DROP COLUMN clientNameSnapshot;');
    await runAsync(db, ' ALTER TABLE invoices DROP COLUMN clientAddressSnapshot;');
    await runAsync(db, ' ALTER TABLE invoices DROP COLUMN clientEmailSnapshot;');
    await runAsync(db, ' ALTER TABLE invoices DROP COLUMN clientPhoneSnapshot;');
    await runAsync(db, ' ALTER TABLE invoices DROP COLUMN clientCodeSnapshot;');
    await runAsync(db, ' ALTER TABLE invoices DROP COLUMN clientAdditionalSnapshot;');

    await runAsync(db, ' ALTER TABLE invoices DROP COLUMN currencyCodeSnapshot;');
    await runAsync(db, ' ALTER TABLE invoices DROP COLUMN currencySymbolSnapshot;');
    await runAsync(db, ' ALTER TABLE invoices DROP COLUMN currencySubunitSnapshot;');

    await runAsync(db, ' ALTER TABLE invoices DROP COLUMN customizationColor;');
    await runAsync(db, ' ALTER TABLE invoices DROP COLUMN customizationLogoSize;');
    await runAsync(db, ' ALTER TABLE invoices DROP COLUMN customizationFontSizeSize;');
    await runAsync(db, ' ALTER TABLE invoices DROP COLUMN customizationLayout;');
    await runAsync(db, ' ALTER TABLE invoices DROP COLUMN customizationTableHeaderStyle;');
    await runAsync(db, ' ALTER TABLE invoices DROP COLUMN customizationTableRowStyle;');
    await runAsync(db, ' ALTER TABLE invoices DROP COLUMN customizationPageFormat;');
    await runAsync(db, ' ALTER TABLE invoices DROP COLUMN customizationLabelUpperCase;');
    await runAsync(db, ' ALTER TABLE invoices DROP COLUMN customizationWatermarkFileName;');
    await runAsync(db, ' ALTER TABLE invoices DROP COLUMN customizationWatermarkFileType;');
    await runAsync(db, ' ALTER TABLE invoices DROP COLUMN customizationWatermarkFileSize;');
    await runAsync(db, ' ALTER TABLE invoices DROP COLUMN customizationWatermarkFileData;');
    await runAsync(db, ' ALTER TABLE invoices DROP COLUMN customizationPaidWatermarkFileName;');
    await runAsync(db, ' ALTER TABLE invoices DROP COLUMN customizationPaidWatermarkFileType;');
    await runAsync(db, ' ALTER TABLE invoices DROP COLUMN customizationPaidWatermarkFileSize;');
    await runAsync(db, ' ALTER TABLE invoices DROP COLUMN customizationPaidWatermarkFileData;');

    await runAsync(db, ' ALTER TABLE invoices DROP COLUMN styleProfileNameSnapshot;');

    await runAsync(db, ' ALTER TABLE invoice_items DROP COLUMN itemNameSnapshot;');
    await runAsync(db, ' ALTER TABLE invoice_items DROP COLUMN unitPriceCentsSnapshot;');
    await runAsync(db, ' ALTER TABLE invoice_items DROP COLUMN unitNameSnapshot;');

    await runAsync(db, 'COMMIT;');
    await runAsync(db, 'PRAGMA foreign_keys = ON;');
  } catch (error) {
    await runAsync(db, 'ROLLBACK;');
    await runAsync(db, 'PRAGMA foreign_keys = ON;');
    return { success: false, ...mapSqliteError(error) };
  }
};
