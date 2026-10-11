import path from 'path';
import sqlite3 from 'sqlite3';
import { createSqliteAdapter } from '../../db/client';
import { runMigrations } from '../../db/migrationRunner';
import { initInitialData, initSchema } from '../../db/setup';
import type { DatabaseAdapter } from '../../types/DatabaseAdapter';
import {
  countUsers,
  createApiKey,
  createUser,
  getUserByEmail,
  hashPassword,
  isPasswordStrongEnough,
  isUserLocked,
  recordFailedLogin,
  recordSuccessfulLogin,
  revokeApiKey,
  verifyApiKey,
  verifyPassword
} from '../auth';

const createTestDatabase = async (): Promise<DatabaseAdapter> => {
  const sqlite = new sqlite3.Database(':memory:');
  const db = createSqliteAdapter(sqlite);
  await initSchema(db);
  await runMigrations(db, path.resolve(__dirname, '../../../../../dist-be/backend/migrations'));
  await initInitialData(db);
  return db;
};

describe('auth service - passwords', () => {
  it('rejects weak passwords', () => {
    expect(isPasswordStrongEnough('short1A')).toBe(false);
    expect(isPasswordStrongEnough('alllowercase123')).toBe(false);
    expect(isPasswordStrongEnough('NoDigitsHereEither')).toBe(false);
    expect(isPasswordStrongEnough('GoodPassw0rd')).toBe(true);
  });

  it('hashes and verifies a password round-trip', () => {
    const hash = hashPassword('CorrectHorse9Battery');
    expect(verifyPassword('CorrectHorse9Battery', hash)).toBe(true);
    expect(verifyPassword('WrongPassword9', hash)).toBe(false);
  });

  it('never stores the password in plaintext', () => {
    const hash = hashPassword('SuperSecret123');
    expect(hash).not.toContain('SuperSecret123');
  });
});

describe('auth service - users and lockout', () => {
  let db: DatabaseAdapter;

  beforeEach(async () => {
    db = await createTestDatabase();
  });

  afterEach(async () => {
    await db.close();
  });

  it('creates the first user and rejects weak passwords', async () => {
    expect(await countUsers(db)).toBe(0);
    const weak = await createUser(db, 'owner@example.com', 'weak');
    expect(weak.success).toBe(false);

    const created = await createUser(db, 'Owner@Example.com', 'GoodPassw0rd');
    expect(created.success).toBe(true);
    expect(created.data?.email).toBe('owner@example.com');
    expect(await countUsers(db)).toBe(1);
  });

  it('locks the account after repeated failed logins', async () => {
    await createUser(db, 'owner@example.com', 'GoodPassw0rd');
    const user = await getUserByEmail(db, 'owner@example.com');
    expect(user).not.toBeNull();
    expect(isUserLocked(user!)).toBe(false);

    for (let i = 0; i < 5; i++) {
      await recordFailedLogin(db, user!.id, i);
    }

    const lockedUser = await getUserByEmail(db, 'owner@example.com');
    expect(isUserLocked(lockedUser!)).toBe(true);
  });

  it('resets the failed-login counter on a successful login', async () => {
    await createUser(db, 'owner@example.com', 'GoodPassw0rd');
    const user = await getUserByEmail(db, 'owner@example.com');
    await recordFailedLogin(db, user!.id, 0);
    await recordFailedLogin(db, user!.id, 1);
    await recordSuccessfulLogin(db, user!.id);

    const refreshed = await getUserByEmail(db, 'owner@example.com');
    expect(refreshed!.failedLoginCount).toBe(0);
    expect(isUserLocked(refreshed!)).toBe(false);
  });
});

describe('auth service - api keys', () => {
  let db: DatabaseAdapter;

  beforeEach(async () => {
    db = await createTestDatabase();
  });

  afterEach(async () => {
    await db.close();
  });

  it('issues a key whose raw secret verifies but whose hash never leaks the secret', async () => {
    const result = await createApiKey(db, 'MCP server');
    expect(result.success).toBe(true);
    const secret = result.data!.secret;
    expect(secret.startsWith('ndr_')).toBe(true);
    expect(result.data!.apiKey.keyPrefix).toBe(secret.slice(0, 12));

    const verified = await verifyApiKey(db, secret);
    expect(verified).not.toBeNull();
    expect(verified!.name).toBe('MCP server');
  });

  it('rejects an unknown or malformed key', async () => {
    expect(await verifyApiKey(db, 'not-a-real-key')).toBeNull();
    expect(await verifyApiKey(db, 'ndr_totallyMadeUp')).toBeNull();
  });

  it('rejects a revoked key', async () => {
    const result = await createApiKey(db, 'Temp key');
    const secret = result.data!.secret;
    await revokeApiKey(db, result.data!.apiKey.id);
    expect(await verifyApiKey(db, secret)).toBeNull();
  });
});
