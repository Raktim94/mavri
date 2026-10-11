"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const cors_1 = __importDefault(require("cors"));
const express_1 = __importDefault(require("express"));
const express_rate_limit_1 = __importDefault(require("express-rate-limit"));
const express_session_1 = __importDefault(require("express-session"));
const helmet_1 = __importDefault(require("helmet"));
const config_1 = require("./config");
const controllers_1 = require("./controllers");
const auth_1 = require("./controllers/auth");
const database_1 = require("./controllers/database");
const database_2 = require("./database");
const dbSessionStore_1 = require("./middleware/dbSessionStore");
const auth_2 = require("./middleware/auth");
const sessionSecret_1 = require("./utils/sessionSecret");
const port = Number(process.env.PORT) || Number(config_1.APP_CONFIG.PORT);
const server = process.env.DEV_SERVER_URL || config_1.APP_CONFIG.DEV_SERVER_URL;
const feServer = process.env.FE_SERVER_URL || config_1.APP_CONFIG.FE_SERVER_URL;
const frontendOrigin = process.env.FRONTEND_ORIGIN || feServer;
const cookieSecure = process.env.COOKIE_SECURE === 'true';
const host = process.env.NODE_ENV === 'docker' ? 'localhost' : server;
const version = config_1.APP_CONFIG.VERSION;
const app = (0, express_1.default)();
// Behind nginx/a reverse proxy, so req.secure and rate-limiting by IP need
// the X-Forwarded-* headers to reflect the real client, not the proxy hop.
app.set('trust proxy', 1);
app.use((0, helmet_1.default)({
    contentSecurityPolicy: false, // the API serves JSON only; the SPA sets its own CSP
    crossOriginResourcePolicy: { policy: 'same-site' },
    // HSTS only makes sense once TLS is actually terminated somewhere in front of us.
    hsts: cookieSecure ? { maxAge: 15552000, includeSubDomains: true } : false
}));
app.use(express_1.default.json({ limit: '50mb' }));
app.use((0, cors_1.default)({
    origin: frontendOrigin,
    credentials: true
}));
// Generic ceiling on top of the tighter per-route limiters (login, setup,
// database listing) — this is what stands between the API and naive scripted abuse.
app.use('/api', (0, express_rate_limit_1.default)({
    windowMs: 60 * 1000,
    max: 300,
    standardHeaders: true,
    legacyHeaders: false,
    message: { success: false, message: undefined, key: 'error.rateLimiter' }
}));
app.use((0, express_session_1.default)({
    store: new dbSessionStore_1.DbSessionStore(() => database_2.dbInstance),
    secret: (0, sessionSecret_1.getOrCreateSessionSecret)(database_1.dbDir),
    name: 'nodedr.sid',
    resave: false,
    saveUninitialized: false,
    cookie: {
        httpOnly: true,
        secure: cookieSecure,
        sameSite: 'lax',
        maxAge: 24 * 60 * 60 * 1000
    }
}));
const main = async () => {
    app.get('/api/health', (_req, res) => {
        res.json({ ok: true });
    });
    app.get('/api/version', (_req, res) => {
        res.json({ version: version });
    });
    // Public: bootstrapping the first database/account, and logging in.
    (0, database_1.initDatabaseController)(app);
    (0, auth_1.initAuthController)(app);
    // Everything registered from here on requires a valid session or API key.
    app.use('/api', auth_2.requireAuth);
    (0, controllers_1.initControllers)(app);
    app.listen(port, server, () => {
        console.log(`Server listening at http://${host}:${port}`);
    });
};
main().catch(err => {
    console.error('Failed to start server:', err);
    process.exit(1);
});
