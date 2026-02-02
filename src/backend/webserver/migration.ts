import path from 'path';
import sqlite3 from 'sqlite3';
import { runMigrations as runMigrationsShared } from '../shared/db/migrationRunner';

const migrationsPath =
  process.env.MIGRATIONS_PATH || path.resolve(process.cwd(), 'src', 'backend', 'shared', 'migrations');

export const runMigrations = async (db: sqlite3.Database) => {
  return runMigrationsShared(db, migrationsPath);
};
