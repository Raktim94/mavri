"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.initAuthController = void 0;
const express_rate_limit_1 = __importDefault(require("express-rate-limit"));
const auth_1 = require("../../shared/services/auth");
const database_1 = require("../database");
const auth_2 = require("../middleware/auth");
const functions_1 = require("../utils/functions");
const loginLimiter = (0, express_rate_limit_1.default)({
    windowMs: 15 * 60 * 1000,
    max: 10,
    standardHeaders: true,
    legacyHeaders: false,
    message: { success: false, message: undefined, key: 'error.rateLimiter' }
});
const setupLimiter = (0, express_rate_limit_1.default)({
    windowMs: 60 * 60 * 1000,
    max: 5,
    standardHeaders: true,
    legacyHeaders: false,
    message: { success: false, message: undefined, key: 'error.rateLimiter' }
});
const initAuthController = (app) => {
    // Only usable while no owner account exists yet — prevents an attacker
    // from calling this after setup to create a second, unauthorized account.
    app.post('/api/auth/setup', functions_1.requireDB, setupLimiter, async (req, res) => {
        const existing = await (0, auth_1.countUsers)(database_1.dbInstance);
        if (existing > 0) {
            res.status(403).json({ success: false, message: undefined, key: 'error.alreadySetUp' });
            return;
        }
        const { email, password } = req.body;
        if (!email || !password) {
            res.status(400).json({ success: false, message: undefined, key: 'error.missingFields' });
            return;
        }
        const result = await (0, auth_1.createUser)(database_1.dbInstance, email, password, 'owner');
        if (!result.success) {
            res.status(400).json(result);
            return;
        }
        req.session.userId = result.data.id;
        res.json(result);
    });
    app.post('/api/auth/login', functions_1.requireDB, loginLimiter, async (req, res) => {
        const { email, password } = req.body;
        if (!email || !password) {
            res.status(400).json({ success: false, message: undefined, key: 'error.missingFields' });
            return;
        }
        const user = await (0, auth_1.getUserByEmail)(database_1.dbInstance, email);
        // Same generic error for "no such user" and "wrong password" so the
        // endpoint can't be used to enumerate which email addresses have accounts.
        const invalidCredentials = () => res.status(401).json({ success: false, message: undefined, key: 'error.invalidCredentials' });
        if (!user)
            return invalidCredentials();
        if ((0, auth_1.isUserLocked)(user)) {
            res.status(423).json({ success: false, message: undefined, key: 'error.accountLocked' });
            return;
        }
        const valid = (0, auth_1.verifyPassword)(password, user.passwordHash);
        if (!valid) {
            await (0, auth_1.recordFailedLogin)(database_1.dbInstance, user.id, user.failedLoginCount);
            return invalidCredentials();
        }
        await (0, auth_1.recordSuccessfulLogin)(database_1.dbInstance, user.id);
        req.session.userId = user.id;
        res.json({ success: true, data: (0, auth_1.toPublicUser)(user) });
    });
    app.post('/api/auth/logout', (req, res) => {
        req.session.destroy(() => {
            res.json({ success: true });
        });
    });
    app.get('/api/auth/me', auth_2.requireAuth, functions_1.requireDB, async (req, res) => {
        if (req.auth?.kind === 'session') {
            const user = await database_1.dbInstance.get(`SELECT * FROM users WHERE "id" = ?`, [req.auth.userId]);
            if (!user) {
                res.status(401).json({ success: false, message: undefined, key: 'error.unauthorized' });
                return;
            }
            res.json({ success: true, data: (0, auth_1.toPublicUser)(user) });
            return;
        }
        res.json({ success: true, data: { apiKey: true, name: req.auth?.name } });
    });
    // API keys are for machine clients (the MCP server, scripts) — creating one
    // requires an already-authenticated human session, not another API key,
    // so a leaked key can't be used to mint further keys for itself.
    app.get('/api/auth/api-keys', auth_2.requireAuth, functions_1.requireDB, async (req, res) => {
        if (req.auth?.kind !== 'session') {
            res.status(403).json({ success: false, message: undefined, key: 'error.forbidden' });
            return;
        }
        const result = await (0, auth_1.listApiKeys)(database_1.dbInstance);
        res.json(result);
    });
    app.post('/api/auth/api-keys', auth_2.requireAuth, functions_1.requireDB, async (req, res) => {
        if (req.auth?.kind !== 'session') {
            res.status(403).json({ success: false, message: undefined, key: 'error.forbidden' });
            return;
        }
        const { name } = req.body;
        const result = await (0, auth_1.createApiKey)(database_1.dbInstance, name ?? '', req.auth.userId);
        res.json(result);
    });
    app.delete('/api/auth/api-keys/:id', auth_2.requireAuth, functions_1.requireDB, async (req, res) => {
        if (req.auth?.kind !== 'session') {
            res.status(403).json({ success: false, message: undefined, key: 'error.forbidden' });
            return;
        }
        const result = await (0, auth_1.revokeApiKey)(database_1.dbInstance, Number(req.params.id));
        res.json(result);
    });
};
exports.initAuthController = initAuthController;
