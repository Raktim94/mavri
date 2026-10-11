Object.defineProperty(exports,Symbol.toStringTag,{value:`Module`});const e=require("./errorFunctions-CauxoFNQ.cjs"),t=require("./dbHelper-CkY49b5y.cjs");var n=async n=>{try{let r=(await t.r(n,`invoices`)).find(e=>e.name===`discountAmountCents`);if(r){let e=String(r.type).toUpperCase();if(e===`TEXT`||e===`CHARACTER VARYING`||e===`VARCHAR`)return}n.type===e.n.sqlite&&(await n.run(`DROP TABLE IF EXISTS invoices_new;`),await n.run(`
        CREATE TABLE IF NOT EXISTS invoices_new (
          "id" ${t.t(`INTEGER PRIMARY KEY AUTOINCREMENT`,n.type)},
          "invoiceType" TEXT NOT NULL CHECK("invoiceType" IN ('quotation','invoice')),
          "convertedFromQuotationId" INTEGER,
          "businessId" INTEGER NOT NULL,
          "clientId" INTEGER NOT NULL,
          "currencyId" INTEGER NOT NULL,
          "createdAt" ${t.t(`DATETIME`,n.type)} NOT NULL DEFAULT ${t.n(`(datetime('now'))`,n.type)},
          "updatedAt" ${t.t(`DATETIME`,n.type)} NOT NULL DEFAULT ${t.n(`(datetime('now'))`,n.type)},
          "issuedAt" ${t.t(`DATETIME`,n.type)} NOT NULL,
          "dueDate" ${t.t(`DATETIME`,n.type)},
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
          "signatureData" ${t.t(`BLOB`,n.type)},
          "signatureName" TEXT,
          "signatureType" TEXT,
          "signatureSize" INTEGER,
          "styleProfilesId" INTEGER,
          FOREIGN KEY("styleProfilesId") REFERENCES style_profiles("id"),
          FOREIGN KEY("businessId") REFERENCES businesses("id"),
          FOREIGN KEY("clientId") REFERENCES clients("id"),
          FOREIGN KEY("currencyId") REFERENCES currencies("id"),
          FOREIGN KEY("convertedFromQuotationId") REFERENCES invoices("id"),
          UNIQUE("businessId","invoiceFullNumber"),
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
      `),await n.run(`
        INSERT INTO invoices_new (
          "id",
          "invoiceType",
          "convertedFromQuotationId",
          "businessId",
          "clientId",
          "currencyId",
          "createdAt",
          "updatedAt",
          "issuedAt",
          "dueDate",
          "invoiceNumber",
          "isArchived",
          "status",
          "customerNotes",
          "thanksNotes",
          "termsConditionNotes",
          "discountName",
          "discountType",
          "discountAmountCents",
          "discountPercent",
          "shippingFeeCents",
          "invoicePrefix",
          "invoiceSuffix",
          "taxName",
          "taxRate",
          "taxType",
          "language",
          "signatureData",
          "signatureName",
          "signatureType",
          "signatureSize",
          "styleProfilesId"
        )
        SELECT
          i."id",
          i."invoiceType",
          i."convertedFromQuotationId",
          i."businessId",
          i."clientId",
          i."currencyId",
          i."createdAt",
          i."updatedAt",
          i."issuedAt",
          i."dueDate",
          i."invoiceNumber",
          i."isArchived",
          i."status",
          i."customerNotes",
          i."thanksNotes",
          i."termsConditionNotes",
          i."discountName",
          i."discountType",
          i."discountAmountCents",
          i."discountPercent",
          i."shippingFeeCents",
          i."invoicePrefix",
          i."invoiceSuffix",
          i."taxName",
          i."taxRate",
          i."taxType",
          i."language",
          i."signatureData",
          i."signatureName",
          i."signatureType",
          i."signatureSize",
          i."styleProfilesId"
        FROM invoices as i;
        `),await n.run(`DROP TABLE invoices;`),await n.run(`ALTER TABLE invoices_new RENAME TO invoices;`),await n.run(`CREATE INDEX IF NOT EXISTS idx_invoices_clientId ON invoices("clientId")`),await n.run(`CREATE INDEX IF NOT EXISTS idx_invoices_businessId ON invoices("businessId")`),await n.run(`CREATE INDEX IF NOT EXISTS idx_invoices_business_client ON invoices("businessId", "clientId")`),await n.run(`CREATE INDEX IF NOT EXISTS idx_invoices_type ON invoices("invoiceType")`),await n.run(`CREATE INDEX IF NOT EXISTS idx_invoices_convertedFromQuotationId ON invoices("convertedFromQuotationId")`),await n.run(`CREATE INDEX IF NOT EXISTS idx_invoices_invoiceNumber ON invoices("invoiceNumber")`),await n.run(`CREATE INDEX IF NOT EXISTS idx_invoices_status ON invoices("status")`),await n.run(`CREATE INDEX IF NOT EXISTS idx_invoices_issuedAt ON invoices("issuedAt")`),await n.run(`CREATE INDEX IF NOT EXISTS idx_invoices_styleProfilesId ON invoices("styleProfilesId")`),await n.run(`DROP TABLE IF EXISTS invoice_payments_new;`),await n.run(`CREATE TABLE IF NOT EXISTS invoice_payments_new (
          "id" ${t.t(`INTEGER PRIMARY KEY AUTOINCREMENT`,n.type)},
          "parentInvoiceId" INTEGER NOT NULL,
          "amountCents" TEXT NOT NULL,
          "paidAt" ${t.t(`DATETIME`,n.type)} NOT NULL DEFAULT ${t.n(`(datetime('now'))`,n.type)},
          "paymentMethod" TEXT NOT NULL,
          "notes" TEXT,
          "createdAt" ${t.t(`DATETIME`,n.type)} NOT NULL DEFAULT ${t.n(`(datetime('now'))`,n.type)},
          "updatedAt" ${t.t(`DATETIME`,n.type)} NOT NULL DEFAULT ${t.n(`(datetime('now'))`,n.type)},
          FOREIGN KEY ("parentInvoiceId") REFERENCES invoices(id) ON DELETE CASCADE
        );`),await n.run(`INSERT INTO invoice_payments_new (
          "id",
          "parentInvoiceId",
          "amountCents",
          "paidAt",
          "paymentMethod",
          "notes",
          "createdAt",
          "updatedAt"
        )
        SELECT
          ip."id",
          ip."parentInvoiceId",
          ip."amountCents",
          ip."paidAt",
          ip."paymentMethod",
          ip."notes",
          ip."createdAt",
          ip."updatedAt"
        FROM invoice_payments as ip;
        );`),await n.run(`DROP TABLE invoice_payments;`),await n.run(`ALTER TABLE invoice_payments_new RENAME TO invoice_payments;`),await n.run(`CREATE INDEX IF NOT EXISTS idx_invoice_payments_invoiceId ON invoice_payments("parentInvoiceId")`),await n.run(`DROP TABLE IF EXISTS invoice_item_snapshots_new;`),await n.run(`
          CREATE TABLE IF NOT EXISTS invoice_item_snapshots_new (
            "id" ${t.t(`INTEGER PRIMARY KEY AUTOINCREMENT`,n.type)},
            "parentInvoiceItemId" INTEGER NOT NULL,
            "itemName" TEXT NOT NULL,
            "unitPriceCents" TEXT NOT NULL DEFAULT 0,
            "unitName" TEXT,
            "createdAt" ${t.t(`DATETIME`,n.type)} NOT NULL DEFAULT ${t.n(`(datetime('now'))`,n.type)},
            "updatedAt" ${t.t(`DATETIME`,n.type)} NOT NULL DEFAULT ${t.n(`(datetime('now'))`,n.type)},
            FOREIGN KEY("parentInvoiceItemId") REFERENCES invoice_items("id") ON DELETE CASCADE
          );
        `),await n.run(`
        INSERT INTO invoice_item_snapshots_new (
            "id",
            "parentInvoiceItemId",
            "itemName",
            "unitPriceCents",
            "unitName",
            "createdAt",
            "updatedAt"
        )
        SELECT
            iis."id",
            iis."parentInvoiceItemId",
            iis."itemName",
            iis."unitPriceCents",
            iis."unitName",
            iis."createdAt",
            iis."updatedAt"
        FROM invoice_item_snapshots as iis;
      `),await n.run(`DROP TABLE invoice_item_snapshots;`),await n.run(`ALTER TABLE invoice_item_snapshots_new RENAME TO invoice_item_snapshots;`),await n.run(`CREATE INDEX IF NOT EXISTS idx_invoice_item_snapshots_parentInvoiceItemId ON invoice_item_snapshots("parentInvoiceItemId")`),await n.run(`CREATE INDEX IF NOT EXISTS idx_invoice_item_snapshots_itemName ON invoice_item_snapshots("itemName")`)),n.type===e.n.postgre&&(await n.run(`
        ALTER TABLE invoices
        DROP CONSTRAINT IF EXISTS invoices_check;
      `),await n.run(`
        ALTER TABLE invoices
        ALTER COLUMN "discountAmountCents" TYPE TEXT USING "discountAmountCents"::text;
      `),await n.run(`
        ALTER TABLE invoices
        ALTER COLUMN "shippingFeeCents" TYPE TEXT USING "shippingFeeCents"::text;
      `),await n.run(`
        ALTER TABLE invoice_payments
        ALTER COLUMN "amountCents" TYPE TEXT USING "amountCents"::text;
      `),await n.run(`
        ALTER TABLE invoice_item_snapshots
        ALTER COLUMN "unitPriceCents" TYPE TEXT USING "unitPriceCents"::text;
      `),await n.run(`
        ALTER TABLE invoices
        ADD CONSTRAINT invoices_check
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
        );
      `))}catch(t){return{success:!1,...e.t(t,n.type)}}};exports.up=n;