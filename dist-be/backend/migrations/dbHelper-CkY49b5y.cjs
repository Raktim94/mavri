const e=require("./errorFunctions-CauxoFNQ.cjs");var t=(t,n)=>{if(n===e.n.postgre)switch(t){case`DATETIME`:return`TIMESTAMP`;case`INTEGER PRIMARY KEY AUTOINCREMENT`:return`INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY`;case`BLOB`:return`BYTEA`;default:return t}return t},n=(t,n)=>{if(n===e.n.postgre)switch(t){case`datetime('now', '-30 days')`:return`NOW() - INTERVAL '30 days'`;case`datetime('now', '-60 days')`:return`NOW() - INTERVAL '60 days'`;case`datetime('now', '-90 days')`:return`NOW() - INTERVAL '90 days'`;case`date('now','start of month','+2 months','-1 day')`:return`DATE_TRUNC('month', NOW()) + INTERVAL '2 month' - INTERVAL '1 day'`;case`(datetime('now'))`:return`NOW()`;case`datetime('now')`:return`NOW()`;default:return t}return t},r=async(t,n)=>t.type===e.n.sqlite?!!await t.get(`
      SELECT name
      FROM sqlite_master
      WHERE type = 'table'
        AND name = ?
      `,[n]):t.type===e.n.postgre&&!!await t.get(`
      SELECT table_name
      FROM information_schema.tables
      WHERE table_schema = 'public'
        AND table_name = ?
      `,[n]),i=async(t,n)=>t.type===e.n.sqlite?await t.all(`
      SELECT *
      FROM pragma_table_info('${n}')
    `):t.type===e.n.postgre?await t.all(`SELECT column_name AS name, 
      data_type AS type
      FROM information_schema.columns WHERE table_name = ?`,[n]):[];Object.defineProperty(exports,"i",{enumerable:!0,get:function(){return r}}),Object.defineProperty(exports,"n",{enumerable:!0,get:function(){return n}}),Object.defineProperty(exports,"r",{enumerable:!0,get:function(){return i}}),Object.defineProperty(exports,"t",{enumerable:!0,get:function(){return t}});