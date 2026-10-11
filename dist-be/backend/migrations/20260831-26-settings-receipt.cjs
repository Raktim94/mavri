Object.defineProperty(exports,Symbol.toStringTag,{value:`Module`});const e=require("./errorFunctions-CauxoFNQ.cjs"),t=require("./dbHelper-CkY49b5y.cjs");var n=async n=>{try{if((await t.r(n,`settings`)).find(e=>e.name===`receiptPrintingOn`))return;await n.run(`
        ALTER TABLE settings
        ADD COLUMN "receiptPrintingOn" INTEGER NOT NULL DEFAULT 1 CHECK ("receiptPrintingOn" IN (0,1))
      `)}catch(t){return{success:!1,...e.t(t,n.type)}}};exports.up=n;