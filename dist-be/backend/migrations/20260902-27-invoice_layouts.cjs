Object.defineProperty(exports,Symbol.toStringTag,{value:`Module`});const e=require("./errorFunctions-CauxoFNQ.cjs"),t=require("./dbHelper-CkY49b5y.cjs");var n=async n=>{try{if(await t.i(n,`layouts`))return;await n.run(`CREATE TABLE IF NOT EXISTS layouts (
      "id" ${t.t(`INTEGER PRIMARY KEY AUTOINCREMENT`,n.type)},
      "schema" TEXT NOT NULL,  
      "isArchived" INTEGER NOT NULL DEFAULT 0 CHECK ("isArchived" IN (0,1)),
      "createdAt" ${t.t(`DATETIME`,n.type)} NOT NULL DEFAULT ${t.n(`(datetime('now'))`,n.type)},
      "updatedAt" ${t.t(`DATETIME`,n.type)} NOT NULL DEFAULT ${t.n(`(datetime('now'))`,n.type)}
    )`),await n.run(`CREATE TABLE IF NOT EXISTS invoice_layout_snapshots (
      "id" ${t.t(`INTEGER PRIMARY KEY AUTOINCREMENT`,n.type)},
      "parentInvoiceId" INTEGER NOT NULL,
      "layoutSchema" TEXT NOT NULL, 
      "createdAt" ${t.t(`DATETIME`,n.type)} NOT NULL DEFAULT ${t.n(`(datetime('now'))`,n.type)},
      "updatedAt" ${t.t(`DATETIME`,n.type)} NOT NULL DEFAULT ${t.n(`(datetime('now'))`,n.type)},
      UNIQUE("parentInvoiceId"),
      FOREIGN KEY("parentInvoiceId") REFERENCES invoices("id") ON DELETE CASCADE
    )`),await n.run(`CREATE INDEX IF NOT EXISTS idx_layouts_id ON layouts("id")`),await n.run(`CREATE INDEX IF NOT EXISTS idx_invoice_layout_snapshots_parentInvoiceId ON invoice_layout_snapshots("parentInvoiceId")`),await n.run(`ALTER TABLE invoices ADD COLUMN "layoutId" INTEGER REFERENCES layouts("id")`),await n.run(`CREATE INDEX IF NOT EXISTS idx_invoices_layoutId ON invoices("layoutId")`)}catch(t){return{success:!1,...e.t(t,n.type)}}};exports.up=n;