Object.defineProperty(exports,Symbol.toStringTag,{value:`Module`});const e=require("./errorFunctions-CauxoFNQ.cjs"),t=require("./dbHelper-CkY49b5y.cjs");var n=async n=>{try{if((await t.r(n,`settings`)).find(e=>e.name===`ublON`))return;await n.run(`
        ALTER TABLE settings
        ADD COLUMN "ublON" INTEGER NOT NULL DEFAULT 1 CHECK ("ublON" IN (0,1))
      `),await n.run(`
        ALTER TABLE clients
        ADD COLUMN "peppolEndpointId" TEXT
      `),await n.run(`
        ALTER TABLE clients
        ADD COLUMN "countryCode" TEXT
      `),await n.run(`
        ALTER TABLE clients
        ADD COLUMN "peppolEndpointSchemeId" TEXT
      `),await n.run(`
        ALTER TABLE clients
        ADD COLUMN "buyerReference" TEXT
      `),await n.run(`
        ALTER TABLE invoice_client_snapshots
        ADD COLUMN "clientPeppolEndpointId" TEXT
      `),await n.run(`
        ALTER TABLE invoice_client_snapshots
        ADD COLUMN "clientCountryCode" TEXT
      `),await n.run(`
        ALTER TABLE invoice_client_snapshots
        ADD COLUMN "clientPeppolEndpointSchemeId" TEXT
      `),await n.run(`
        ALTER TABLE invoice_client_snapshots
        ADD COLUMN "clientBuyerReference" TEXT
      `),await n.run(`
        ALTER TABLE businesses
        ADD COLUMN "code" TEXT
      `),await n.run(`
        ALTER TABLE businesses
        ADD COLUMN "peppolEndpointId" TEXT
      `),await n.run(`
        ALTER TABLE businesses
        ADD COLUMN "countryCode" TEXT
      `),await n.run(`
        ALTER TABLE businesses
        ADD COLUMN "peppolEndpointSchemeId" TEXT
      `),await n.run(`
        ALTER TABLE invoice_business_snapshots
        ADD COLUMN "businessCode" TEXT
      `),await n.run(`
        ALTER TABLE invoice_business_snapshots
        ADD COLUMN "businessPeppolEndpointId" TEXT
      `),await n.run(`
        ALTER TABLE invoice_business_snapshots
        ADD COLUMN "businessCountryCode" TEXT
      `),await n.run(`
        ALTER TABLE invoice_business_snapshots
        ADD COLUMN "businessPeppolEndpointSchemeId" TEXT
      `)}catch(t){return{success:!1,...e.t(t,n.type)}}};exports.up=n;