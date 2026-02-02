import fs from 'fs';
import path from 'path';
import type { Database } from 'sqlite3';
import { getFirstRow, runAsync } from '../utils/dbFuntions';
import { mapSqliteError } from '../utils/errorFunctions';

export const runMigrations = async (db: Database, migrationsPath: string) => {
  try {
    const files = fs
      .readdirSync(migrationsPath)
      .filter(f => /^\d{8}-\d{2}-.*\.(cjs|js|ts)$/.test(f))
      .sort();

    await runAsync(
      db,
      `
    CREATE TABLE IF NOT EXISTS migrations (
      name TEXT PRIMARY KEY,
      appliedAt DATETIME NOT NULL DEFAULT (datetime('now'))
    );
  `
    );

    for (const file of files) {
      const name = path.basename(file);

      const row = await getFirstRow(db, `SELECT 1 FROM migrations WHERE name = ?`, [name]);

      if (!row) {
        const migrationPath = path.resolve(migrationsPath, file);
        // eslint-disable-next-line @typescript-eslint/no-require-imports
        const migration = require(migrationPath);
        if (typeof migration.up !== 'function') {
          throw new Error(`Migration ${file} does not export up()`);
        }
        if (migration.up) {
          await migration.up(db);
          await runAsync(db, `INSERT INTO migrations(name) VALUES('${name}')`);
        }
      }
    }
  } catch (error) {
    console.log(error);
    await runAsync(db, 'ROLLBACK;');
    return { success: false, ...mapSqliteError(error) };
  }
};
