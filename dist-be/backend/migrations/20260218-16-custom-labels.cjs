Object.defineProperty(exports,Symbol.toStringTag,{value:`Module`});const e=require("./errorFunctions-CauxoFNQ.cjs"),t=require("./dbHelper-CkY49b5y.cjs");var n=async n=>{try{if((await t.r(n,`invoice_customizations`)).find(e=>e.name===`pdfTexts`))return;await n.run(`
        ALTER TABLE style_profiles
        ADD COLUMN "pdfTexts" TEXT
      `),await n.run(`
        ALTER TABLE invoice_customizations
        ADD COLUMN "pdfTexts" TEXT 
      `)}catch(t){return{success:!1,...e.t(t,n.type)}}};exports.up=n;