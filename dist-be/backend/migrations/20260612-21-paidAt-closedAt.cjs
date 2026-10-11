Object.defineProperty(exports,Symbol.toStringTag,{value:`Module`});const e=require("./errorFunctions-CauxoFNQ.cjs"),t=require("./dbHelper-CkY49b5y.cjs");var n=async n=>{try{if((await t.r(n,`invoices`)).find(e=>e.name===`paidAt`))return;await n.run(`
        ALTER TABLE invoices
        ADD COLUMN "paidAt" ${t.t(`DATETIME`,n.type)}
      `),await n.run(`
        ALTER TABLE invoices
        ADD COLUMN "closedAt" ${t.t(`DATETIME`,n.type)}
      `)}catch(t){return{success:!1,...e.t(t,n.type)}}};exports.up=n;