Object.defineProperty(exports,Symbol.toStringTag,{value:`Module`});const e=require("./errorFunctions-CauxoFNQ.cjs"),t=require("./dbHelper-CkY49b5y.cjs");var n=async n=>{try{if((await t.r(n,`invoice_customizations`)).find(e=>e.name===`showRowNo`))return;await n.run(`
        ALTER TABLE style_profiles
        ADD COLUMN "showQuantity" INTEGER NOT NULL DEFAULT 1 CHECK ("showQuantity" IN (0,1))
      `),await n.run(`
        ALTER TABLE style_profiles
        ADD COLUMN "showUnit" INTEGER NOT NULL DEFAULT 1 CHECK ("showUnit" IN (0,1))
      `),await n.run(`
        ALTER TABLE style_profiles
        ADD COLUMN "showRowNo" INTEGER NOT NULL DEFAULT 1 CHECK ("showRowNo" IN (0,1))
      `),await n.run(`
        ALTER TABLE invoice_customizations
        ADD COLUMN "showQuantity" INTEGER NOT NULL DEFAULT 1 CHECK ("showQuantity" IN (0,1))
      `),await n.run(`
        ALTER TABLE invoice_customizations
        ADD COLUMN "showUnit" INTEGER NOT NULL DEFAULT 1 CHECK ("showUnit" IN (0,1))
      `),await n.run(`
        ALTER TABLE invoice_customizations
        ADD COLUMN "showRowNo" INTEGER NOT NULL DEFAULT 1 CHECK ("showRowNo" IN (0,1))
      `),await n.run(`
        ALTER TABLE invoice_items
        ADD COLUMN "customField" TEXT;
      `)}catch(t){return{success:!1,...e.t(t,n.type)}}};exports.up=n;