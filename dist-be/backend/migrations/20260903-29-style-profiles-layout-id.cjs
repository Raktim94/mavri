Object.defineProperty(exports,Symbol.toStringTag,{value:`Module`});const e=require("./errorFunctions-CauxoFNQ.cjs"),t=require("./dbHelper-CkY49b5y.cjs");var n=async n=>{try{let e=await t.r(n,`style_profiles`);e.some(e=>e.name===`layoutId`)||(await n.run(`ALTER TABLE style_profiles ADD COLUMN "layoutId" INTEGER REFERENCES layouts("id")`),await n.run(`CREATE INDEX IF NOT EXISTS idx_style_profiles_layoutId ON style_profiles("layoutId")`)),await n.run(`
      UPDATE style_profiles
      SET "layoutId" = (
        SELECT layouts."id"
        FROM layouts
        WHERE layouts."schema" LIKE '%' || '"name":"' || CASE COALESCE(style_profiles."layout", 'classic')
          WHEN 'modern' THEN 'Modern'
          WHEN 'compact' THEN 'Compact'
          ELSE 'Classic'
        END || '"%'
        LIMIT 1
      )
      WHERE "layoutId" IS NULL
    `),e.some(e=>e.name===`layout`)&&await n.run(`ALTER TABLE style_profiles DROP COLUMN "layout"`),await n.run(`ALTER TABLE invoice_customizations DROP COLUMN "layout"`)}catch(t){return{success:!1,...e.t(t,n.type)}}};exports.up=n;