"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.requireAuthOnceConfigured = exports.requireAuth = void 0;
require("express-session");
const auth_1 = require("../../shared/services/auth");
const database_1 = require("../database");
const BEARER_PREFIX = 'Bearer ';
const requireAuth = async (req, res, next) => {
    if (req.session?.userId) {
        req.auth = { kind: 'session', userId: req.session.userId };
        return next();
    }
    const header = req.headers.authorization;
    if (header?.startsWith(BEARER_PREFIX) && database_1.dbInstance) {
        const raw = header.slice(BEARER_PREFIX.length).trim();
        const apiKey = await (0, auth_1.verifyApiKey)(database_1.dbInstance, raw);
        if (apiKey) {
            req.auth = { kind: 'apiKey', apiKeyId: apiKey.id, name: apiKey.name };
            return next();
        }
    }
    res.status(401).json({ success: false, message: undefined, key: 'error.unauthorized' });
};
exports.requireAuth = requireAuth;
// For endpoints that must exist before any account can log in (selecting or
// creating the very first database, on a fresh install). Once an owner
// account has been created, these endpoints require normal auth like
// everything else — otherwise a database switch/create would stay open to
// anyone forever just because the app allows first-run bootstrapping.
const requireAuthOnceConfigured = async (req, res, next) => {
    if (!database_1.dbInstance)
        return next();
    const existingUsers = await (0, auth_1.countUsers)(database_1.dbInstance);
    if (existingUsers === 0)
        return next();
    return (0, exports.requireAuth)(req, res, next);
};
exports.requireAuthOnceConfigured = requireAuthOnceConfigured;
