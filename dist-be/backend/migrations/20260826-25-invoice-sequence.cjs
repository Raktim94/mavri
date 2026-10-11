Object.defineProperty(exports,Symbol.toStringTag,{value:`Module`});const e=require("./errorFunctions-CauxoFNQ.cjs"),t=require("./dbHelper-CkY49b5y.cjs");var n=async n=>{try{if(n.type===e.n.postgre){await n.run(`ALTER TABLE invoice_sequences
         ADD COLUMN "invoiceType" TEXT NOT NULL DEFAULT 'invoice'
         CHECK("invoiceType" IN ('quotation','invoice'))`),await n.run(`ALTER TABLE invoice_sequences DROP CONSTRAINT IF EXISTS "invoice_sequences_businessId_clientId_key"`),await n.run(`ALTER TABLE invoice_sequences
         ADD CONSTRAINT invoice_sequences_business_client_type_unique
         UNIQUE ("businessId", "clientId", "invoiceType")`);return}await n.run(`DROP TABLE IF EXISTS invoice_sequences_new;`),await n.run(`
      CREATE TABLE invoice_sequences_new (
        "id" ${t.t(`INTEGER PRIMARY KEY AUTOINCREMENT`,n.type)},
        "businessId" INTEGER NOT NULL,
        "clientId" INTEGER NOT NULL,
        "nextSequence" BIGINT NOT NULL,
        "invoiceType" TEXT NOT NULL CHECK("invoiceType" IN ('quotation','invoice')),
        "createdAt" ${t.t(`DATETIME`,n.type)} NOT NULL DEFAULT ${t.n(`(datetime('now'))`,n.type)},
        "updatedAt" ${t.t(`DATETIME`,n.type)} NOT NULL DEFAULT ${t.n(`(datetime('now'))`,n.type)},
        UNIQUE("businessId","clientId","invoiceType")
      );
      `),await n.run(`
      INSERT INTO invoice_sequences_new ("id", "businessId", "clientId", "nextSequence", "invoiceType", "createdAt", "updatedAt")
      SELECT
        "id", "businessId", "clientId", "nextSequence", 'invoice', "createdAt", "updatedAt"
      FROM invoice_sequences
      `),await n.run(`DROP TABLE invoice_sequences;`),await n.run(`ALTER TABLE invoice_sequences_new RENAME TO invoice_sequences;`)}catch(t){return{success:!1,...e.t(t,n.type)}}};exports.up=n;