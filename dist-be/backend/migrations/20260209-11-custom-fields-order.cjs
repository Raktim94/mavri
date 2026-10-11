Object.defineProperty(exports,Symbol.toStringTag,{value:`Module`});const e=require("./errorFunctions-CauxoFNQ.cjs"),t=require("./dbHelper-CkY49b5y.cjs");var n=async n=>{try{return(await t.r(n,`style_profiles`)).find(e=>e.name===`fieldSortOrders`)?void 0:(n.type===e.n.sqlite&&await n.run(`      
        UPDATE invoice_items
        SET "customField" = json_set("customField", '$.sortOrder', 0)
        WHERE json_extract("customField", '$.sortOrder') IS NULL;
      `),n.type===e.n.postgre&&await n.run(`
        UPDATE invoice_items
        SET "customField" = (
          "customField"::jsonb || '{"sortOrder":0}'
        )::text
        WHERE jsonb_exists("customField"::jsonb, 'sortOrder') = false;
      `),await n.run(`
        ALTER TABLE style_profiles
        ADD COLUMN "fieldSortOrders" TEXT NOT NULL DEFAULT '{"no":0,"item":1,"unit":2,"quantity":3,"unitCost":4,"total":5}';
      `),await n.run(`
        ALTER TABLE invoice_customizations
        ADD COLUMN "fieldSortOrders" TEXT NOT NULL DEFAULT '{"no":0,"item":1,"unit":2,"quantity":3,"unitCost":4,"total":5}';
      `),{success:!0})}catch(t){return{success:!1,...e.t(t,n.type)}}};exports.up=n;