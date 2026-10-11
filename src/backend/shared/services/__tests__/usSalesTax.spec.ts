import path from 'path';
import sqlite3 from 'sqlite3';
import { createSqliteAdapter } from '../../db/client';
import { runMigrations } from '../../db/migrationRunner';
import { initInitialData, initSchema } from '../../db/setup';
import type { Client } from '../../types/client';
import type { DatabaseAdapter } from '../../types/DatabaseAdapter';
import { addClient } from '../clients';
import { getAllUsSalesTaxRates, getUsSalesTaxRateByState } from '../usSalesTax';

const createTestDatabase = async (): Promise<DatabaseAdapter> => {
  const sqlite = new sqlite3.Database(':memory:');
  const db = createSqliteAdapter(sqlite);
  await initSchema(db);
  await runMigrations(db, path.resolve(__dirname, '../../../../../dist-be/backend/migrations'));
  await initInitialData(db);
  return db;
};

describe('usSalesTax service', () => {
  let db: DatabaseAdapter;

  beforeAll(async () => {
    db = await createTestDatabase();
  });

  afterAll(async () => {
    await db.close();
  });

  it('seeds all 50 states plus DC with a base sales tax rate', async () => {
    const result = await getAllUsSalesTaxRates(db);
    expect(result.success).toBe(true);
    expect(result.data).toHaveLength(51);
  });

  it('returns the correct rate for a known state', async () => {
    const result = await getUsSalesTaxRateByState(db, 'ca');
    expect(result.success).toBe(true);
    expect(result.data?.stateName).toBe('California');
    expect(result.data?.rate).toBeCloseTo(7.25);
  });

  it('returns null for an unknown state code', async () => {
    const result = await getUsSalesTaxRateByState(db, 'ZZ');
    expect(result.success).toBe(true);
    expect(result.data).toBeNull();
  });

  it('defaults new clients to not tax-exempt when the field is omitted', async () => {
    const result = await addClient(db, {
      name: 'Acme Inc',
      shortName: 'AC',
      isArchived: false
    } as Client);
    expect(result.success).toBe(true);
    expect(result.data?.taxExempt).toBe(false);
  });

  it('persists a tax-exempt client with its certificate number', async () => {
    const result = await addClient(db, {
      name: 'Nonprofit Co',
      shortName: 'NP',
      isArchived: false,
      taxExempt: true,
      taxExemptionCertificate: 'CERT-12345'
    } as Client);
    expect(result.success).toBe(true);
    expect(result.data?.taxExempt).toBe(true);
    expect(result.data?.taxExemptionCertificate).toBe('CERT-12345');
  });
});
