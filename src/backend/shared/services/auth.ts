import { randomBytes, randomUUID, scryptSync, timingSafeEqual } from 'crypto';
import type { DatabaseAdapter } from '../types/DatabaseAdapter';
import type { ApiKey, PublicApiKey, PublicUser, User } from '../types/auth';
import type { Response } from '../types/response';
import { mapDatabaseError } from '../utils/errorFunctions';

const SCRYPT_N = 16384;
const SCRYPT_R = 8;
const SCRYPT_P = 1;
const SCRYPT_KEYLEN = 64;

const MAX_FAILED_ATTEMPTS = 5;
const LOCKOUT_MINUTES = 15;

export const hashPassword = (password: string): string => {
  const salt = randomBytes(16).toString('hex');
  const hash = scryptSync(password, salt, SCRYPT_KEYLEN, { N: SCRYPT_N, r: SCRYPT_R, p: SCRYPT_P }).toString('hex');
  return `scrypt:${SCRYPT_N}:${SCRYPT_R}:${SCRYPT_P}:${salt}:${hash}`;
};

export const verifyPassword = (password: string, stored: string): boolean => {
  const parts = stored.split(':');
  if (parts.length !== 6 || parts[0] !== 'scrypt') return false;
  const [, nStr, rStr, pStr, salt, hashHex] = parts;
  const n = Number(nStr);
  const r = Number(rStr);
  const p = Number(pStr);
  const expected = Buffer.from(hashHex, 'hex');
  const actual = scryptSync(password, salt, expected.length, { N: n, r, p });
  if (actual.length !== expected.length) return false;
  return timingSafeEqual(actual, expected);
};

// Passwords must be reasonably strong: this app protects real financial
// records, so weak/short passwords are rejected outright rather than warned about.
export const isPasswordStrongEnough = (password: string): boolean =>
  typeof password === 'string' &&
  password.length >= 10 &&
  /[a-z]/.test(password) &&
  /[A-Z]/.test(password) &&
  /[0-9]/.test(password);

export const toPublicUser = (user: User): PublicUser => ({
  id: user.id,
  email: user.email,
  role: user.role,
  lastLoginAt: user.lastLoginAt,
  createdAt: user.createdAt
});

export const countUsers = async (db: DatabaseAdapter): Promise<number> => {
  const row = await db.get<{ count: number }>(`SELECT COUNT(*) as count FROM users`);
  return Number(row?.count ?? 0);
};

export const getUserByEmail = async (db: DatabaseAdapter, email: string): Promise<User | null> => {
  return db.get<User>(`SELECT * FROM users WHERE "email" = ?`, [email.trim().toLowerCase()]);
};

export const getUserById = async (db: DatabaseAdapter, id: number): Promise<User | null> => {
  return db.get<User>(`SELECT * FROM users WHERE "id" = ?`, [id]);
};

export const createUser = async (
  db: DatabaseAdapter,
  email: string,
  password: string,
  role = 'owner'
): Promise<Response<PublicUser>> => {
  try {
    const normalizedEmail = email.trim().toLowerCase();
    if (!normalizedEmail || !normalizedEmail.includes('@')) {
      return { success: false, key: 'error.invalidEmail' };
    }
    if (!isPasswordStrongEnough(password)) {
      return { success: false, key: 'error.weakPassword' };
    }

    const passwordHash = hashPassword(password);
    const id = await db.run(
      `INSERT INTO users ("email", "passwordHash", "role") VALUES (?, ?, ?)`,
      [normalizedEmail, passwordHash, role],
      true
    );
    const user = await getUserById(db, id);
    if (!user) return { success: false, key: 'error.unknownError' };
    return { success: true, data: toPublicUser(user) };
  } catch (error) {
    return { success: false, ...mapDatabaseError(error, db.type) };
  }
};

export const isUserLocked = (user: User): boolean => {
  if (!user.lockedUntil) return false;
  return new Date(user.lockedUntil).getTime() > Date.now();
};

export const recordFailedLogin = async (db: DatabaseAdapter, userId: number, currentCount: number): Promise<void> => {
  const nextCount = currentCount + 1;
  if (nextCount >= MAX_FAILED_ATTEMPTS) {
    const lockedUntil = new Date(Date.now() + LOCKOUT_MINUTES * 60 * 1000).toISOString();
    await db.run(`UPDATE users SET "failedLoginCount" = ?, "lockedUntil" = ? WHERE "id" = ?`, [
      nextCount,
      lockedUntil,
      userId
    ]);
    return;
  }
  await db.run(`UPDATE users SET "failedLoginCount" = ? WHERE "id" = ?`, [nextCount, userId]);
};

export const recordSuccessfulLogin = async (db: DatabaseAdapter, userId: number): Promise<void> => {
  await db.run(`UPDATE users SET "failedLoginCount" = 0, "lockedUntil" = NULL, "lastLoginAt" = ? WHERE "id" = ?`, [
    new Date().toISOString(),
    userId
  ]);
};

// --- API keys ---------------------------------------------------------

const API_KEY_PREFIX = 'ndr_';

export const generateApiKeySecret = (): { raw: string; prefix: string } => {
  const raw = `${API_KEY_PREFIX}${randomBytes(32).toString('base64url')}`;
  return { raw, prefix: raw.slice(0, 12) };
};

export const hashApiKeySecret = (raw: string): string => {
  // API keys are already high-entropy random tokens (not user-chosen
  // passwords), so a fast keyed hash is appropriate here — scrypt's
  // deliberate slowness is unnecessary and would just add latency to
  // every authenticated MCP/API request.
  return scryptSync(raw, 'nodedr-invoice-api-key', 32).toString('hex');
};

export const toPublicApiKey = (key: ApiKey): PublicApiKey => ({
  id: key.id,
  name: key.name,
  keyPrefix: key.keyPrefix,
  lastUsedAt: key.lastUsedAt,
  revokedAt: key.revokedAt,
  createdAt: key.createdAt
});

export const createApiKey = async (
  db: DatabaseAdapter,
  name: string,
  createdByUserId?: number
): Promise<Response<{ apiKey: PublicApiKey; secret: string }>> => {
  try {
    const trimmedName = name.trim() || `key-${randomUUID().slice(0, 8)}`;
    const { raw, prefix } = generateApiKeySecret();
    const keyHash = hashApiKeySecret(raw);

    const id = await db.run(
      `INSERT INTO api_keys ("name", "keyPrefix", "keyHash", "createdByUserId") VALUES (?, ?, ?, ?)`,
      [trimmedName, prefix, keyHash, createdByUserId ?? null],
      true
    );
    const row = await db.get<ApiKey>(`SELECT * FROM api_keys WHERE "id" = ?`, [id]);
    if (!row) return { success: false, key: 'error.unknownError' };
    return { success: true, data: { apiKey: toPublicApiKey(row), secret: raw } };
  } catch (error) {
    return { success: false, ...mapDatabaseError(error, db.type) };
  }
};

export const listApiKeys = async (db: DatabaseAdapter): Promise<Response<PublicApiKey[]>> => {
  try {
    const rows = await db.all<ApiKey>(`SELECT * FROM api_keys ORDER BY "createdAt" DESC`);
    return { success: true, data: rows.map(toPublicApiKey) };
  } catch (error) {
    return { success: false, ...mapDatabaseError(error, db.type) };
  }
};

export const revokeApiKey = async (db: DatabaseAdapter, id: number): Promise<Response<undefined>> => {
  try {
    await db.run(`UPDATE api_keys SET "revokedAt" = ? WHERE "id" = ? AND "revokedAt" IS NULL`, [
      new Date().toISOString(),
      id
    ]);
    return { success: true };
  } catch (error) {
    return { success: false, ...mapDatabaseError(error, db.type) };
  }
};

export const verifyApiKey = async (db: DatabaseAdapter, raw: string): Promise<ApiKey | null> => {
  if (!raw || !raw.startsWith(API_KEY_PREFIX)) return null;
  const keyHash = hashApiKeySecret(raw);
  const row = await db.get<ApiKey>(`SELECT * FROM api_keys WHERE "keyHash" = ?`, [keyHash]);
  if (!row) return null;
  if (row.revokedAt) return null;
  await db.run(`UPDATE api_keys SET "lastUsedAt" = ? WHERE "id" = ?`, [new Date().toISOString(), row.id]);
  return row;
};
