Object.defineProperty(exports,Symbol.toStringTag,{value:`Module`});const e=require("./errorFunctions-CauxoFNQ.cjs"),t=require("./dbHelper-CkY49b5y.cjs");var n=async n=>{try{if(await t.i(n,`invoice_sequences`))return;await n.run(`
      CREATE TABLE invoice_sequences (
        "id" ${t.t(`INTEGER PRIMARY KEY AUTOINCREMENT`,n.type)},
        "businessId" INTEGER NOT NULL,
        "clientId" INTEGER NOT NULL,
        "nextSequence" BIGINT NOT NULL,
        "createdAt" ${t.t(`DATETIME`,n.type)} NOT NULL DEFAULT ${t.n(`(datetime('now'))`,n.type)},
        "updatedAt" ${t.t(`DATETIME`,n.type)} NOT NULL DEFAULT ${t.n(`(datetime('now'))`,n.type)},
        UNIQUE("businessId","clientId")
      );
      `),await n.run(`
      INSERT INTO invoice_sequences ("businessId", "clientId", "nextSequence")
      SELECT
        "businessId", "clientId",  COALESCE(
          MAX(CAST("invoiceNumber" AS BIGINT)) + 1,
          COUNT(*) + 1,
          1
        )
      FROM invoices
      GROUP BY "businessId", "clientId"
      `)}catch(t){return{success:!1,...e.t(t,n.type)}}};exports.up=n;