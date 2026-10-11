Object.defineProperty(exports,Symbol.toStringTag,{value:`Module`});const e=require("./errorFunctions-CauxoFNQ.cjs"),t=require("./dbHelper-CkY49b5y.cjs");var n=async n=>{try{if((await t.r(n,`invoice_customizations`)).find(e=>e.name===`fontFamily`))return;await n.run(`
        ALTER TABLE style_profiles
        ADD COLUMN "fontFamily" TEXT
      `),await n.run(`
        ALTER TABLE invoice_customizations
        ADD COLUMN "fontFamily" TEXT NOT NULL DEFAULT 'Roboto'
      `)}catch(t){return{success:!1,...e.t(t,n.type)}}};exports.up=n;