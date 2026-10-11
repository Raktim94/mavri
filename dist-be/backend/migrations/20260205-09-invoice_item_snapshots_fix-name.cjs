Object.defineProperty(exports,Symbol.toStringTag,{value:`Module`});const e=require("./errorFunctions-CauxoFNQ.cjs"),t=require("./dbHelper-CkY49b5y.cjs");var n=async n=>{try{if(await t.i(n,`invoice_item_snapshots`))return;n.type===e.n.sqlite&&(await n.run(`DROP TABLE IF EXISTS invoice_item_snapshots;`),await n.run(`
          CREATE TABLE IF NOT EXISTS invoice_item_snapshots (
            "id" ${t.t(`INTEGER PRIMARY KEY AUTOINCREMENT`,n.type)},
            "parentInvoiceItemId" INTEGER NOT NULL,
            "itemName" TEXT NOT NULL,
            "unitPriceCents" INTEGER NOT NULL DEFAULT 0,
            "unitName" TEXT,
            "createdAt" ${t.t(`DATETIME`,n.type)} NOT NULL DEFAULT ${t.n(`(datetime('now'))`,n.type)},
            "updatedAt" ${t.t(`DATETIME`,n.type)} NOT NULL DEFAULT ${t.n(`(datetime('now'))`,n.type)},
            FOREIGN KEY("parentInvoiceItemId") REFERENCES invoice_items("id") ON DELETE CASCADE
          );
        `),await n.run(`
        INSERT INTO invoice_item_snapshots (
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
        FROM invoice_item_snaphots as iis;
      `),await n.run(`DROP TABLE invoice_item_snaphots;`),await n.run(`CREATE INDEX IF NOT EXISTS idx_invoice_item_snapshots_parentInvoiceItemId ON invoice_item_snapshots("parentInvoiceItemId")`),await n.run(`CREATE INDEX IF NOT EXISTS idx_invoice_item_snapshots_itemName ON invoice_item_snapshots("itemName")`)),n.type===e.n.postgre&&(await n.run(`ALTER TABLE invoice_item_snaphots RENAME TO invoice_item_snapshots;`),await n.run(`ALTER INDEX invoice_item_snaphots_pkey RENAME TO invoice_item_snapshots_pkey;`))}catch(t){return{success:!1,...e.t(t,n.type)}}};exports.up=n;