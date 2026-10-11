Object.defineProperty(exports,Symbol.toStringTag,{value:`Module`});const e=require("./errorFunctions-CauxoFNQ.cjs"),t=require("./dbHelper-CkY49b5y.cjs");var n=async n=>{try{if((await t.r(n,`invoice_client_snapshots`)).find(e=>e.name===`clientVatCode`))return;await n.run(`
        ALTER TABLE clients
        ADD COLUMN "vatCode" TEXT
      `),await n.run(`
        ALTER TABLE businesses
        ADD COLUMN "vatCode" TEXT
      `),await n.run(`
        ALTER TABLE invoice_business_snapshots
        ADD COLUMN "businessVatCode" TEXT
      `),await n.run(`
        ALTER TABLE invoice_client_snapshots
        ADD COLUMN "clientVatCode" TEXT
      `)}catch(t){return{success:!1,...e.t(t,n.type)}}};exports.up=n;