Object.defineProperty(exports,Symbol.toStringTag,{value:`Module`});const e=require("./errorFunctions-CauxoFNQ.cjs");var t=async t=>{try{await t.run(`
      UPDATE style_profiles
      SET "fontFamily" = 'Roboto'
      WHERE "fontFamily" IS NULL;
    `)}catch(n){return{success:!1,...e.t(n,t.type)}}};exports.up=t;