Object.defineProperty(exports,Symbol.toStringTag,{value:`Module`});const e=require("./errorFunctions-CauxoFNQ.cjs"),t=require("./dbHelper-CkY49b5y.cjs");var n=async n=>{try{if((await t.r(n,`settings`)).find(e=>e.name===`presetsON`))return;await n.run(`
        ALTER TABLE settings
        ADD COLUMN "presetsON" INTEGER NOT NULL DEFAULT 1 CHECK ("presetsON" IN (0,1))
      `),await n.run(`CREATE TABLE IF NOT EXISTS presets (
        "id" ${t.t(`INTEGER PRIMARY KEY AUTOINCREMENT`,n.type)},
        "name" TEXT NOT NULL UNIQUE,
        "businessId" INTEGER,
        "clientId" INTEGER,
        "currencyId" INTEGER,
        "bankId" INTEGER,
        "customerNotes" TEXT,
        "thanksNotes" TEXT,
        "termsConditionNotes" TEXT,
        "language" TEXT,
        "signatureData" ${t.t(`BLOB`,n.type)},
        "signatureName" TEXT,
        "signatureType" TEXT,
        "signatureSize" INTEGER,
        "styleProfilesId" INTEGER,
        "isArchived" INTEGER NOT NULL DEFAULT 0 CHECK ("isArchived" IN (0,1)),
        "createdAt" ${t.t(`DATETIME`,n.type)} NOT NULL DEFAULT ${t.n(`(datetime('now'))`,n.type)},
        "updatedAt" ${t.t(`DATETIME`,n.type)} NOT NULL DEFAULT ${t.n(`(datetime('now'))`,n.type)},
        FOREIGN KEY("styleProfilesId") REFERENCES style_profiles("id") ON DELETE CASCADE,
        FOREIGN KEY("businessId") REFERENCES businesses("id") ON DELETE CASCADE,
        FOREIGN KEY("clientId") REFERENCES clients("id") ON DELETE CASCADE,
        FOREIGN KEY("currencyId") REFERENCES currencies("id") ON DELETE CASCADE,
        FOREIGN KEY ("bankId") REFERENCES banks("id") ON DELETE CASCADE
      );`)}catch(t){return{success:!1,...e.t(t,n.type)}}};exports.up=n;