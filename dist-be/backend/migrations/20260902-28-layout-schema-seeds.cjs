Object.defineProperty(exports,Symbol.toStringTag,{value:`Module`});const e=require("./errorFunctions-CauxoFNQ.cjs");var t=e=>JSON.stringify({schemaVersion:1,meta:{name:e}}),n=e=>e.startsWith(`Legacy`)?`Pre-created legacy layout preserved for existing documents that use business payment information. Do not use for new invoices or quotes.`:`Pre-created layout using bank payment information for new invoices and quotes.`,r=e=>{let t={type:`title`},n={type:`logo`},r={type:`businessInfo`},i={type:`clientInfo`},a=(e={})=>({type:`invoiceMeta`,...e}),o={type:`paymentInfo`,paymentSource:`legacyBusiness`,width:`60%`},s=(e,t={})=>({type:`row`,children:e,align:`start`,justify:`between`,...t});switch(e){case`Modern`:return[s([t,n],{paddingBottom:20}),s([r,a({boxed:!0,showInvoiceLabel:!0})]),s([i],{paddingTop:20})];case`Compact`:return[{type:`column`,children:[t],align:`center`,paddingBottom:20},s([{type:`column`,children:[r],width:`40%`},{type:`column`,children:[i],width:`40%`},{type:`column`,children:[a({showInvoiceLabel:!0})],width:`20%`}],{gap:10})];case`Legacy Classic`:return[s([{type:`column`,width:`50%`,children:[s([n,r],{gap:5})]},{type:`column`,width:`50%`,children:[a({showTitle:!0})]}]),s([{type:`column`,width:`50%`,children:[i]},{type:`column`,width:`50%`,align:`end`,children:[o]}],{paddingTop:20})];case`Legacy Modern`:return[s([t,n],{paddingBottom:20}),s([{type:`column`,width:`50%`,children:[r]},{type:`column`,width:`50%`,children:[a({showInvoiceLabel:!0,boxed:!0})]}]),s([{type:`column`,width:`50%`,children:[i]},{type:`column`,width:`50%`,align:`end`,children:[o]}],{paddingTop:20})];case`Legacy Compact`:return[{type:`column`,children:[t],align:`center`,paddingBottom:20},s([{type:`column`,children:[r],width:`40%`},{type:`column`,children:[i],width:`40%`},{type:`column`,children:[a({showInvoiceLabel:!0})],width:`20%`}],{gap:10})];case`Classic`:return[s([{type:`column`,width:`50%`,children:[s([n,r],{gap:5})]},{type:`column`,width:`50%`,children:[a({showTitle:!0})]}]),s([i],{paddingTop:20})];default:return[s([s([n,r]),a({showTitle:!0})]),s([i],{paddingTop:20})]}},i=(e,t=!1)=>{let i={type:`totalsRow`,visible:!0,totalsBlocks:[{type:`paymentInfo`,paymentSource:`legacyBusiness`},{type:`spacer`},{type:`financialTotals`}]},a=[{type:`watermark`,visible:`auto`,watermarkOrder:`paidFirst`},{type:`header`,visible:!0,blocks:r(e)},{type:`itemsTable`,visible:!0,...e.startsWith(`Legacy`)?{columnSizing:`proportional`}:{}},...e===`Legacy Compact`?[i]:[{type:`financialTotals`,visible:!0},...t?[{type:`paymentInfo`,visible:`auto`}]:[]],{type:`notes`,visible:`auto`},{type:`signature`,visible:`auto`},{type:`pageCounter`,visible:!0}];return JSON.stringify({schemaVersion:1,meta:{name:e,description:n(e)},sections:a})},a=async(e,t,n,r)=>{r&&await e.run(`UPDATE layouts SET "schema" = ?, "isArchived" = ? WHERE "schema" = ?`,[t,n,r]),await e.run(`INSERT INTO layouts ("schema", "isArchived") SELECT ?, ? WHERE NOT EXISTS (SELECT 1 FROM layouts WHERE "schema" = ?)`,[t,n,t]),await e.run(`UPDATE layouts SET "isArchived" = ? WHERE "schema" = ?`,[n,t])},o=async n=>{try{let e=i(`Classic`),r=i(`Classic`,!0),o=i(`Legacy Classic`,!1);await a(n,r,!1,t(`Classic`)),await a(n,r,!1,e),await a(n,o,!0,t(`Legacy Classic`));let s=i(`Modern`),c=i(`Modern`,!0),l=i(`Legacy Modern`,!1);await a(n,c,!1,t(`Modern`)),await a(n,c,!1,s),await a(n,l,!0,t(`Legacy Modern`));let u=i(`Compact`),d=i(`Legacy Compact`,!1);await a(n,u,!1,t(`Compact`)),await a(n,d,!0,t(`Legacy Compact`)),await n.run(`
      UPDATE invoices
      SET "layoutId" = (
        SELECT "id"
        FROM layouts
        WHERE "schema" = CASE COALESCE(
          (SELECT "layout" FROM invoice_customizations WHERE "parentInvoiceId" = invoices."id"),
          'classic'
        )
          WHEN 'modern' THEN CASE
            WHEN NOT EXISTS (
              SELECT 1 FROM invoice_bank_snapshots WHERE "parentInvoiceId" = invoices."id"
            ) AND EXISTS (
              SELECT 1
              FROM invoice_business_snapshots
              WHERE "parentInvoiceId" = invoices."id"
                AND COALESCE("businessPaymentInformation", '') <> ''
            ) THEN ?
            ELSE ?
          END
          WHEN 'compact' THEN CASE
            WHEN NOT EXISTS (
              SELECT 1 FROM invoice_bank_snapshots WHERE "parentInvoiceId" = invoices."id"
            ) AND EXISTS (
              SELECT 1
              FROM invoice_business_snapshots
              WHERE "parentInvoiceId" = invoices."id"
                AND COALESCE("businessPaymentInformation", '') <> ''
            ) THEN ?
            ELSE ?
          END
          ELSE CASE
            WHEN NOT EXISTS (
              SELECT 1 FROM invoice_bank_snapshots WHERE "parentInvoiceId" = invoices."id"
            ) AND EXISTS (
              SELECT 1
              FROM invoice_business_snapshots
              WHERE "parentInvoiceId" = invoices."id"
                AND COALESCE("businessPaymentInformation", '') <> ''
            ) THEN ?
            ELSE ?
          END
        END
      )
      WHERE "layoutId" IS NULL
    `,[l,c,d,u,o,r]),await n.run(`
      INSERT INTO invoice_layout_snapshots ("parentInvoiceId", "layoutSchema")
      SELECT invoices."id", layouts."schema"
      FROM invoices
      INNER JOIN layouts ON layouts."id" = invoices."layoutId"
      WHERE NOT EXISTS (
        SELECT 1
        FROM invoice_layout_snapshots
        WHERE "parentInvoiceId" = invoices."id"
      )
    `)}catch(t){return{success:!1,...e.t(t,n.type)}}};exports.up=o;