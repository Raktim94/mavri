"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getOrCreateSessionSecret = void 0;
const crypto_1 = require("crypto");
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
// A session secret must stay stable across restarts (otherwise every deploy
// logs every user out) but should never be a guessable default baked into
// the image. SESSION_SECRET lets an operator pin one explicitly; otherwise
// we generate one on first boot and persist it next to the database so
// restarts keep working without requiring extra configuration.
const getOrCreateSessionSecret = (dbDir) => {
    if (process.env.SESSION_SECRET && process.env.SESSION_SECRET.length >= 32) {
        return process.env.SESSION_SECRET;
    }
    const secretPath = path_1.default.resolve(dbDir, '.session_secret');
    try {
        if (fs_1.default.existsSync(secretPath)) {
            const existing = fs_1.default.readFileSync(secretPath, 'utf-8').trim();
            if (existing.length >= 32)
                return existing;
        }
    }
    catch {
        // fall through to generating a new one
    }
    const secret = (0, crypto_1.randomBytes)(48).toString('hex');
    try {
        fs_1.default.mkdirSync(dbDir, { recursive: true });
        fs_1.default.writeFileSync(secretPath, secret, { mode: 0o600 });
    }
    catch (error) {
        console.warn('Could not persist session secret; sessions will not survive a restart.', error);
    }
    return secret;
};
exports.getOrCreateSessionSecret = getOrCreateSessionSecret;
