Object.defineProperty(exports,Symbol.toStringTag,{value:`Module`});const e=require("./errorFunctions-CauxoFNQ.cjs"),t=require("./dbHelper-CkY49b5y.cjs");var n=async n=>{try{if(await t.i(n,`invoice_business_snapshots`))return;await n.run(`
      CREATE TABLE IF NOT EXISTS invoice_business_snapshots (
        "id" ${t.t(`INTEGER PRIMARY KEY AUTOINCREMENT`,n.type)},
        "parentInvoiceId" INTEGER NOT NULL,
        "businessName" TEXT NOT NULL,
        "businessShortName" TEXT NOT NULL CHECK (length("businessShortName") <= 2),
        "businessAddress" TEXT,
        "businessRole" TEXT,
        "businessEmail" TEXT,
        "businessPhone" TEXT,
        "businessAdditional" TEXT,
        "businessPaymentInformation" TEXT,
        "businessLogo" ${t.t(`BLOB`,n.type)},
        "businessFileSize" INTEGER,
        "businessFileType" TEXT,
        "businessFileName" TEXT,
        "createdAt" ${t.t(`DATETIME`,n.type)} NOT NULL DEFAULT ${t.n(`(datetime('now'))`,n.type)},
        "updatedAt" ${t.t(`DATETIME`,n.type)} NOT NULL DEFAULT ${t.n(`(datetime('now'))`,n.type)},
        FOREIGN KEY("parentInvoiceId") REFERENCES invoices("id") ON DELETE CASCADE
      );
    `),await n.run(`
      CREATE TABLE IF NOT EXISTS invoice_client_snapshots (
        "id" ${t.t(`INTEGER PRIMARY KEY AUTOINCREMENT`,n.type)},
        "parentInvoiceId" INTEGER NOT NULL,
        "clientName" TEXT NOT NULL,
        "clientAddress" TEXT,
        "clientEmail" TEXT,
        "clientPhone" TEXT,
        "clientCode" TEXT,
        "clientAdditional" TEXT,
        "createdAt" ${t.t(`DATETIME`,n.type)} NOT NULL DEFAULT ${t.n(`(datetime('now'))`,n.type)},
        "updatedAt" ${t.t(`DATETIME`,n.type)} NOT NULL DEFAULT ${t.n(`(datetime('now'))`,n.type)},
        FOREIGN KEY("parentInvoiceId") REFERENCES invoices("id") ON DELETE CASCADE
      );
      `),await n.run(`
      CREATE TABLE IF NOT EXISTS invoice_currency_snapshots (
        "id" ${t.t(`INTEGER PRIMARY KEY AUTOINCREMENT`,n.type)},
        "parentInvoiceId" INTEGER NOT NULL,
        "currencyCode" TEXT NOT NULL,
        "currencySymbol" TEXT NOT NULL,
        "currencySubunit" INTEGER NOT NULL,
        "createdAt" ${t.t(`DATETIME`,n.type)} NOT NULL DEFAULT ${t.n(`(datetime('now'))`,n.type)},
        "updatedAt" ${t.t(`DATETIME`,n.type)} NOT NULL DEFAULT ${t.n(`(datetime('now'))`,n.type)},
        FOREIGN KEY("parentInvoiceId") REFERENCES invoices("id") ON DELETE CASCADE
      );
    `),await n.run(`
      CREATE TABLE IF NOT EXISTS invoice_customizations (
        "id" ${t.t(`INTEGER PRIMARY KEY AUTOINCREMENT`,n.type)},
        "parentInvoiceId" INTEGER NOT NULL,
        "color" TEXT NOT NULL DEFAULT '#006400',
        "logoSize" TEXT NOT NULL DEFAULT 'medium',
        "fontSize" TEXT NOT NULL DEFAULT 'medium',
        "layout" TEXT NOT NULL DEFAULT 'classic',
        "tableHeaderStyle" TEXT NOT NULL DEFAULT 'light',
        "tableRowStyle" TEXT NOT NULL DEFAULT 'classic',
        "pageFormat" TEXT NOT NULL DEFAULT 'A4',
        "labelUpperCase" INTEGER NOT NULL DEFAULT 0 CHECK ("labelUpperCase" IN (0,1)),
        "watermarkFileName" TEXT,
        "watermarkFileType" TEXT,
        "watermarkFileSize" INTEGER,
        "watermarkFileData" ${t.t(`BLOB`,n.type)},
        "paidWatermarkFileName" TEXT,
        "paidWatermarkFileType" TEXT,
        "paidWatermarkFileSize" INTEGER,
        "paidWatermarkFileData" ${t.t(`BLOB`,n.type)},
        "createdAt" ${t.t(`DATETIME`,n.type)} NOT NULL DEFAULT ${t.n(`(datetime('now'))`,n.type)},
        "updatedAt" ${t.t(`DATETIME`,n.type)} NOT NULL DEFAULT ${t.n(`(datetime('now'))`,n.type)},
        FOREIGN KEY("parentInvoiceId") REFERENCES invoices("id") ON DELETE CASCADE
      );
    `),await n.run(`
      CREATE TABLE IF NOT EXISTS invoice_style_profile_snapshots (
        "id" ${t.t(`INTEGER PRIMARY KEY AUTOINCREMENT`,n.type)},
        "parentInvoiceId" INTEGER NOT NULL,
        "styleProfileName" TEXT NOT NULL,
        "createdAt" ${t.t(`DATETIME`,n.type)} NOT NULL DEFAULT ${t.n(`(datetime('now'))`,n.type)},
        "updatedAt" ${t.t(`DATETIME`,n.type)} NOT NULL DEFAULT ${t.n(`(datetime('now'))`,n.type)},
        FOREIGN KEY("parentInvoiceId") REFERENCES invoices("id") ON DELETE CASCADE
      );
    `),await n.run(`
      CREATE TABLE IF NOT EXISTS invoice_item_snaphots (
        "id" ${t.t(`INTEGER PRIMARY KEY AUTOINCREMENT`,n.type)},
        "parentInvoiceItemId" INTEGER NOT NULL,
        "itemName" TEXT NOT NULL,
        "unitPriceCents" INTEGER NOT NULL DEFAULT 0,
        "unitName" TEXT,
        "createdAt" ${t.t(`DATETIME`,n.type)} NOT NULL DEFAULT ${t.n(`(datetime('now'))`,n.type)},
        "updatedAt" ${t.t(`DATETIME`,n.type)} NOT NULL DEFAULT ${t.n(`(datetime('now'))`,n.type)},
        FOREIGN KEY("parentInvoiceItemId") REFERENCES invoice_items("id") ON DELETE CASCADE
      );
    `),await n.run(`CREATE INDEX IF NOT EXISTS idx_invoice_business_snapshots_parentInvoiceId ON invoice_business_snapshots("parentInvoiceId")`),await n.run(`CREATE INDEX IF NOT EXISTS idx_invoice_business_snapshots_businessName ON invoice_business_snapshots("businessName")`),await n.run(`CREATE INDEX IF NOT EXISTS idx_invoice_business_snapshots_businessShortName ON invoice_business_snapshots("businessShortName")`),await n.run(`CREATE INDEX IF NOT EXISTS idx_invoice_client_snapshots_parentInvoiceId ON invoice_client_snapshots("parentInvoiceId")`),await n.run(`CREATE INDEX IF NOT EXISTS idx_invoice_client_snapshots_clientName ON invoice_client_snapshots("clientName")`),await n.run(`CREATE INDEX IF NOT EXISTS idx_invoice_client_snapshots_clientCode ON invoice_client_snapshots("clientCode")`),await n.run(`CREATE INDEX IF NOT EXISTS idx_invoice_currency_snapshots_parentInvoiceId ON invoice_currency_snapshots("parentInvoiceId")`),await n.run(`CREATE INDEX IF NOT EXISTS idx_invoice_currency_snapshots_currencyCode ON invoice_currency_snapshots("currencyCode")`),await n.run(`CREATE INDEX IF NOT EXISTS idx_invoice_customizations_parentInvoiceId ON invoice_customizations("parentInvoiceId")`),await n.run(`CREATE INDEX IF NOT EXISTS idx_invoice_style_profile_snapshots_parentInvoiceId ON invoice_style_profile_snapshots("parentInvoiceId")`),await n.run(`CREATE INDEX IF NOT EXISTS idx_invoice_item_snapshots_parentInvoiceItemId ON invoice_item_snaphots("parentInvoiceItemId")`),await n.run(`CREATE INDEX IF NOT EXISTS idx_invoice_item_snapshots_itemName ON invoice_item_snaphots("itemName")`),await n.run(`
      INSERT INTO invoice_business_snapshots (
          "parentInvoiceId",
          "businessName",
          "businessShortName",
          "businessAddress",
          "businessRole",
          "businessEmail",
          "businessPhone",
          "businessAdditional",
          "businessPaymentInformation",
          "businessLogo",
          "businessFileSize",
          "businessFileType",
          "businessFileName",
          "createdAt",
          "updatedAt"
      )
      SELECT
          i."id",
          i."businessNameSnapshot",
          i."businessShortNameSnapshot",
          i."businessAddressSnapshot",
          i."businessRoleSnapshot",
          i."businessEmailSnapshot",
          i."businessPhoneSnapshot",
          i."businessAdditionalSnapshot",
          i."businessPaymentInformationSnapshot",
          i."businessLogoSnapshot",
          i."businessFileSizeSnapshot",
          i."businessFileTypeSnapshot",
          i."businessFileNameSnapshot",
          i."createdAt",
          i."updatedAt"
      FROM invoices as i;
    `),await n.run(`
      INSERT INTO invoice_client_snapshots (
          "parentInvoiceId",
          "clientName",
          "clientAddress",
          "clientEmail",
          "clientPhone",
          "clientCode",
          "clientAdditional",
          "createdAt",
          "updatedAt"
      )
      SELECT
          i."id",
          i."clientNameSnapshot",
          i."clientAddressSnapshot",
          i."clientEmailSnapshot",
          i."clientPhoneSnapshot",
          i."clientCodeSnapshot",
          i."clientAdditionalSnapshot",
          i."createdAt",
          i."updatedAt"
      FROM invoices as i;
    `),await n.run(`
      INSERT INTO invoice_currency_snapshots (
          "parentInvoiceId",
          "currencyCode",
          "currencySymbol",
          "currencySubunit",
          "createdAt",
          "updatedAt"
      )
      SELECT
          "id",
          "currencyCodeSnapshot",
          "currencySymbolSnapshot",
          "currencySubunitSnapshot",
          "createdAt",
          "updatedAt"
      FROM invoices;
    `),await n.run(`
      INSERT INTO invoice_customizations (
          "parentInvoiceId",
          "color",
          "logoSize",
          "fontSize",
          "layout",
          "tableHeaderStyle",
          "tableRowStyle",
          "pageFormat",
          "labelUpperCase",
          "watermarkFileName",
          "watermarkFileType",
          "watermarkFileSize",
          "watermarkFileData",
          "paidWatermarkFileName",
          "paidWatermarkFileType",
          "paidWatermarkFileSize",
          "paidWatermarkFileData",
          "createdAt",
          "updatedAt"
      )
      SELECT
          "id",
          "customizationColor",
          "customizationLogoSize",
          "customizationFontSizeSize",
          "customizationLayout",
          "customizationTableHeaderStyle",
          "customizationTableRowStyle",
          "customizationPageFormat",
          "customizationLabelUpperCase",
          "customizationWatermarkFileName",
          "customizationWatermarkFileType",
          "customizationWatermarkFileSize",
          "customizationWatermarkFileData",
          "customizationPaidWatermarkFileName",
          "customizationPaidWatermarkFileType",
          "customizationPaidWatermarkFileSize",
          "customizationPaidWatermarkFileData",
          "createdAt",
          "updatedAt"
      FROM invoices;
    `),await n.run(`
      INSERT INTO invoice_style_profile_snapshots (
          "parentInvoiceId",
          "styleProfileName",
          "createdAt",
          "updatedAt"
      )
      SELECT
          "id",
          "styleProfileNameSnapshot",
          "createdAt",
          "updatedAt"
      FROM invoices
      WHERE "styleProfilesId" IS NOT NULL;
    `),await n.run(`
      INSERT INTO invoice_item_snaphots (
          "parentInvoiceItemId",
          "itemName",
          "unitPriceCents",
          "unitName",
          "createdAt",
          "updatedAt"
      )
      SELECT
          "id",
          "itemNameSnapshot",
          "unitPriceCentsSnapshot",
          "unitNameSnapshot",
          "createdAt",
          "updatedAt"
      FROM invoice_items;
    `),await n.run(`ALTER TABLE invoices DROP COLUMN "businessNameSnapshot";`),await n.run(`ALTER TABLE invoices DROP COLUMN "businessShortNameSnapshot";`),await n.run(`ALTER TABLE invoices DROP COLUMN "businessAddressSnapshot";`),await n.run(`ALTER TABLE invoices DROP COLUMN "businessRoleSnapshot";`),await n.run(`ALTER TABLE invoices DROP COLUMN "businessEmailSnapshot";`),await n.run(`ALTER TABLE invoices DROP COLUMN "businessPhoneSnapshot";`),await n.run(`ALTER TABLE invoices DROP COLUMN "businessAdditionalSnapshot";`),await n.run(`ALTER TABLE invoices DROP COLUMN "businessPaymentInformationSnapshot";`),await n.run(`ALTER TABLE invoices DROP COLUMN "businessLogoSnapshot";`),await n.run(`ALTER TABLE invoices DROP COLUMN "businessFileSizeSnapshot";`),await n.run(`ALTER TABLE invoices DROP COLUMN "businessFileTypeSnapshot";`),await n.run(`ALTER TABLE invoices DROP COLUMN "businessFileNameSnapshot";`),await n.run(`ALTER TABLE invoices DROP COLUMN "clientNameSnapshot";`),await n.run(`ALTER TABLE invoices DROP COLUMN "clientAddressSnapshot";`),await n.run(`ALTER TABLE invoices DROP COLUMN "clientEmailSnapshot";`),await n.run(`ALTER TABLE invoices DROP COLUMN "clientPhoneSnapshot";`),await n.run(`ALTER TABLE invoices DROP COLUMN "clientCodeSnapshot";`),await n.run(`ALTER TABLE invoices DROP COLUMN "clientAdditionalSnapshot";`),await n.run(`ALTER TABLE invoices DROP COLUMN "currencyCodeSnapshot";`),await n.run(`ALTER TABLE invoices DROP COLUMN "currencySymbolSnapshot";`),await n.run(`ALTER TABLE invoices DROP COLUMN "currencySubunitSnapshot";`),await n.run(`ALTER TABLE invoices DROP COLUMN "customizationColor";`),await n.run(`ALTER TABLE invoices DROP COLUMN "customizationLogoSize";`),await n.run(`ALTER TABLE invoices DROP COLUMN "customizationFontSizeSize";`),await n.run(`ALTER TABLE invoices DROP COLUMN "customizationLayout";`),await n.run(`ALTER TABLE invoices DROP COLUMN "customizationTableHeaderStyle";`),await n.run(`ALTER TABLE invoices DROP COLUMN "customizationTableRowStyle";`),await n.run(`ALTER TABLE invoices DROP COLUMN "customizationPageFormat";`),await n.run(`ALTER TABLE invoices DROP COLUMN "customizationLabelUpperCase";`),await n.run(`ALTER TABLE invoices DROP COLUMN "customizationWatermarkFileName";`),await n.run(`ALTER TABLE invoices DROP COLUMN "customizationWatermarkFileType";`),await n.run(`ALTER TABLE invoices DROP COLUMN "customizationWatermarkFileSize";`),await n.run(`ALTER TABLE invoices DROP COLUMN "customizationWatermarkFileData";`),await n.run(`ALTER TABLE invoices DROP COLUMN "customizationPaidWatermarkFileName";`),await n.run(`ALTER TABLE invoices DROP COLUMN "customizationPaidWatermarkFileType";`),await n.run(`ALTER TABLE invoices DROP COLUMN "customizationPaidWatermarkFileSize";`),await n.run(`ALTER TABLE invoices DROP COLUMN "customizationPaidWatermarkFileData";`),await n.run(`ALTER TABLE invoices DROP COLUMN "styleProfileNameSnapshot";`),await n.run(`ALTER TABLE invoice_items DROP COLUMN "itemNameSnapshot";`),await n.run(`ALTER TABLE invoice_items DROP COLUMN "unitPriceCentsSnapshot";`),await n.run(`ALTER TABLE invoice_items DROP COLUMN "unitNameSnapshot";`)}catch(t){return{success:!1,...e.t(t,n.type)}}};exports.up=n;