-- Baseline schema and seed rows of the Mavri database after TypeScript migration
-- 20260927-32-ecommerce-integrations. Generated from a freshly migrated database;
-- new schema changes go in numbered files next to this one, not in here.

CREATE TABLE IF NOT EXISTS api_keys (
          "id" INTEGER PRIMARY KEY AUTOINCREMENT,
          "name" TEXT NOT NULL,
          "keyPrefix" TEXT NOT NULL,
          "keyHash" TEXT NOT NULL UNIQUE,
          "createdByUserId" INTEGER,
          "lastUsedAt" DATETIME,
          "revokedAt" DATETIME,
          "createdAt" DATETIME NOT NULL DEFAULT (datetime('now')),
          FOREIGN KEY("createdByUserId") REFERENCES users("id") ON DELETE SET NULL
        );
CREATE TABLE IF NOT EXISTS attachments (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      "parentInvoiceId" INTEGER NOT NULL,   
      "fileName" TEXT NOT NULL,
      "fileType" TEXT NOT NULL,            
      "fileSize" INTEGER NOT NULL,        
      "data" BLOB NOT NULL,                
      "createdAt" DATETIME NOT NULL DEFAULT (datetime('now')),
      "updatedAt" DATETIME NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY ("parentInvoiceId") REFERENCES invoices("id") ON DELETE CASCADE
    );
CREATE TABLE IF NOT EXISTS banks (
        "id" INTEGER PRIMARY KEY AUTOINCREMENT,
        "name" TEXT NOT NULL UNIQUE,
        "bankName" TEXT,
        "accountNumber" TEXT,
        "swiftCode" TEXT,
        "address" TEXT,
        "branchCode" TEXT,
        "type" TEXT,
        "routingNumber" TEXT,
        "upiCode" TEXT,
        "qrCode" BLOB,
        "qrCodeFileSize" INTEGER,
        "qrCodeFileType" TEXT,
        "qrCodeFileName" TEXT,
        "isArchived" INTEGER NOT NULL DEFAULT 0 CHECK ("isArchived" IN (0,1)),
        "createdAt" DATETIME NOT NULL DEFAULT (datetime('now')),
        "updatedAt" DATETIME NOT NULL DEFAULT (datetime('now'))
       , "accountHolder" TEXT, "sortOrder" TEXT);
CREATE TABLE IF NOT EXISTS businesses (
      "id" INTEGER PRIMARY KEY AUTOINCREMENT,
      "name" TEXT NOT NULL,
      "shortName" TEXT NOT NULL CHECK (length("shortName") <= 2),
      "address" TEXT,
      "role" TEXT,
      "email" TEXT,
      "phone" TEXT,
      "website" TEXT,
      "additional" TEXT,
      "paymentInformation" TEXT,
      "logo" BLOB,
      "fileSize" INTEGER,
      "fileType" TEXT,
      "fileName" TEXT,
      "description" TEXT,
      "isArchived" INTEGER NOT NULL DEFAULT 0 CHECK ("isArchived" IN (0,1)),
      "createdAt" DATETIME NOT NULL DEFAULT (datetime('now')),
      "updatedAt" DATETIME NOT NULL DEFAULT (datetime('now'))
    , "vatCode" TEXT, "code" TEXT, "peppolEndpointId" TEXT, "countryCode" TEXT, "peppolEndpointSchemeId" TEXT);
CREATE TABLE IF NOT EXISTS categories (
      "id" INTEGER PRIMARY KEY AUTOINCREMENT,
      "name" TEXT NOT NULL UNIQUE,
      "isArchived" INTEGER NOT NULL DEFAULT 0 CHECK ("isArchived" IN (0,1)),
      "createdAt" DATETIME NOT NULL DEFAULT (datetime('now')),
      "updatedAt" DATETIME NOT NULL DEFAULT (datetime('now'))
    );
INSERT OR IGNORE INTO "categories" VALUES(1,'Goods',0,'2026-10-11 17:02:27','2026-10-11 17:02:27');
INSERT OR IGNORE INTO "categories" VALUES(2,'Services',0,'2026-10-11 17:02:27','2026-10-11 17:02:27');
CREATE TABLE IF NOT EXISTS clients (
      "id" INTEGER PRIMARY KEY AUTOINCREMENT,
      "name" TEXT NOT NULL,
      "shortName" TEXT NOT NULL CHECK (length("shortName") <= 2),
      "address" TEXT,
      "email" TEXT,
      "phone" TEXT,
      "code" TEXT,
      "additional" TEXT,
      "description" TEXT,
      "isArchived" INTEGER NOT NULL DEFAULT 0 CHECK ("isArchived" IN (0,1)),
      "createdAt" DATETIME NOT NULL DEFAULT (datetime('now')),
      "updatedAt" DATETIME NOT NULL DEFAULT (datetime('now'))
    , "vatCode" TEXT, "peppolEndpointId" TEXT, "countryCode" TEXT, "peppolEndpointSchemeId" TEXT, "buyerReference" TEXT, "taxExempt" INTEGER NOT NULL DEFAULT 0 CHECK ("taxExempt" IN (0,1)), "taxExemptionCertificate" TEXT);
CREATE TABLE IF NOT EXISTS currencies (
      "id" INTEGER PRIMARY KEY AUTOINCREMENT,
      "code" TEXT NOT NULL UNIQUE,
      "symbol" TEXT NOT NULL,
      "text" TEXT NOT NULL,
      "format" TEXT NOT NULL,
      "subunit" INTEGER NOT NULL DEFAULT 100,
      "isArchived" INTEGER NOT NULL DEFAULT 0 CHECK ("isArchived" IN (0,1)),
      "createdAt" DATETIME NOT NULL DEFAULT (datetime('now')),
      "updatedAt" DATETIME NOT NULL DEFAULT (datetime('now'))
    );
INSERT OR IGNORE INTO "currencies" VALUES(1,'USD','$','United States Dollar','{symbol}{amount}',100,0,'2026-10-11 17:02:27','2026-10-11 17:02:27');
INSERT OR IGNORE INTO "currencies" VALUES(2,'EUR','€','Euro','{symbol}{amount}',100,0,'2026-10-11 17:02:27','2026-10-11 17:02:27');
INSERT OR IGNORE INTO "currencies" VALUES(3,'SEK','kr','Swedish Krona','{symbol} {amount}',100,0,'2026-10-11 17:02:27','2026-10-11 17:02:27');
INSERT OR IGNORE INTO "currencies" VALUES(4,'GBP','£','British Pound','{symbol}{amount}',100,0,'2026-10-11 17:02:27','2026-10-11 17:02:27');
INSERT OR IGNORE INTO "currencies" VALUES(5,'JPY','¥','Japanese Yen','{symbol}{amount}',1,0,'2026-10-11 17:02:27','2026-10-11 17:02:27');
INSERT OR IGNORE INTO "currencies" VALUES(6,'AUD','A$','Australian Dollar','{symbol}{amount}',100,0,'2026-10-11 17:02:27','2026-10-11 17:02:27');
INSERT OR IGNORE INTO "currencies" VALUES(7,'CAD','CA$','Canadian Dollar','{symbol}{amount}',100,0,'2026-10-11 17:02:27','2026-10-11 17:02:27');
INSERT OR IGNORE INTO "currencies" VALUES(8,'CHF','CHF','Swiss Franc','{symbol} {amount}',100,0,'2026-10-11 17:02:27','2026-10-11 17:02:27');
INSERT OR IGNORE INTO "currencies" VALUES(9,'CNY','¥','Chinese Yuan','{symbol}{amount}',100,0,'2026-10-11 17:02:27','2026-10-11 17:02:27');
INSERT OR IGNORE INTO "currencies" VALUES(10,'INR','₹','Indian Rupee','{symbol}{amount}',100,0,'2026-10-11 17:02:27','2026-10-11 17:02:27');
CREATE TABLE IF NOT EXISTS ecommerce_integrations (
          "id" INTEGER PRIMARY KEY AUTOINCREMENT,
          "name" TEXT NOT NULL,
          "platform" TEXT NOT NULL,
          "webhookSecretEncrypted" TEXT NOT NULL,
          "businessId" INTEGER NOT NULL,
          "currencyId" INTEGER NOT NULL,
          "bankId" INTEGER,
          "layoutId" INTEGER,
          "styleProfilesId" INTEGER,
          "defaultTaxRate" REAL NOT NULL DEFAULT 0,
          "autoIssue" INTEGER NOT NULL DEFAULT 1,
          "isActive" INTEGER NOT NULL DEFAULT 1,
          "lastEventAt" DATETIME,
          "createdByUserId" INTEGER,
          "createdAt" DATETIME NOT NULL DEFAULT (datetime('now')),
          "updatedAt" DATETIME NOT NULL DEFAULT (datetime('now')),
          FOREIGN KEY("businessId") REFERENCES businesses("id") ON DELETE CASCADE,
          FOREIGN KEY("currencyId") REFERENCES currencies("id") ON DELETE CASCADE,
          FOREIGN KEY("bankId") REFERENCES banks("id") ON DELETE SET NULL,
          FOREIGN KEY("createdByUserId") REFERENCES users("id") ON DELETE SET NULL
        );
CREATE TABLE IF NOT EXISTS ecommerce_orders (
          "id" INTEGER PRIMARY KEY AUTOINCREMENT,
          "integrationId" INTEGER NOT NULL,
          "externalOrderId" TEXT NOT NULL,
          "invoiceId" INTEGER,
          "status" TEXT NOT NULL DEFAULT 'received',
          "errorMessage" TEXT,
          "rawPayloadHash" TEXT,
          "receivedAt" DATETIME NOT NULL DEFAULT (datetime('now')),
          "processedAt" DATETIME,
          FOREIGN KEY("integrationId") REFERENCES ecommerce_integrations("id") ON DELETE CASCADE,
          FOREIGN KEY("invoiceId") REFERENCES invoices("id") ON DELETE SET NULL
        );
CREATE TABLE IF NOT EXISTS invoice_bank_snapshots (
        "id" INTEGER PRIMARY KEY AUTOINCREMENT,
        "parentInvoiceId" INTEGER NOT NULL,
        "name" TEXT NOT NULL,
        "bankName" TEXT NOT NULL,
        "accountNumber" TEXT NOT NULL,
        "swiftCode" TEXT,
        "address" TEXT,
        "branchCode" TEXT,
        "type" TEXT,
        "routingNumber" TEXT,
        "upiCode" TEXT,
        "qrCode" BLOB,
        "qrCodeFileSize" INTEGER,
        "qrCodeFileType" TEXT,
        "qrCodeFileName" TEXT,
        "createdAt" DATETIME NOT NULL DEFAULT (datetime('now')),
        "updatedAt" DATETIME NOT NULL DEFAULT (datetime('now')), "accountHolder" TEXT, "sortOrder" TEXT,
        FOREIGN KEY("parentInvoiceId") REFERENCES invoices("id") ON DELETE CASCADE
      );
CREATE TABLE IF NOT EXISTS invoice_business_snapshots (
        "id" INTEGER PRIMARY KEY AUTOINCREMENT,
        "parentInvoiceId" INTEGER NOT NULL,
        "businessName" TEXT NOT NULL,
        "businessShortName" TEXT NOT NULL CHECK (length("businessShortName") <= 2),
        "businessAddress" TEXT,
        "businessRole" TEXT,
        "businessEmail" TEXT,
        "businessPhone" TEXT,
        "businessAdditional" TEXT,
        "businessPaymentInformation" TEXT,
        "businessLogo" BLOB,
        "businessFileSize" INTEGER,
        "businessFileType" TEXT,
        "businessFileName" TEXT,
        "createdAt" DATETIME NOT NULL DEFAULT (datetime('now')),
        "updatedAt" DATETIME NOT NULL DEFAULT (datetime('now')), "businessVatCode" TEXT, "businessCode" TEXT, "businessPeppolEndpointId" TEXT, "businessCountryCode" TEXT, "businessPeppolEndpointSchemeId" TEXT,
        FOREIGN KEY("parentInvoiceId") REFERENCES invoices("id") ON DELETE CASCADE
      );
CREATE TABLE IF NOT EXISTS invoice_client_snapshots (
        "id" INTEGER PRIMARY KEY AUTOINCREMENT,
        "parentInvoiceId" INTEGER NOT NULL,
        "clientName" TEXT NOT NULL,
        "clientAddress" TEXT,
        "clientEmail" TEXT,
        "clientPhone" TEXT,
        "clientCode" TEXT,
        "clientAdditional" TEXT,
        "createdAt" DATETIME NOT NULL DEFAULT (datetime('now')),
        "updatedAt" DATETIME NOT NULL DEFAULT (datetime('now')), "clientVatCode" TEXT, "clientPeppolEndpointId" TEXT, "clientCountryCode" TEXT, "clientPeppolEndpointSchemeId" TEXT, "clientBuyerReference" TEXT, "clientTaxExempt" INTEGER NOT NULL DEFAULT 0 CHECK ("clientTaxExempt" IN (0,1)), "clientTaxExemptionCertificate" TEXT,
        FOREIGN KEY("parentInvoiceId") REFERENCES invoices("id") ON DELETE CASCADE
      );
CREATE TABLE IF NOT EXISTS invoice_currency_snapshots (
        "id" INTEGER PRIMARY KEY AUTOINCREMENT,
        "parentInvoiceId" INTEGER NOT NULL,
        "currencyCode" TEXT NOT NULL,
        "currencySymbol" TEXT NOT NULL,
        "currencySubunit" INTEGER NOT NULL,
        "createdAt" DATETIME NOT NULL DEFAULT (datetime('now')),
        "updatedAt" DATETIME NOT NULL DEFAULT (datetime('now')),
        FOREIGN KEY("parentInvoiceId") REFERENCES invoices("id") ON DELETE CASCADE
      );
CREATE TABLE IF NOT EXISTS invoice_customizations (
        "id" INTEGER PRIMARY KEY AUTOINCREMENT,
        "parentInvoiceId" INTEGER NOT NULL,
        "color" TEXT NOT NULL DEFAULT '#006400',
        "logoSize" TEXT NOT NULL DEFAULT 'medium',
        "fontSize" TEXT NOT NULL DEFAULT 'medium',
        "tableHeaderStyle" TEXT NOT NULL DEFAULT 'light',
        "tableRowStyle" TEXT NOT NULL DEFAULT 'classic',
        "pageFormat" TEXT NOT NULL DEFAULT 'A4',
        "labelUpperCase" INTEGER NOT NULL DEFAULT 0 CHECK ("labelUpperCase" IN (0,1)),
        "watermarkFileName" TEXT,
        "watermarkFileType" TEXT,
        "watermarkFileSize" INTEGER,
        "watermarkFileData" BLOB,
        "paidWatermarkFileName" TEXT,
        "paidWatermarkFileType" TEXT,
        "paidWatermarkFileSize" INTEGER,
        "paidWatermarkFileData" BLOB,
        "createdAt" DATETIME NOT NULL DEFAULT (datetime('now')),
        "updatedAt" DATETIME NOT NULL DEFAULT (datetime('now')), "showQuantity" INTEGER NOT NULL DEFAULT 1 CHECK ("showQuantity" IN (0,1)), "showUnit" INTEGER NOT NULL DEFAULT 1 CHECK ("showUnit" IN (0,1)), "showRowNo" INTEGER NOT NULL DEFAULT 1 CHECK ("showRowNo" IN (0,1)), "fieldSortOrders" TEXT NOT NULL DEFAULT '{"no":0,"item":1,"unit":2,"quantity":3,"unitCost":4,"total":5}', "fontFamily" TEXT NOT NULL DEFAULT 'Roboto', "pdfTexts" TEXT,
        FOREIGN KEY("parentInvoiceId") REFERENCES invoices("id") ON DELETE CASCADE
      );
CREATE TABLE IF NOT EXISTS "invoice_item_snapshots" (
            "id" INTEGER PRIMARY KEY AUTOINCREMENT,
            "parentInvoiceItemId" INTEGER NOT NULL,
            "itemName" TEXT NOT NULL,
            "unitPriceCents" TEXT NOT NULL DEFAULT 0,
            "unitName" TEXT,
            "createdAt" DATETIME NOT NULL DEFAULT (datetime('now')),
            "updatedAt" DATETIME NOT NULL DEFAULT (datetime('now')),
            FOREIGN KEY("parentInvoiceItemId") REFERENCES invoice_items("id") ON DELETE CASCADE
          );
CREATE TABLE IF NOT EXISTS "invoice_items" (
        "id" INTEGER PRIMARY KEY AUTOINCREMENT,
        "parentInvoiceId" INTEGER NOT NULL,
        "itemId" INTEGER NOT NULL,
        "quantity" TEXT NOT NULL DEFAULT '0',
        "taxRate" REAL NOT NULL DEFAULT 0,
        "taxType" TEXT CHECK("taxType" IN ('exclusive','inclusive') OR "taxType" IS NULL),
        "createdAt" DATETIME NOT NULL DEFAULT (datetime('now')),
        "updatedAt" DATETIME NOT NULL DEFAULT (datetime('now')), "customField" TEXT,
        FOREIGN KEY ("parentInvoiceId") REFERENCES invoices("id") ON DELETE CASCADE,
        FOREIGN KEY ("itemId") REFERENCES items("id")
      );
CREATE TABLE IF NOT EXISTS invoice_layout_snapshots (
      "id" INTEGER PRIMARY KEY AUTOINCREMENT,
      "parentInvoiceId" INTEGER NOT NULL,
      "layoutSchema" TEXT NOT NULL, 
      "createdAt" DATETIME NOT NULL DEFAULT (datetime('now')),
      "updatedAt" DATETIME NOT NULL DEFAULT (datetime('now')),
      UNIQUE("parentInvoiceId"),
      FOREIGN KEY("parentInvoiceId") REFERENCES invoices("id") ON DELETE CASCADE
    );
CREATE TABLE IF NOT EXISTS "invoice_payments" (
          "id" INTEGER PRIMARY KEY AUTOINCREMENT,
          "parentInvoiceId" INTEGER NOT NULL,
          "amountCents" TEXT NOT NULL,
          "paidAt" DATETIME NOT NULL DEFAULT (datetime('now')),
          "paymentMethod" TEXT NOT NULL,
          "notes" TEXT,
          "createdAt" DATETIME NOT NULL DEFAULT (datetime('now')),
          "updatedAt" DATETIME NOT NULL DEFAULT (datetime('now')),
          FOREIGN KEY ("parentInvoiceId") REFERENCES invoices(id) ON DELETE CASCADE
        );
CREATE TABLE IF NOT EXISTS "invoice_sequences" (
        "id" INTEGER PRIMARY KEY AUTOINCREMENT,
        "businessId" INTEGER NOT NULL,
        "clientId" INTEGER NOT NULL,
        "nextSequence" BIGINT NOT NULL,
        "invoiceType" TEXT NOT NULL CHECK("invoiceType" IN ('quotation','invoice')),
        "createdAt" DATETIME NOT NULL DEFAULT (datetime('now')),
        "updatedAt" DATETIME NOT NULL DEFAULT (datetime('now')),
        UNIQUE("businessId","clientId","invoiceType")
      );
CREATE TABLE IF NOT EXISTS invoice_style_profile_snapshots (
        "id" INTEGER PRIMARY KEY AUTOINCREMENT,
        "parentInvoiceId" INTEGER NOT NULL,
        "styleProfileName" TEXT NOT NULL,
        "createdAt" DATETIME NOT NULL DEFAULT (datetime('now')),
        "updatedAt" DATETIME NOT NULL DEFAULT (datetime('now')),
        FOREIGN KEY("parentInvoiceId") REFERENCES invoices("id") ON DELETE CASCADE
      );
CREATE TABLE IF NOT EXISTS "invoices" (
           "id" INTEGER PRIMARY KEY AUTOINCREMENT,
           "invoiceType" TEXT NOT NULL CHECK("invoiceType" IN ('quotation','invoice')),
           "convertedFromQuotationId" INTEGER,
           "businessId" INTEGER NOT NULL,
           "clientId" INTEGER NOT NULL,
           "currencyId" INTEGER NOT NULL,
           "bankId" INTEGER NULL,
           "createdAt" DATETIME NOT NULL DEFAULT (datetime('now')),
           "updatedAt" DATETIME NOT NULL DEFAULT (datetime('now')),
           "issuedAt" DATETIME NOT NULL,
           "dueDate" DATETIME,
           "invoiceNumber" TEXT NOT NULL,
           "isArchived" INTEGER NOT NULL DEFAULT 0 CHECK("isArchived" IN (0,1)),
           "status" TEXT NOT NULL DEFAULT 'unpaid' CHECK("status" IN ('unpaid','open','closed','partially','paid')),
           "customerNotes" TEXT,
           "thanksNotes" TEXT,
           "termsConditionNotes" TEXT,
           "discountName" TEXT,
           "discountType" TEXT CHECK("discountType" IN ('fixed','percentage') OR "discountType" IS NULL),
           "discountAmountCents" TEXT NOT NULL DEFAULT '0',
           "discountPercent" REAL NOT NULL DEFAULT 0,
           "surchargeName" TEXT,
           "surchargeType" TEXT CHECK("surchargeType" IN ('fixed','percentage') OR "surchargeType" IS NULL),
           "surchargeAmountCents" TEXT NOT NULL DEFAULT '0',
           "surchargePercent" REAL NOT NULL DEFAULT 0,
           "shippingFeeCents" TEXT NOT NULL DEFAULT '0',
           "invoicePrefix" TEXT,
           "invoiceSuffix" TEXT,
           "taxName" TEXT,
           "taxRate" REAL NOT NULL DEFAULT 0,
           "taxType" TEXT CHECK("taxType" IN ('exclusive','inclusive','deducted') OR "taxType" IS NULL),
           "invoiceFullNumber" TEXT GENERATED ALWAYS AS (
             COALESCE("invoicePrefix", '') || "invoiceNumber" || COALESCE("invoiceSuffix", '')
           ) STORED,
           "language" TEXT NOT NULL DEFAULT 'en',
           "signatureData" BLOB,
           "signatureName" TEXT,
           "signatureType" TEXT,
           "signatureSize" INTEGER,
           "styleProfilesId" INTEGER,
           "paidAt" DATETIME,
           "closedAt" DATETIME, "layoutId" INTEGER REFERENCES layouts("id"),
           FOREIGN KEY("styleProfilesId") REFERENCES style_profiles("id"),
           FOREIGN KEY("businessId") REFERENCES businesses("id"),
           FOREIGN KEY("clientId") REFERENCES clients("id"),
           FOREIGN KEY("currencyId") REFERENCES currencies("id"),
           FOREIGN KEY("convertedFromQuotationId") REFERENCES invoices("id"),
           FOREIGN KEY ("bankId") REFERENCES banks("id"),
           UNIQUE("businessId","invoiceFullNumber", "clientId", "invoiceType"),
           CHECK (
             (
               "discountType" = 'fixed'
               AND CAST("discountAmountCents" AS NUMERIC) >= CAST(0 AS NUMERIC)
               AND "discountPercent" = 0
             ) OR (
               "discountType" = 'percentage'
               AND "discountPercent" BETWEEN 0 AND 100
               AND CAST("discountAmountCents" AS NUMERIC) = CAST(0 AS NUMERIC)
             ) OR (
               "discountType" IS NULL
               AND CAST("discountAmountCents" AS NUMERIC) = CAST(0 AS NUMERIC)
               AND "discountPercent" = 0
             )
           ),
           CHECK("dueDate" IS NULL OR "dueDate" >= "issuedAt"),
           CHECK("convertedFromQuotationId" IS NULL OR "convertedFromQuotationId" != "id")
         );
CREATE TABLE IF NOT EXISTS items (
      "id" INTEGER PRIMARY KEY AUTOINCREMENT,
      "name" TEXT NOT NULL,
      "amount" TEXT NOT NULL DEFAULT '0',
      "unitId" INTEGER,
      "categoryId" INTEGER,
      "description" TEXT,
      "isArchived" INTEGER NOT NULL DEFAULT 0 CHECK ("isArchived" IN (0,1)),
      "createdAt" DATETIME NOT NULL DEFAULT (datetime('now')),
      "updatedAt" DATETIME NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY ("unitId") REFERENCES units("id"),
      FOREIGN KEY ("categoryId") REFERENCES categories("id")
    );
CREATE TABLE IF NOT EXISTS layouts (
      "id" INTEGER PRIMARY KEY AUTOINCREMENT,
      "schema" TEXT NOT NULL,  
      "isArchived" INTEGER NOT NULL DEFAULT 0 CHECK ("isArchived" IN (0,1)),
      "createdAt" DATETIME NOT NULL DEFAULT (datetime('now')),
      "updatedAt" DATETIME NOT NULL DEFAULT (datetime('now'))
    );
INSERT OR IGNORE INTO "layouts" VALUES(1,'{"schemaVersion":1,"meta":{"name":"Classic","description":"Pre-created layout using bank payment information for new invoices and quotes."},"sections":[{"type":"watermark","visible":"auto","watermarkOrder":"paidFirst"},{"type":"header","visible":true,"blocks":[{"type":"row","children":[{"type":"column","width":"50%","children":[{"type":"row","children":[{"type":"logo"},{"type":"businessInfo"}],"align":"start","justify":"between","gap":5}]},{"type":"column","width":"50%","children":[{"type":"invoiceMeta","showTitle":true}]}],"align":"start","justify":"between"},{"type":"row","children":[{"type":"clientInfo"}],"align":"start","justify":"between","paddingTop":20}]},{"type":"itemsTable","visible":true},{"type":"financialTotals","visible":true},{"type":"paymentInfo","visible":"auto"},{"type":"notes","visible":"auto"},{"type":"signature","visible":"auto"},{"type":"pageCounter","visible":true}]}',0,'2026-10-11 17:02:27','2026-10-11 17:02:27');
INSERT OR IGNORE INTO "layouts" VALUES(2,'{"schemaVersion":1,"meta":{"name":"Legacy Classic","description":"Pre-created legacy layout preserved for existing documents that use business payment information. Do not use for new invoices or quotes."},"sections":[{"type":"watermark","visible":"auto","watermarkOrder":"paidFirst"},{"type":"header","visible":true,"blocks":[{"type":"row","children":[{"type":"column","width":"50%","children":[{"type":"row","children":[{"type":"logo"},{"type":"businessInfo"}],"align":"start","justify":"between","gap":5}]},{"type":"column","width":"50%","children":[{"type":"invoiceMeta","showTitle":true}]}],"align":"start","justify":"between"},{"type":"row","children":[{"type":"column","width":"50%","children":[{"type":"clientInfo"}]},{"type":"column","width":"50%","align":"end","children":[{"type":"paymentInfo","paymentSource":"legacyBusiness","width":"60%"}]}],"align":"start","justify":"between","paddingTop":20}]},{"type":"itemsTable","visible":true,"columnSizing":"proportional"},{"type":"financialTotals","visible":true},{"type":"notes","visible":"auto"},{"type":"signature","visible":"auto"},{"type":"pageCounter","visible":true}]}',1,'2026-10-11 17:02:27','2026-10-11 17:02:27');
INSERT OR IGNORE INTO "layouts" VALUES(3,'{"schemaVersion":1,"meta":{"name":"Modern","description":"Pre-created layout using bank payment information for new invoices and quotes."},"sections":[{"type":"watermark","visible":"auto","watermarkOrder":"paidFirst"},{"type":"header","visible":true,"blocks":[{"type":"row","children":[{"type":"title"},{"type":"logo"}],"align":"start","justify":"between","paddingBottom":20},{"type":"row","children":[{"type":"businessInfo"},{"type":"invoiceMeta","boxed":true,"showInvoiceLabel":true}],"align":"start","justify":"between"},{"type":"row","children":[{"type":"clientInfo"}],"align":"start","justify":"between","paddingTop":20}]},{"type":"itemsTable","visible":true},{"type":"financialTotals","visible":true},{"type":"paymentInfo","visible":"auto"},{"type":"notes","visible":"auto"},{"type":"signature","visible":"auto"},{"type":"pageCounter","visible":true}]}',0,'2026-10-11 17:02:27','2026-10-11 17:02:27');
INSERT OR IGNORE INTO "layouts" VALUES(4,'{"schemaVersion":1,"meta":{"name":"Legacy Modern","description":"Pre-created legacy layout preserved for existing documents that use business payment information. Do not use for new invoices or quotes."},"sections":[{"type":"watermark","visible":"auto","watermarkOrder":"paidFirst"},{"type":"header","visible":true,"blocks":[{"type":"row","children":[{"type":"title"},{"type":"logo"}],"align":"start","justify":"between","paddingBottom":20},{"type":"row","children":[{"type":"column","width":"50%","children":[{"type":"businessInfo"}]},{"type":"column","width":"50%","children":[{"type":"invoiceMeta","showInvoiceLabel":true,"boxed":true}]}],"align":"start","justify":"between"},{"type":"row","children":[{"type":"column","width":"50%","children":[{"type":"clientInfo"}]},{"type":"column","width":"50%","align":"end","children":[{"type":"paymentInfo","paymentSource":"legacyBusiness","width":"60%"}]}],"align":"start","justify":"between","paddingTop":20}]},{"type":"itemsTable","visible":true,"columnSizing":"proportional"},{"type":"financialTotals","visible":true},{"type":"notes","visible":"auto"},{"type":"signature","visible":"auto"},{"type":"pageCounter","visible":true}]}',1,'2026-10-11 17:02:27','2026-10-11 17:02:27');
INSERT OR IGNORE INTO "layouts" VALUES(5,'{"schemaVersion":1,"meta":{"name":"Compact","description":"Pre-created layout using bank payment information for new invoices and quotes."},"sections":[{"type":"watermark","visible":"auto","watermarkOrder":"paidFirst"},{"type":"header","visible":true,"blocks":[{"type":"column","children":[{"type":"title"}],"align":"center","paddingBottom":20},{"type":"row","children":[{"type":"column","children":[{"type":"businessInfo"}],"width":"40%"},{"type":"column","children":[{"type":"clientInfo"}],"width":"40%"},{"type":"column","children":[{"type":"invoiceMeta","showInvoiceLabel":true}],"width":"20%"}],"align":"start","justify":"between","gap":10}]},{"type":"itemsTable","visible":true},{"type":"financialTotals","visible":true},{"type":"notes","visible":"auto"},{"type":"signature","visible":"auto"},{"type":"pageCounter","visible":true}]}',0,'2026-10-11 17:02:27','2026-10-11 17:02:27');
INSERT OR IGNORE INTO "layouts" VALUES(6,'{"schemaVersion":1,"meta":{"name":"Legacy Compact","description":"Pre-created legacy layout preserved for existing documents that use business payment information. Do not use for new invoices or quotes."},"sections":[{"type":"watermark","visible":"auto","watermarkOrder":"paidFirst"},{"type":"header","visible":true,"blocks":[{"type":"column","children":[{"type":"title"}],"align":"center","paddingBottom":20},{"type":"row","children":[{"type":"column","children":[{"type":"businessInfo"}],"width":"40%"},{"type":"column","children":[{"type":"clientInfo"}],"width":"40%"},{"type":"column","children":[{"type":"invoiceMeta","showInvoiceLabel":true}],"width":"20%"}],"align":"start","justify":"between","gap":10}]},{"type":"itemsTable","visible":true,"columnSizing":"proportional"},{"type":"totalsRow","visible":true,"totalsBlocks":[{"type":"paymentInfo","paymentSource":"legacyBusiness"},{"type":"spacer"},{"type":"financialTotals"}]},{"type":"notes","visible":"auto"},{"type":"signature","visible":"auto"},{"type":"pageCounter","visible":true}]}',1,'2026-10-11 17:02:27','2026-10-11 17:02:27');
CREATE TABLE IF NOT EXISTS migrations (
        "name" TEXT PRIMARY KEY,
        "appliedAt" DATETIME NOT NULL DEFAULT (datetime('now'))
      );
INSERT OR IGNORE INTO "migrations" VALUES('20260105-01-invoice_items-quantity-to-text.cjs','2026-10-11 17:02:27');
INSERT OR IGNORE INTO "migrations" VALUES('20260108-02-invoices-prefix-suffix-language.cjs','2026-10-11 17:02:27');
INSERT OR IGNORE INTO "migrations" VALUES('20260108-03-invoices-ghost-data-cleanup.cjs','2026-10-11 17:02:27');
INSERT OR IGNORE INTO "migrations" VALUES('20260122-04-invoices-signature.cjs','2026-10-11 17:02:27');
INSERT OR IGNORE INTO "migrations" VALUES('20260129-05-style_profiles.cjs','2026-10-11 17:02:27');
INSERT OR IGNORE INTO "migrations" VALUES('20260202-06-style_profile-column-renames.cjs','2026-10-11 17:02:27');
INSERT OR IGNORE INTO "migrations" VALUES('20260202-07-snapshot-tables.cjs','2026-10-11 17:02:27');
INSERT OR IGNORE INTO "migrations" VALUES('20260203-08-customize-items-table.cjs','2026-10-11 17:02:27');
INSERT OR IGNORE INTO "migrations" VALUES('20260205-09-invoice_item_snapshots_fix-name.cjs','2026-10-11 17:02:27');
INSERT OR IGNORE INTO "migrations" VALUES('20260206-10-converting-amount-fields.cjs','2026-10-11 17:02:27');
INSERT OR IGNORE INTO "migrations" VALUES('20260209-11-custom-fields-order.cjs','2026-10-11 17:02:27');
INSERT OR IGNORE INTO "migrations" VALUES('20260209-12-banks-table.cjs','2026-10-11 17:02:27');
INSERT OR IGNORE INTO "migrations" VALUES('20260212-13-vat-code-fields.cjs','2026-10-11 17:02:27');
INSERT OR IGNORE INTO "migrations" VALUES('20260218-14-invoice_sequences.cjs','2026-10-11 17:02:27');
INSERT OR IGNORE INTO "migrations" VALUES('20260218-15-customize-font.cjs','2026-10-11 17:02:27');
INSERT OR IGNORE INTO "migrations" VALUES('20260218-16-custom-labels.cjs','2026-10-11 17:02:27');
INSERT OR IGNORE INTO "migrations" VALUES('20260220-17-banks-fields.cjs','2026-10-11 17:02:27');
INSERT OR IGNORE INTO "migrations" VALUES('20260220-18-templates.cjs','2026-10-11 17:02:27');
INSERT OR IGNORE INTO "migrations" VALUES('20260228-19-style_profile-default-font.cjs','2026-10-11 17:02:27');
INSERT OR IGNORE INTO "migrations" VALUES('20260228-20-peppol-fields.cjs','2026-10-11 17:02:27');
INSERT OR IGNORE INTO "migrations" VALUES('20260304-21-xrechnung-fields.cjs','2026-10-11 17:02:27');
INSERT OR IGNORE INTO "migrations" VALUES('20260612-21-paidAt-closedAt.cjs','2026-10-11 17:02:27');
INSERT OR IGNORE INTO "migrations" VALUES('20260810-22-invoice-unique.cjs','2026-10-11 17:02:27');
INSERT OR IGNORE INTO "migrations" VALUES('20260826-23-invoice-surcharge.cjs','2026-10-11 17:02:27');
INSERT OR IGNORE INTO "migrations" VALUES('20260826-24-invoice-unique.cjs','2026-10-11 17:02:27');
INSERT OR IGNORE INTO "migrations" VALUES('20260826-25-invoice-sequence.cjs','2026-10-11 17:02:27');
INSERT OR IGNORE INTO "migrations" VALUES('20260831-26-settings-receipt.cjs','2026-10-11 17:02:27');
INSERT OR IGNORE INTO "migrations" VALUES('20260902-27-invoice_layouts.cjs','2026-10-11 17:02:27');
INSERT OR IGNORE INTO "migrations" VALUES('20260902-28-layout-schema-seeds.cjs','2026-10-11 17:02:27');
INSERT OR IGNORE INTO "migrations" VALUES('20260903-29-style-profiles-layout-id.cjs','2026-10-11 17:02:27');
INSERT OR IGNORE INTO "migrations" VALUES('20260924-30-us-sales-tax.cjs','2026-10-11 17:02:27');
INSERT OR IGNORE INTO "migrations" VALUES('20260924-31-auth.cjs','2026-10-11 17:02:27');
INSERT OR IGNORE INTO "migrations" VALUES('20260927-32-ecommerce-integrations.cjs','2026-10-11 17:02:27');
CREATE TABLE IF NOT EXISTS presets (
        "id" INTEGER PRIMARY KEY AUTOINCREMENT,
        "name" TEXT NOT NULL UNIQUE,
        "businessId" INTEGER,
        "clientId" INTEGER,
        "currencyId" INTEGER,
        "bankId" INTEGER,
        "customerNotes" TEXT,
        "thanksNotes" TEXT,
        "termsConditionNotes" TEXT,
        "language" TEXT,
        "signatureData" BLOB,
        "signatureName" TEXT,
        "signatureType" TEXT,
        "signatureSize" INTEGER,
        "styleProfilesId" INTEGER,
        "isArchived" INTEGER NOT NULL DEFAULT 0 CHECK ("isArchived" IN (0,1)),
        "createdAt" DATETIME NOT NULL DEFAULT (datetime('now')),
        "updatedAt" DATETIME NOT NULL DEFAULT (datetime('now')),
        FOREIGN KEY("styleProfilesId") REFERENCES style_profiles("id") ON DELETE CASCADE,
        FOREIGN KEY("businessId") REFERENCES businesses("id") ON DELETE CASCADE,
        FOREIGN KEY("clientId") REFERENCES clients("id") ON DELETE CASCADE,
        FOREIGN KEY("currencyId") REFERENCES currencies("id") ON DELETE CASCADE,
        FOREIGN KEY ("bankId") REFERENCES banks("id") ON DELETE CASCADE
      );
CREATE TABLE IF NOT EXISTS sessions (
          "sid" TEXT PRIMARY KEY,
          "data" TEXT NOT NULL,
          "expiresAt" DATETIME NOT NULL
        );
CREATE TABLE IF NOT EXISTS settings (
      "id" INTEGER PRIMARY KEY AUTOINCREMENT,
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
      "createdAt" DATETIME NOT NULL DEFAULT (datetime('now')),
      "updatedAt" DATETIME NOT NULL DEFAULT (datetime('now'))
    , "styleProfilesON" INTEGER NOT NULL DEFAULT 1 CHECK ("styleProfilesON" IN (0,1)), "presetsON" INTEGER NOT NULL DEFAULT 1 CHECK ("presetsON" IN (0,1)), "ublON" INTEGER NOT NULL DEFAULT 1 CHECK ("ublON" IN (0,1)), "xrechnungON" INTEGER NOT NULL DEFAULT 1 CHECK ("xrechnungON" IN (0,1)), "receiptPrintingOn" INTEGER NOT NULL DEFAULT 1 CHECK ("receiptPrintingOn" IN (0,1)));
INSERT OR IGNORE INTO "settings" VALUES(1,'en','en-US','MM/dd/yyyy',1,NULL,NULL,1,1,1,1,1,'2026-10-11 17:02:27','2026-10-11 17:02:27',1,1,1,1,1);
CREATE TABLE IF NOT EXISTS style_profiles (
        "id" INTEGER PRIMARY KEY AUTOINCREMENT,
        "name" TEXT NOT NULL UNIQUE,
        "isArchived" INTEGER NOT NULL DEFAULT 0 CHECK ("isArchived" IN (0,1)),
        "color" TEXT,
        "logoSize" TEXT,
        "fontSize" TEXT,
        "tableHeaderStyle" TEXT,
        "tableRowStyle" TEXT,
        "pageFormat" TEXT,
        "labelUpperCase" INTEGER NOT NULL DEFAULT 0 CHECK ("labelUpperCase" IN (0,1)),
        "watermarkFileName" TEXT,
        "watermarkFileType" TEXT,            
        "watermarkFileSize" INTEGER,       
        "watermarkFileData" BLOB,         
        "paidWatermarkFileName" TEXT,
        "paidWatermarkFileType" TEXT,            
        "paidWatermarkFileSize" INTEGER,        
        "paidWatermarkFileData" BLOB,     
        "createdAt" DATETIME NOT NULL DEFAULT (datetime('now')),
        "updatedAt" DATETIME NOT NULL DEFAULT (datetime('now'))
      , "showQuantity" INTEGER NOT NULL DEFAULT 1 CHECK ("showQuantity" IN (0,1)), "showUnit" INTEGER NOT NULL DEFAULT 1 CHECK ("showUnit" IN (0,1)), "showRowNo" INTEGER NOT NULL DEFAULT 1 CHECK ("showRowNo" IN (0,1)), "fieldSortOrders" TEXT NOT NULL DEFAULT '{"no":0,"item":1,"unit":2,"quantity":3,"unitCost":4,"total":5}', "fontFamily" TEXT, "pdfTexts" TEXT, "layoutId" INTEGER REFERENCES layouts("id"));
CREATE TABLE IF NOT EXISTS units (
      "id" INTEGER PRIMARY KEY AUTOINCREMENT,
      "name" TEXT NOT NULL UNIQUE,
      "isArchived" INTEGER NOT NULL DEFAULT 0 CHECK ("isArchived" IN (0,1)),
      "createdAt" DATETIME NOT NULL DEFAULT (datetime('now')),
      "updatedAt" DATETIME NOT NULL DEFAULT (datetime('now'))
    );
INSERT OR IGNORE INTO "units" VALUES(1,'pcs',0,'2026-10-11 17:02:27','2026-10-11 17:02:27');
INSERT OR IGNORE INTO "units" VALUES(2,'kgs',0,'2026-10-11 17:02:27','2026-10-11 17:02:27');
INSERT OR IGNORE INTO "units" VALUES(3,'gs',0,'2026-10-11 17:02:27','2026-10-11 17:02:27');
INSERT OR IGNORE INTO "units" VALUES(4,'lbs',0,'2026-10-11 17:02:27','2026-10-11 17:02:27');
INSERT OR IGNORE INTO "units" VALUES(5,'ozs',0,'2026-10-11 17:02:27','2026-10-11 17:02:27');
INSERT OR IGNORE INTO "units" VALUES(6,'ls',0,'2026-10-11 17:02:27','2026-10-11 17:02:27');
INSERT OR IGNORE INTO "units" VALUES(7,'mls',0,'2026-10-11 17:02:27','2026-10-11 17:02:27');
INSERT OR IGNORE INTO "units" VALUES(8,'ms',0,'2026-10-11 17:02:27','2026-10-11 17:02:27');
INSERT OR IGNORE INTO "units" VALUES(9,'cms',0,'2026-10-11 17:02:27','2026-10-11 17:02:27');
INSERT OR IGNORE INTO "units" VALUES(10,'fts',0,'2026-10-11 17:02:27','2026-10-11 17:02:27');
INSERT OR IGNORE INTO "units" VALUES(11,'hrs',0,'2026-10-11 17:02:27','2026-10-11 17:02:27');
INSERT OR IGNORE INTO "units" VALUES(12,'mins',0,'2026-10-11 17:02:27','2026-10-11 17:02:27');
INSERT OR IGNORE INTO "units" VALUES(13,'secs',0,'2026-10-11 17:02:27','2026-10-11 17:02:27');
CREATE TABLE IF NOT EXISTS us_sales_tax_rates (
          "stateCode" TEXT PRIMARY KEY,
          "stateName" TEXT NOT NULL,
          "rate" REAL NOT NULL,
          "updatedAt" DATETIME NOT NULL DEFAULT (datetime('now'))
        );
INSERT OR IGNORE INTO "us_sales_tax_rates" VALUES('AL','Alabama',4.0,'2026-10-11 17:02:27');
INSERT OR IGNORE INTO "us_sales_tax_rates" VALUES('AK','Alaska',0.0,'2026-10-11 17:02:27');
INSERT OR IGNORE INTO "us_sales_tax_rates" VALUES('AZ','Arizona',5.6,'2026-10-11 17:02:27');
INSERT OR IGNORE INTO "us_sales_tax_rates" VALUES('AR','Arkansas',6.5,'2026-10-11 17:02:27');
INSERT OR IGNORE INTO "us_sales_tax_rates" VALUES('CA','California',7.25,'2026-10-11 17:02:27');
INSERT OR IGNORE INTO "us_sales_tax_rates" VALUES('CO','Colorado',2.9,'2026-10-11 17:02:27');
INSERT OR IGNORE INTO "us_sales_tax_rates" VALUES('CT','Connecticut',6.35,'2026-10-11 17:02:27');
INSERT OR IGNORE INTO "us_sales_tax_rates" VALUES('DE','Delaware',0.0,'2026-10-11 17:02:27');
INSERT OR IGNORE INTO "us_sales_tax_rates" VALUES('DC','District of Columbia',6.0,'2026-10-11 17:02:27');
INSERT OR IGNORE INTO "us_sales_tax_rates" VALUES('FL','Florida',6.0,'2026-10-11 17:02:27');
INSERT OR IGNORE INTO "us_sales_tax_rates" VALUES('GA','Georgia',4.0,'2026-10-11 17:02:27');
INSERT OR IGNORE INTO "us_sales_tax_rates" VALUES('HI','Hawaii',4.0,'2026-10-11 17:02:27');
INSERT OR IGNORE INTO "us_sales_tax_rates" VALUES('ID','Idaho',6.0,'2026-10-11 17:02:27');
INSERT OR IGNORE INTO "us_sales_tax_rates" VALUES('IL','Illinois',6.25,'2026-10-11 17:02:27');
INSERT OR IGNORE INTO "us_sales_tax_rates" VALUES('IN','Indiana',7.0,'2026-10-11 17:02:27');
INSERT OR IGNORE INTO "us_sales_tax_rates" VALUES('IA','Iowa',6.0,'2026-10-11 17:02:27');
INSERT OR IGNORE INTO "us_sales_tax_rates" VALUES('KS','Kansas',6.5,'2026-10-11 17:02:27');
INSERT OR IGNORE INTO "us_sales_tax_rates" VALUES('KY','Kentucky',6.0,'2026-10-11 17:02:27');
INSERT OR IGNORE INTO "us_sales_tax_rates" VALUES('LA','Louisiana',4.45,'2026-10-11 17:02:27');
INSERT OR IGNORE INTO "us_sales_tax_rates" VALUES('ME','Maine',5.5,'2026-10-11 17:02:27');
INSERT OR IGNORE INTO "us_sales_tax_rates" VALUES('MD','Maryland',6.0,'2026-10-11 17:02:27');
INSERT OR IGNORE INTO "us_sales_tax_rates" VALUES('MA','Massachusetts',6.25,'2026-10-11 17:02:27');
INSERT OR IGNORE INTO "us_sales_tax_rates" VALUES('MI','Michigan',6.0,'2026-10-11 17:02:27');
INSERT OR IGNORE INTO "us_sales_tax_rates" VALUES('MN','Minnesota',6.875,'2026-10-11 17:02:27');
INSERT OR IGNORE INTO "us_sales_tax_rates" VALUES('MS','Mississippi',7.0,'2026-10-11 17:02:27');
INSERT OR IGNORE INTO "us_sales_tax_rates" VALUES('MO','Missouri',4.225,'2026-10-11 17:02:27');
INSERT OR IGNORE INTO "us_sales_tax_rates" VALUES('MT','Montana',0.0,'2026-10-11 17:02:27');
INSERT OR IGNORE INTO "us_sales_tax_rates" VALUES('NE','Nebraska',5.5,'2026-10-11 17:02:27');
INSERT OR IGNORE INTO "us_sales_tax_rates" VALUES('NV','Nevada',6.85,'2026-10-11 17:02:27');
INSERT OR IGNORE INTO "us_sales_tax_rates" VALUES('NH','New Hampshire',0.0,'2026-10-11 17:02:27');
INSERT OR IGNORE INTO "us_sales_tax_rates" VALUES('NJ','New Jersey',6.625,'2026-10-11 17:02:27');
INSERT OR IGNORE INTO "us_sales_tax_rates" VALUES('NM','New Mexico',4.875,'2026-10-11 17:02:27');
INSERT OR IGNORE INTO "us_sales_tax_rates" VALUES('NY','New York',4.0,'2026-10-11 17:02:27');
INSERT OR IGNORE INTO "us_sales_tax_rates" VALUES('NC','North Carolina',4.75,'2026-10-11 17:02:27');
INSERT OR IGNORE INTO "us_sales_tax_rates" VALUES('ND','North Dakota',5.0,'2026-10-11 17:02:27');
INSERT OR IGNORE INTO "us_sales_tax_rates" VALUES('OH','Ohio',5.75,'2026-10-11 17:02:27');
INSERT OR IGNORE INTO "us_sales_tax_rates" VALUES('OK','Oklahoma',4.5,'2026-10-11 17:02:27');
INSERT OR IGNORE INTO "us_sales_tax_rates" VALUES('OR','Oregon',0.0,'2026-10-11 17:02:27');
INSERT OR IGNORE INTO "us_sales_tax_rates" VALUES('PA','Pennsylvania',6.0,'2026-10-11 17:02:27');
INSERT OR IGNORE INTO "us_sales_tax_rates" VALUES('RI','Rhode Island',7.0,'2026-10-11 17:02:27');
INSERT OR IGNORE INTO "us_sales_tax_rates" VALUES('SC','South Carolina',6.0,'2026-10-11 17:02:27');
INSERT OR IGNORE INTO "us_sales_tax_rates" VALUES('SD','South Dakota',4.2,'2026-10-11 17:02:27');
INSERT OR IGNORE INTO "us_sales_tax_rates" VALUES('TN','Tennessee',7.0,'2026-10-11 17:02:27');
INSERT OR IGNORE INTO "us_sales_tax_rates" VALUES('TX','Texas',6.25,'2026-10-11 17:02:27');
INSERT OR IGNORE INTO "us_sales_tax_rates" VALUES('UT','Utah',6.1,'2026-10-11 17:02:27');
INSERT OR IGNORE INTO "us_sales_tax_rates" VALUES('VT','Vermont',6.0,'2026-10-11 17:02:27');
INSERT OR IGNORE INTO "us_sales_tax_rates" VALUES('VA','Virginia',5.3,'2026-10-11 17:02:27');
INSERT OR IGNORE INTO "us_sales_tax_rates" VALUES('WA','Washington',6.5,'2026-10-11 17:02:27');
INSERT OR IGNORE INTO "us_sales_tax_rates" VALUES('WV','West Virginia',6.0,'2026-10-11 17:02:27');
INSERT OR IGNORE INTO "us_sales_tax_rates" VALUES('WI','Wisconsin',5.0,'2026-10-11 17:02:27');
INSERT OR IGNORE INTO "us_sales_tax_rates" VALUES('WY','Wyoming',4.0,'2026-10-11 17:02:27');
CREATE TABLE IF NOT EXISTS users (
          "id" INTEGER PRIMARY KEY AUTOINCREMENT,
          "email" TEXT NOT NULL UNIQUE,
          "passwordHash" TEXT NOT NULL,
          "role" TEXT NOT NULL DEFAULT 'owner',
          "failedLoginCount" INTEGER NOT NULL DEFAULT 0,
          "lockedUntil" DATETIME,
          "lastLoginAt" DATETIME,
          "createdAt" DATETIME NOT NULL DEFAULT (datetime('now')),
          "updatedAt" DATETIME NOT NULL DEFAULT (datetime('now'))
        );
CREATE INDEX IF NOT EXISTS idx_attachments_invoiceId ON attachments("parentInvoiceId");
CREATE INDEX IF NOT EXISTS idx_items_unitId ON items("unitId");
CREATE INDEX IF NOT EXISTS idx_items_categoryId ON items("categoryId");
CREATE INDEX IF NOT EXISTS idx_clients_active ON clients("isArchived");
CREATE INDEX IF NOT EXISTS idx_items_active ON items("isArchived");
CREATE INDEX IF NOT EXISTS idx_businesses_active ON businesses("isArchived");
CREATE INDEX IF NOT EXISTS idx_categories_active ON categories("isArchived");
CREATE INDEX IF NOT EXISTS idx_units_active ON units("isArchived");
CREATE INDEX IF NOT EXISTS idx_currencies_active ON currencies("isArchived");
CREATE INDEX IF NOT EXISTS idx_invoice_items_invoiceId ON invoice_items("parentInvoiceId");
CREATE INDEX IF NOT EXISTS idx_invoice_items_itemId ON invoice_items("itemId");
CREATE INDEX IF NOT EXISTS idx_style_profiles_id ON style_profiles("id");
CREATE INDEX IF NOT EXISTS idx_invoice_business_snapshots_parentInvoiceId ON invoice_business_snapshots("parentInvoiceId");
CREATE INDEX IF NOT EXISTS idx_invoice_business_snapshots_businessName ON invoice_business_snapshots("businessName");
CREATE INDEX IF NOT EXISTS idx_invoice_business_snapshots_businessShortName ON invoice_business_snapshots("businessShortName");
CREATE INDEX IF NOT EXISTS idx_invoice_client_snapshots_parentInvoiceId ON invoice_client_snapshots("parentInvoiceId");
CREATE INDEX IF NOT EXISTS idx_invoice_client_snapshots_clientName ON invoice_client_snapshots("clientName");
CREATE INDEX IF NOT EXISTS idx_invoice_client_snapshots_clientCode ON invoice_client_snapshots("clientCode");
CREATE INDEX IF NOT EXISTS idx_invoice_currency_snapshots_parentInvoiceId ON invoice_currency_snapshots("parentInvoiceId");
CREATE INDEX IF NOT EXISTS idx_invoice_currency_snapshots_currencyCode ON invoice_currency_snapshots("currencyCode");
CREATE INDEX IF NOT EXISTS idx_invoice_customizations_parentInvoiceId ON invoice_customizations("parentInvoiceId");
CREATE INDEX IF NOT EXISTS idx_invoice_style_profile_snapshots_parentInvoiceId ON invoice_style_profile_snapshots("parentInvoiceId");
CREATE INDEX IF NOT EXISTS idx_invoice_payments_invoiceId ON invoice_payments("parentInvoiceId");
CREATE INDEX IF NOT EXISTS idx_invoice_item_snapshots_parentInvoiceItemId ON invoice_item_snapshots("parentInvoiceItemId");
CREATE INDEX IF NOT EXISTS idx_invoice_item_snapshots_itemName ON invoice_item_snapshots("itemName");
CREATE INDEX IF NOT EXISTS idx_invoice_bank_snapshots_parentInvoiceId ON invoice_bank_snapshots("parentInvoiceId");
CREATE INDEX IF NOT EXISTS idx_banks_bankname_accountnumber ON banks("bankName", "accountNumber");
CREATE INDEX IF NOT EXISTS idx_banks_active ON banks("isArchived");
CREATE INDEX IF NOT EXISTS idx_style_profiles_active ON style_profiles("isArchived");
CREATE INDEX IF NOT EXISTS idx_invoices_bankId ON invoices("bankId");
CREATE INDEX IF NOT EXISTS idx_invoices_clientId ON invoices("clientId");
CREATE INDEX IF NOT EXISTS idx_invoices_businessId ON invoices("businessId");
CREATE INDEX IF NOT EXISTS idx_invoices_business_client ON invoices("businessId", "clientId");
CREATE INDEX IF NOT EXISTS idx_invoices_type ON invoices("invoiceType");
CREATE INDEX IF NOT EXISTS idx_invoices_convertedFromQuotationId ON invoices("convertedFromQuotationId");
CREATE INDEX IF NOT EXISTS idx_invoices_invoiceNumber ON invoices("invoiceNumber");
CREATE INDEX IF NOT EXISTS idx_invoices_status ON invoices("status");
CREATE INDEX IF NOT EXISTS idx_invoices_issuedAt ON invoices("issuedAt");
CREATE INDEX IF NOT EXISTS idx_invoices_styleProfilesId ON invoices("styleProfilesId");
CREATE INDEX IF NOT EXISTS idx_layouts_id ON layouts("id");
CREATE INDEX IF NOT EXISTS idx_invoice_layout_snapshots_parentInvoiceId ON invoice_layout_snapshots("parentInvoiceId");
CREATE INDEX IF NOT EXISTS idx_invoices_layoutId ON invoices("layoutId");
CREATE INDEX IF NOT EXISTS idx_style_profiles_layoutId ON style_profiles("layoutId");
CREATE INDEX IF NOT EXISTS idx_api_keys_revokedAt ON api_keys("revokedAt");
CREATE INDEX IF NOT EXISTS idx_sessions_expiresAt ON sessions("expiresAt");
CREATE INDEX IF NOT EXISTS idx_ecommerce_integrations_platform ON ecommerce_integrations("platform");
CREATE UNIQUE INDEX IF NOT EXISTS idx_ecommerce_orders_unique ON ecommerce_orders("integrationId", "externalOrderId");
