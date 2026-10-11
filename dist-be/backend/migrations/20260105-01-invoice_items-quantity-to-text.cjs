Object.defineProperty(exports,Symbol.toStringTag,{value:`Module`});const e=require("./errorFunctions-CauxoFNQ.cjs"),t=require("./dbHelper-CkY49b5y.cjs");var n=async n=>{try{let r=(await t.r(n,`invoice_items`)).find(e=>e.name===`quantity`);if(r){let e=String(r.type).toUpperCase();if(e===`TEXT`||e===`CHARACTER VARYING`||e===`VARCHAR`)return}n.type===e.n.sqlite&&(await n.run(`DROP TABLE IF EXISTS invoice_items_new;`),await n.run(`
      CREATE TABLE invoice_items_new (
        "id" ${t.t(`INTEGER PRIMARY KEY AUTOINCREMENT`,n.type)},
        "parentInvoiceId" INTEGER NOT NULL,
        "itemId" INTEGER NOT NULL,
        "itemNameSnapshot" TEXT NOT NULL,
        "unitPriceCentsSnapshot" INTEGER NOT NULL DEFAULT 0,
        "unitNameSnapshot" TEXT,
        "quantity" TEXT NOT NULL DEFAULT '0',
        "taxRate" REAL NOT NULL DEFAULT 0,
        "taxType" TEXT CHECK("taxType" IN ('exclusive','inclusive') OR "taxType" IS NULL),
        "createdAt" ${t.t(`DATETIME`,n.type)} NOT NULL DEFAULT ${t.n(`(datetime('now'))`,n.type)},
        "updatedAt" ${t.t(`DATETIME`,n.type)} NOT NULL DEFAULT ${t.n(`(datetime('now'))`,n.type)},
        FOREIGN KEY ("parentInvoiceId") REFERENCES invoices("id") ON DELETE CASCADE,
        FOREIGN KEY ("itemId") REFERENCES items("id")
      );
    `),await n.run(`
      INSERT INTO invoice_items_new (
        "id", "parentInvoiceId", "itemId", "itemNameSnapshot", "unitPriceCentsSnapshot", 
        "unitNameSnapshot", "quantity", "taxRate", "taxType", "createdAt", "updatedAt"
      )
      SELECT
        ii."id", ii."parentInvoiceId", ii."itemId", ii."itemNameSnapshot", ii."unitPriceCentsSnapshot",
        ii."unitNameSnapshot", CAST(ii."quantity" AS TEXT), ii."taxRate", ii."taxType", ii."createdAt", ii."updatedAt"
      FROM invoice_items as ii;
    `),await n.run(`DROP TABLE invoice_items;`),await n.run(`ALTER TABLE invoice_items_new RENAME TO invoice_items;`),await n.run(`CREATE INDEX IF NOT EXISTS idx_invoice_items_invoiceId ON invoice_items("parentInvoiceId")`),await n.run(`CREATE INDEX IF NOT EXISTS idx_invoice_items_itemId ON invoice_items("itemId")`)),n.type===e.n.postgre&&await n.run(`
        ALTER TABLE invoice_items
        ALTER COLUMN "quantity" TYPE TEXT USING "quantity"::text;
      `)}catch(t){return{success:!1,...e.t(t,n.type)}}};exports.up=n;