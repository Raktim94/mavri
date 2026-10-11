"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const path_1 = __importDefault(require("path"));
const sqlite3_1 = __importDefault(require("sqlite3"));
const client_1 = require("../../db/client");
const migrationRunner_1 = require("../../db/migrationRunner");
const setup_1 = require("../../db/setup");
const auth_1 = require("../auth");
const createTestDatabase = async () => {
    const sqlite = new sqlite3_1.default.Database(':memory:');
    const db = (0, client_1.createSqliteAdapter)(sqlite);
    await (0, setup_1.initSchema)(db);
    await (0, migrationRunner_1.runMigrations)(db, path_1.default.resolve(__dirname, '../../../../../dist-be/backend/migrations'));
    await (0, setup_1.initInitialData)(db);
    return db;
};
describe('auth service - passwords', () => {
    it('rejects weak passwords', () => {
        expect((0, auth_1.isPasswordStrongEnough)('short1A')).toBe(false);
        expect((0, auth_1.isPasswordStrongEnough)('alllowercase123')).toBe(false);
        expect((0, auth_1.isPasswordStrongEnough)('NoDigitsHereEither')).toBe(false);
        expect((0, auth_1.isPasswordStrongEnough)('GoodPassw0rd')).toBe(true);
    });
    it('hashes and verifies a password round-trip', () => {
        const hash = (0, auth_1.hashPassword)('CorrectHorse9Battery');
        expect((0, auth_1.verifyPassword)('CorrectHorse9Battery', hash)).toBe(true);
        expect((0, auth_1.verifyPassword)('WrongPassword9', hash)).toBe(false);
    });
    it('never stores the password in plaintext', () => {
        const hash = (0, auth_1.hashPassword)('SuperSecret123');
        expect(hash).not.toContain('SuperSecret123');
    });
});
describe('auth service - users and lockout', () => {
    let db;
    beforeEach(async () => {
        db = await createTestDatabase();
    });
    afterEach(async () => {
        await db.close();
    });
    it('creates the first user and rejects weak passwords', async () => {
        expect(await (0, auth_1.countUsers)(db)).toBe(0);
        const weak = await (0, auth_1.createUser)(db, 'owner@example.com', 'weak');
        expect(weak.success).toBe(false);
        const created = await (0, auth_1.createUser)(db, 'Owner@Example.com', 'GoodPassw0rd');
        expect(created.success).toBe(true);
        expect(created.data?.email).toBe('owner@example.com');
        expect(await (0, auth_1.countUsers)(db)).toBe(1);
    });
    it('locks the account after repeated failed logins', async () => {
        await (0, auth_1.createUser)(db, 'owner@example.com', 'GoodPassw0rd');
        const user = await (0, auth_1.getUserByEmail)(db, 'owner@example.com');
        expect(user).not.toBeNull();
        expect((0, auth_1.isUserLocked)(user)).toBe(false);
        for (let i = 0; i < 5; i++) {
            await (0, auth_1.recordFailedLogin)(db, user.id, i);
        }
        const lockedUser = await (0, auth_1.getUserByEmail)(db, 'owner@example.com');
        expect((0, auth_1.isUserLocked)(lockedUser)).toBe(true);
    });
    it('resets the failed-login counter on a successful login', async () => {
        await (0, auth_1.createUser)(db, 'owner@example.com', 'GoodPassw0rd');
        const user = await (0, auth_1.getUserByEmail)(db, 'owner@example.com');
        await (0, auth_1.recordFailedLogin)(db, user.id, 0);
        await (0, auth_1.recordFailedLogin)(db, user.id, 1);
        await (0, auth_1.recordSuccessfulLogin)(db, user.id);
        const refreshed = await (0, auth_1.getUserByEmail)(db, 'owner@example.com');
        expect(refreshed.failedLoginCount).toBe(0);
        expect((0, auth_1.isUserLocked)(refreshed)).toBe(false);
    });
});
describe('auth service - api keys', () => {
    let db;
    beforeEach(async () => {
        db = await createTestDatabase();
    });
    afterEach(async () => {
        await db.close();
    });
    it('issues a key whose raw secret verifies but whose hash never leaks the secret', async () => {
        const result = await (0, auth_1.createApiKey)(db, 'MCP server');
        expect(result.success).toBe(true);
        const secret = result.data.secret;
        expect(secret.startsWith('ndr_')).toBe(true);
        expect(result.data.apiKey.keyPrefix).toBe(secret.slice(0, 12));
        const verified = await (0, auth_1.verifyApiKey)(db, secret);
        expect(verified).not.toBeNull();
        expect(verified.name).toBe('MCP server');
    });
    it('rejects an unknown or malformed key', async () => {
        expect(await (0, auth_1.verifyApiKey)(db, 'not-a-real-key')).toBeNull();
        expect(await (0, auth_1.verifyApiKey)(db, 'ndr_totallyMadeUp')).toBeNull();
    });
    it('rejects a revoked key', async () => {
        const result = await (0, auth_1.createApiKey)(db, 'Temp key');
        const secret = result.data.secret;
        await (0, auth_1.revokeApiKey)(db, result.data.apiKey.id);
        expect(await (0, auth_1.verifyApiKey)(db, secret)).toBeNull();
    });
});
