import sqlite3 from 'sqlite3';
import { runAsync } from '../utils/dbFuntions';
import { mapSqliteError } from '../utils/errorFunctions';

export const up = async (db: sqlite3.Database) => {
  try {
    await runAsync(db, 'PRAGMA foreign_keys = OFF;');
    await runAsync(db, 'BEGIN TRANSACTION;');
    await runAsync(db, 'DROP TABLE IF EXISTS invoices_new;');

    await runAsync(
      db,
      `
      ALTER TABLE settings
      ADD COLUMN styleProfilesON INTEGER NOT NULL DEFAULT 1 CHECK (styleProfilesON IN (0,1))
    `
    );

    await runAsync(
      db,
      `
      CREATE TABLE IF NOT EXISTS style_profiles (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL UNIQUE,
        isArchived INTEGER NOT NULL DEFAULT 0 CHECK (isArchived IN (0,1)),
        customizationColor TEXT,
        customizationLogoSize TEXT,
        customizationFontSizeSize TEXT,
        customizationLayout TEXT,
        customizationTableHeaderStyle TEXT,
        customizationTableRowStyle TEXT,
        customizationPageFormat TEXT,
        customizationLabelUpperCase INTEGER NOT NULL DEFAULT 0 CHECK (customizationLabelUpperCase IN (0,1)),
        customizationWatermarkFileName TEXT,
        customizationWatermarkFileType TEXT,            
        customizationWatermarkFileSize INTEGER,        
        customizationWatermarkFileData BLOB,         
        customizationPaidWatermarkFileName TEXT,
        customizationPaidWatermarkFileType TEXT,            
        customizationPaidWatermarkFileSize INTEGER,        
        customizationPaidWatermarkFileData BLOB,     
        createdAt DATETIME NOT NULL DEFAULT (datetime('now')),
        updatedAt DATETIME NOT NULL DEFAULT (datetime('now'))
      );
    `
    );
    await runAsync(db, `CREATE INDEX IF NOT EXISTS idx_style_profiles_id ON style_profiles(id)`);

    await runAsync(
      db,
      `
        CREATE TABLE IF NOT EXISTS invoices_new (
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
          invoicePrefix TEXT,
          invoiceSuffix TEXT,
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
          invoiceFullNumber TEXT GENERATED ALWAYS AS (
                                                      COALESCE(invoicePrefix, '') ||
                                                      invoiceNumber ||
                                                      COALESCE(invoiceSuffix, '')
                                                    ) STORED,
          language TEXT NOT NULL DEFAULT 'en',
          signatureData BLOB,
          signatureName TEXT,
          signatureType TEXT,
          signatureSize INTEGER,
          styleProfilesId INTEGER,
          styleProfileNameSnapshot TEXT,
          FOREIGN KEY (styleProfilesId) REFERENCES style_profiles(id),
          FOREIGN KEY (businessId) REFERENCES businesses(id),
          FOREIGN KEY (clientId) REFERENCES clients(id),
          FOREIGN KEY (currencyId) REFERENCES currencies(id),
          FOREIGN KEY (convertedFromQuotationId) REFERENCES invoices(id),
          UNIQUE (businessId, invoiceFullNumber),
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
      INSERT INTO invoices_new (
        id,
        invoiceType,
        convertedFromQuotationId,
        businessId,
        clientId,
        currencyId,
        createdAt,
        updatedAt,
        issuedAt,
        dueDate,
        invoiceNumber,
        isArchived,
        status,
        customerNotes,
        thanksNotes,
        termsConditionNotes,
        discountName,
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
        clientNameSnapshot,
        clientAddressSnapshot,
        clientEmailSnapshot,
        clientPhoneSnapshot,
        clientCodeSnapshot,
        clientAdditionalSnapshot,
        currencyCodeSnapshot,
        currencySymbolSnapshot,
        currencySubunitSnapshot,
        discountType,
        discountAmountCents,
        discountPercent,
        shippingFeeCents,
        invoicePrefix,
        invoiceSuffix,
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
        taxName,
        taxRate,
        taxType,
        language,
        signatureData,
        signatureName,
        signatureType,
        signatureSize
      )
      SELECT
        id,
        invoiceType,
        convertedFromQuotationId,
        businessId,
        clientId,
        currencyId,
        createdAt,
        updatedAt,
        issuedAt,
        dueDate,
        invoiceNumber,
        isArchived,
        status,
        customerNotes,
        thanksNotes,
        termsConditionNotes,
        discountName,
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
        clientNameSnapshot,
        clientAddressSnapshot,
        clientEmailSnapshot,
        clientPhoneSnapshot,
        clientCodeSnapshot,
        clientAdditionalSnapshot,
        currencyCodeSnapshot,
        currencySymbolSnapshot,
        currencySubunitSnapshot,
        discountType,
        discountAmountCents,
        discountPercent,
        shippingFeeCents,
        invoicePrefix,
        invoiceSuffix,
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
        taxName,
        taxRate,
        taxType,
        language,
        signatureData,
        signatureName,
        signatureType,
        signatureSize
      FROM invoices;
    `
    );

    await runAsync(db, 'DROP TABLE invoices;');
    await runAsync(db, 'ALTER TABLE invoices_new RENAME TO invoices;');
    await runAsync(db, `CREATE INDEX IF NOT EXISTS idx_invoices_clientId ON invoices(clientId)`);
    await runAsync(db, `CREATE INDEX IF NOT EXISTS idx_invoices_businessId ON invoices(businessId)`);
    await runAsync(db, `CREATE INDEX IF NOT EXISTS idx_invoices_business_client ON invoices(businessId, clientId)`);
    await runAsync(db, `CREATE INDEX IF NOT EXISTS idx_invoices_type ON invoices(invoiceType)`);
    await runAsync(
      db,
      `CREATE INDEX IF NOT EXISTS idx_invoices_convertedFromQuotationId ON invoices(convertedFromQuotationId)`
    );
    await runAsync(db, `CREATE INDEX IF NOT EXISTS idx_invoices_invoiceNumber ON invoices(invoiceNumber)`);
    await runAsync(db, `CREATE INDEX IF NOT EXISTS idx_invoices_status ON invoices(status)`);
    await runAsync(db, `CREATE INDEX IF NOT EXISTS idx_invoices_issuedAt ON invoices(issuedAt)`);
    await runAsync(db, `CREATE INDEX IF NOT EXISTS idx_invoices_styleProfilesId ON invoices(styleProfilesId)`);

    await runAsync(db, 'COMMIT;');
    await runAsync(db, 'PRAGMA foreign_keys = ON;');
  } catch (error) {
    await runAsync(db, 'ROLLBACK;');
    await runAsync(db, 'PRAGMA foreign_keys = ON;');
    return { success: false, ...mapSqliteError(error) };
  }
};
