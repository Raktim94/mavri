import type { SqliteError } from '../../shared/types/sqliteError';

export const sqliteErrorMap: Record<string, string> = {
  'UNIQUE constraint failed': 'error.invalidConstraintUnique',
  'FOREIGN KEY constraint failed': 'error.invalidConstraintForeign',
  'CHECK constraint failed': 'error.invalidConstraintCheck',
  'NOT NULL constraint failed': 'error.invalidConstraintNotNull',
  SQLITE_ERROR: 'error.sqlSyntaxError',
  'datatype mismatch': 'error.datatypeMismatch',
  SQLITE_IOERR: 'error.diskIOError',
  'database is locked': 'error.databaseLocked',
  'file is not a database': 'error.databaseCorrupt'
};

export const isSqliteError = (error: unknown): error is SqliteError => {
  return error instanceof Error && 'code' in error && typeof (error as Record<string, unknown>).code === 'string';
};

export const mapSqliteError = (error: unknown): { message?: string; key?: string } => {
  if (isSqliteError(error)) {
    for (const [key, mapped] of Object.entries(sqliteErrorMap)) {
      if (error.message.includes(key)) return { key: mapped };
    }
    return { message: error.message };
  }
  if (error instanceof Error) {
    const msg = error.message;
    if (msg.includes('Database file does not exist')) return { key: 'error.databaseFileMissing' };
    if (msg.includes('EBUSY')) return { key: 'error.databaseIsBusy' };
    return { key: 'error.unknownError', message: msg };
  }

  return { key: 'error.unknownError', message: String(error) };
};
