Object.defineProperty(exports,Symbol.toStringTag,{value:`Module`});const e=require("./errorFunctions-CauxoFNQ.cjs"),t=require("./dbHelper-CkY49b5y.cjs");var n=async n=>{try{if((await t.r(n,`invoices`)).find(e=>e.name===`surchargeName`))return;await n.run(`
        ALTER TABLE invoices
        ADD COLUMN "surchargeName" TEXT
      `),await n.run(`
        ALTER TABLE invoices
        ADD COLUMN "surchargeAmountCents" TEXT NOT NULL DEFAULT '0';
      `),await n.run(`
        ALTER TABLE invoices
        ADD COLUMN "surchargeType" TEXT CHECK("surchargeType" IN ('fixed','percentage') OR "surchargeType" IS NULL)
      `),await n.run(`
        ALTER TABLE invoices
        ADD COLUMN "surchargePercent" REAL NOT NULL DEFAULT 0
      `)}catch(t){return{success:!1,...e.t(t,n.type)}}};exports.up=n;