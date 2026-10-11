"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.verifyApiKey = exports.revokeApiKey = exports.listApiKeys = exports.createApiKey = exports.toPublicApiKey = exports.hashApiKeySecret = exports.generateApiKeySecret = exports.recordSuccessfulLogin = exports.recordFailedLogin = exports.isUserLocked = exports.createUser = exports.getUserById = exports.getUserByEmail = exports.countUsers = exports.toPublicUser = exports.isPasswordStrongEnough = exports.verifyPassword = exports.hashPassword = void 0;
const crypto_1 = require("crypto");
const errorFunctions_1 = require("../utils/errorFunctions");
const SCRYPT_N = 16384;
const SCRYPT_R = 8;
const SCRYPT_P = 1;
const SCRYPT_KEYLEN = 64;
const MAX_FAILED_ATTEMPTS = 5;
const LOCKOUT_MINUTES = 15;
const hashPassword = (password) => {
    const salt = (0, crypto_1.randomBytes)(16).toString('hex');
    const hash = (0, crypto_1.scryptSync)(password, salt, SCRYPT_KEYLEN, { N: SCRYPT_N, r: SCRYPT_R, p: SCRYPT_P }).toString('hex');
    return `scrypt:${SCRYPT_N}:${SCRYPT_R}:${SCRYPT_P}:${salt}:${hash}`;
};
exports.hashPassword = hashPassword;
const verifyPassword = (password, stored) => {
    const parts = stored.split(':');
    if (parts.length !== 6 || parts[0] !== 'scrypt')
        return false;
    const [, nStr, rStr, pStr, salt, hashHex] = parts;
    const n = Number(nStr);
    const r = Number(rStr);
    const p = Number(pStr);
    const expected = Buffer.from(hashHex, 'hex');
    const actual = (0, crypto_1.scryptSync)(password, salt, expected.length, { N: n, r, p });
    if (actual.length !== expected.length)
        return false;
    return (0, crypto_1.timingSafeEqual)(actual, expected);
};
exports.verifyPassword = verifyPassword;
// Passwords must be reasonably strong: this app protects real financial
// records, so weak/short passwords are rejected outright rather than warned about.
const isPasswordStrongEnough = (password) => typeof password === 'string' &&
    password.length >= 10 &&
    /[a-z]/.test(password) &&
    /[A-Z]/.test(password) &&
    /[0-9]/.test(password);
exports.isPasswordStrongEnough = isPasswordStrongEnough;
const toPublicUser = (user) => ({
    id: user.id,
    email: user.email,
    role: user.role,
    lastLoginAt: user.lastLoginAt,
    createdAt: user.createdAt
});
exports.toPublicUser = toPublicUser;
const countUsers = async (db) => {
    const row = await db.get(`SELECT COUNT(*) as count FROM users`);
    return Number(row?.count ?? 0);
};
exports.countUsers = countUsers;
const getUserByEmail = async (db, email) => {
    return db.get(`SELECT * FROM users WHERE "email" = ?`, [email.trim().toLowerCase()]);
};
exports.getUserByEmail = getUserByEmail;
const getUserById = async (db, id) => {
    return db.get(`SELECT * FROM users WHERE "id" = ?`, [id]);
};
exports.getUserById = getUserById;
const createUser = async (db, email, password, role = 'owner') => {
    try {
        const normalizedEmail = email.trim().toLowerCase();
        if (!normalizedEmail || !normalizedEmail.includes('@')) {
            return { success: false, key: 'error.invalidEmail' };
        }
        if (!(0, exports.isPasswordStrongEnough)(password)) {
            return { success: false, key: 'error.weakPassword' };
        }
        const passwordHash = (0, exports.hashPassword)(password);
        const id = await db.run(`INSERT INTO users ("email", "passwordHash", "role") VALUES (?, ?, ?)`, [normalizedEmail, passwordHash, role], true);
        const user = await (0, exports.getUserById)(db, id);
        if (!user)
            return { success: false, key: 'error.unknownError' };
        return { success: true, data: (0, exports.toPublicUser)(user) };
    }
    catch (error) {
        return { success: false, ...(0, errorFunctions_1.mapDatabaseError)(error, db.type) };
    }
};
exports.createUser = createUser;
const isUserLocked = (user) => {
    if (!user.lockedUntil)
        return false;
    return new Date(user.lockedUntil).getTime() > Date.now();
};
exports.isUserLocked = isUserLocked;
const recordFailedLogin = async (db, userId, currentCount) => {
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
exports.recordFailedLogin = recordFailedLogin;
const recordSuccessfulLogin = async (db, userId) => {
    await db.run(`UPDATE users SET "failedLoginCount" = 0, "lockedUntil" = NULL, "lastLoginAt" = ? WHERE "id" = ?`, [new Date().toISOString(), userId]);
};
exports.recordSuccessfulLogin = recordSuccessfulLogin;
// --- API keys ---------------------------------------------------------
const API_KEY_PREFIX = 'ndr_';
const generateApiKeySecret = () => {
    const raw = `${API_KEY_PREFIX}${(0, crypto_1.randomBytes)(32).toString('base64url')}`;
    return { raw, prefix: raw.slice(0, 12) };
};
exports.generateApiKeySecret = generateApiKeySecret;
const hashApiKeySecret = (raw) => {
    // API keys are already high-entropy random tokens (not user-chosen
    // passwords), so a fast keyed hash is appropriate here — scrypt's
    // deliberate slowness is unnecessary and would just add latency to
    // every authenticated MCP/API request.
    return (0, crypto_1.scryptSync)(raw, 'nodedr-invoice-api-key', 32).toString('hex');
};
exports.hashApiKeySecret = hashApiKeySecret;
const toPublicApiKey = (key) => ({
    id: key.id,
    name: key.name,
    keyPrefix: key.keyPrefix,
    lastUsedAt: key.lastUsedAt,
    revokedAt: key.revokedAt,
    createdAt: key.createdAt
});
exports.toPublicApiKey = toPublicApiKey;
const createApiKey = async (db, name, createdByUserId) => {
    try {
        const trimmedName = name.trim() || `key-${(0, crypto_1.randomUUID)().slice(0, 8)}`;
        const { raw, prefix } = (0, exports.generateApiKeySecret)();
        const keyHash = (0, exports.hashApiKeySecret)(raw);
        const id = await db.run(`INSERT INTO api_keys ("name", "keyPrefix", "keyHash", "createdByUserId") VALUES (?, ?, ?, ?)`, [trimmedName, prefix, keyHash, createdByUserId ?? null], true);
        const row = await db.get(`SELECT * FROM api_keys WHERE "id" = ?`, [id]);
        if (!row)
            return { success: false, key: 'error.unknownError' };
        return { success: true, data: { apiKey: (0, exports.toPublicApiKey)(row), secret: raw } };
    }
    catch (error) {
        return { success: false, ...(0, errorFunctions_1.mapDatabaseError)(error, db.type) };
    }
};
exports.createApiKey = createApiKey;
const listApiKeys = async (db) => {
    try {
        const rows = await db.all(`SELECT * FROM api_keys ORDER BY "createdAt" DESC`);
        return { success: true, data: rows.map(exports.toPublicApiKey) };
    }
    catch (error) {
        return { success: false, ...(0, errorFunctions_1.mapDatabaseError)(error, db.type) };
    }
};
exports.listApiKeys = listApiKeys;
const revokeApiKey = async (db, id) => {
    try {
        await db.run(`UPDATE api_keys SET "revokedAt" = ? WHERE "id" = ? AND "revokedAt" IS NULL`, [
            new Date().toISOString(),
            id
        ]);
        return { success: true };
    }
    catch (error) {
        return { success: false, ...(0, errorFunctions_1.mapDatabaseError)(error, db.type) };
    }
};
exports.revokeApiKey = revokeApiKey;
const verifyApiKey = async (db, raw) => {
    if (!raw || !raw.startsWith(API_KEY_PREFIX))
        return null;
    const keyHash = (0, exports.hashApiKeySecret)(raw);
    const row = await db.get(`SELECT * FROM api_keys WHERE "keyHash" = ?`, [keyHash]);
    if (!row)
        return null;
    if (row.revokedAt)
        return null;
    await db.run(`UPDATE api_keys SET "lastUsedAt" = ? WHERE "id" = ?`, [new Date().toISOString(), row.id]);
    return row;
};
exports.verifyApiKey = verifyApiKey;
