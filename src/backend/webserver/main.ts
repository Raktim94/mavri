import cors from 'cors';
import express, { type Request, type Response } from 'express';
import rateLimit from 'express-rate-limit';
import session from 'express-session';
import helmet from 'helmet';
import { APP_CONFIG } from './config';
import { initControllers } from './controllers';
import { initAuthController } from './controllers/auth';
import { dbDir, initDatabaseController } from './controllers/database';
import { initEcommerceWebhookController } from './controllers/ecommerceWebhooks';
import { dbInstance } from './database';
import { DbSessionStore } from './middleware/dbSessionStore';
import { requireAuth } from './middleware/auth';
import { getOrCreateSessionSecret } from './utils/sessionSecret';

const port = Number(process.env.PORT) || Number(APP_CONFIG.PORT);
const server = process.env.DEV_SERVER_URL || APP_CONFIG.DEV_SERVER_URL;
const feServer = process.env.FE_SERVER_URL || APP_CONFIG.FE_SERVER_URL;
const frontendOrigin = process.env.FRONTEND_ORIGIN || feServer;
const cookieSecure = process.env.COOKIE_SECURE === 'true';
const host = process.env.NODE_ENV === 'docker' ? 'localhost' : server;
const version = APP_CONFIG.VERSION;

const app = express();

// Behind nginx/a reverse proxy, so req.secure and rate-limiting by IP need
// the X-Forwarded-* headers to reflect the real client, not the proxy hop.
app.set('trust proxy', 1);

app.use(
  helmet({
    contentSecurityPolicy: false, // the API serves JSON only; the SPA sets its own CSP
    crossOriginResourcePolicy: { policy: 'same-site' },
    // HSTS only makes sense once TLS is actually terminated somewhere in front of us.
    hsts: cookieSecure ? { maxAge: 15552000, includeSubDomains: true } : false
  })
);

// `verify` stashes the exact raw bytes alongside the parsed body. Needed
// only by the e-commerce webhook route (HMAC signatures are computed over
// raw bytes, not the re-serialized object), but capturing it here for every
// request is cheap and keeps the webhook route from needing its own
// separate body-parser wired in ahead of this one.
app.use(
  express.json({
    limit: '50mb',
    verify: (req, _res, buf) => {
      (req as Request & { rawBody?: Buffer }).rawBody = Buffer.from(buf);
    }
  })
);

app.use(
  cors({
    origin: frontendOrigin,
    credentials: true
  })
);

// Generic ceiling on top of the tighter per-route limiters (login, setup,
// database listing) — this is what stands between the API and naive scripted abuse.
app.use(
  '/api',
  rateLimit({
    windowMs: 60 * 1000,
    max: 300,
    standardHeaders: true,
    legacyHeaders: false,
    message: { success: false, message: undefined, key: 'error.rateLimiter' }
  })
);

app.use(
  session({
    store: new DbSessionStore(() => dbInstance),
    secret: getOrCreateSessionSecret(dbDir),
    name: 'nodedr.sid',
    resave: false,
    saveUninitialized: false,
    cookie: {
      httpOnly: true,
      secure: cookieSecure,
      sameSite: 'lax',
      maxAge: 24 * 60 * 60 * 1000
    }
  })
);

const main = async () => {
  app.get('/api/health', (_req: Request, res: Response) => {
    res.json({ ok: true });
  });
  app.get('/api/version', (_req: Request, res: Response) => {
    res.json({ version: version });
  });

  // Public: bootstrapping the first database/account, and logging in.
  initDatabaseController(app);
  initAuthController(app);
  // Public: e-commerce platforms call this directly, authenticated by their
  // own HMAC signature rather than a session or API key (see controller).
  initEcommerceWebhookController(app);

  // Everything registered from here on requires a valid session or API key.
  app.use('/api', requireAuth);
  initControllers(app);

  app.listen(port, server, () => {
    console.log(`Server listening at http://${host}:${port}`);
  });
};

main().catch(err => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
