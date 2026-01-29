import type { SqliteValue } from './sqliteValue';

export interface UpdateData {
  [key: string]: SqliteValue;
}
