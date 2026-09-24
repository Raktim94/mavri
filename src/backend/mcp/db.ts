import path from 'path';
import { openPostgreSql, openSqlLite } from '../shared/db/setup';
import { DatabaseType } from '../shared/enums/databaseType';
import { isTableExists } from '../shared/utils/dbHelper';
import type { DatabaseAdapter } from '../shared/types/DatabaseAdapter';

// The MCP server always attaches to an existing, already-migrated database —
// it never creates, wipes or migrates one itself. That's deliberate, not
// just a shortcut: openSqlLite's createIfMissing path deletes the file
// first (correct for the app's "start a fresh database" flow, catastrophic
// here), and the migration runner loads migration files via require(),
// which isn't available in this process's ESM/tsx runtime. Migrations are
// the main app's (Electron or the webserver's) responsibility; open the
// database there at least once before pointing the MCP server at it.
export const connectDb = async (): Promise<DatabaseAdapter> => {
  const dbType = (process.env.DB_TYPE || DatabaseType.sqlite) as DatabaseType;

  const db =
    dbType === DatabaseType.postgre
      ? (
          await openPostgreSql({
            host: process.env.PGHOST || 'localhost',
            port: Number(process.env.PGPORT || 5432),
            user: process.env.PGUSER || 'postgres',
            password: process.env.PGPASSWORD || '',
            database: process.env.PGDATABASE || 'nodedr_invoice',
            ssl: process.env.PGSSL === 'true'
          })
        ).db
      : await (async () => {
          const dbDirectory = process.env.DB_DIRECTORY || 'data';
          const dbFile = process.env.DB_FILE;
          if (!dbFile) {
            throw new Error(
              'DB_FILE is required for the MCP server (e.g. DB_FILE=mydata.db) — it must name an existing database file already created and opened via the app.'
            );
          }
          const fullPath = path.resolve(process.cwd(), dbDirectory, dbFile);
          const { db: sqliteDb } = await openSqlLite({ fullPath, createIfMissing: false });
          return sqliteDb;
        })();

  const migrated = (await isTableExists(db, 'users')) && (await isTableExists(db, 'us_sales_tax_rates'));
  if (!migrated) {
    throw new Error(
      'This database has not been migrated to the version the MCP server expects. Open it in NodeDR Invoice (desktop app or the web UI) once first — that runs pending migrations automatically — then retry.'
    );
  }

  return db;
};
