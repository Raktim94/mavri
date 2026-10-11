Object.defineProperty(exports,Symbol.toStringTag,{value:`Module`});const e=require("./errorFunctions-CauxoFNQ.cjs"),t=require("./dbHelper-CkY49b5y.cjs");var n=async n=>{try{return await t.i(n,`users`)||await n.run(`CREATE TABLE IF NOT EXISTS users (
          "id" ${t.t(`INTEGER PRIMARY KEY AUTOINCREMENT`,n.type)},
          "email" TEXT NOT NULL UNIQUE,
          "passwordHash" TEXT NOT NULL,
          "role" TEXT NOT NULL DEFAULT 'owner',
          "failedLoginCount" INTEGER NOT NULL DEFAULT 0,
          "lockedUntil" ${t.t(`DATETIME`,n.type)},
          "lastLoginAt" ${t.t(`DATETIME`,n.type)},
          "createdAt" ${t.t(`DATETIME`,n.type)} NOT NULL DEFAULT ${t.n(`(datetime('now'))`,n.type)},
          "updatedAt" ${t.t(`DATETIME`,n.type)} NOT NULL DEFAULT ${t.n(`(datetime('now'))`,n.type)}
        );`),await t.i(n,`api_keys`)||(await n.run(`CREATE TABLE IF NOT EXISTS api_keys (
          "id" ${t.t(`INTEGER PRIMARY KEY AUTOINCREMENT`,n.type)},
          "name" TEXT NOT NULL,
          "keyPrefix" TEXT NOT NULL,
          "keyHash" TEXT NOT NULL UNIQUE,
          "createdByUserId" INTEGER,
          "lastUsedAt" ${t.t(`DATETIME`,n.type)},
          "revokedAt" ${t.t(`DATETIME`,n.type)},
          "createdAt" ${t.t(`DATETIME`,n.type)} NOT NULL DEFAULT ${t.n(`(datetime('now'))`,n.type)},
          FOREIGN KEY("createdByUserId") REFERENCES users("id") ON DELETE SET NULL
        );`),await n.run(`CREATE INDEX IF NOT EXISTS idx_api_keys_revokedAt ON api_keys("revokedAt")`)),await t.i(n,`sessions`)||(await n.run(`CREATE TABLE IF NOT EXISTS sessions (
          "sid" TEXT PRIMARY KEY,
          "data" TEXT NOT NULL,
          "expiresAt" ${t.t(`DATETIME`,n.type)} NOT NULL
        );`),await n.run(`CREATE INDEX IF NOT EXISTS idx_sessions_expiresAt ON sessions("expiresAt")`)),{success:!0}}catch(t){return{success:!1,...e.t(t,n.type)}}};exports.up=n;