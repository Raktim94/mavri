Object.defineProperty(exports,Symbol.toStringTag,{value:`Module`});const e=require("./errorFunctions-CauxoFNQ.cjs"),t=require("./dbHelper-CkY49b5y.cjs");var n=async n=>{try{if((await t.r(n,`banks`)).find(e=>e.name===`accountHolder`))return;await n.run(`
        ALTER TABLE banks
        ADD COLUMN "accountHolder" TEXT
      `),await n.run(`
        ALTER TABLE banks
        ADD COLUMN "sortOrder" TEXT 
      `),await n.run(`
        ALTER TABLE invoice_bank_snapshots
        ADD COLUMN "accountHolder" TEXT
      `),await n.run(`
        ALTER TABLE invoice_bank_snapshots
        ADD COLUMN "sortOrder" TEXT 
      `)}catch(t){return{success:!1,...e.t(t,n.type)}}};exports.up=n;