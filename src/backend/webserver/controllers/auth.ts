import { type Express, type Request, type Response } from 'express';
import rateLimit from 'express-rate-limit';
import {
  countUsers,
  createApiKey,
  createUser,
  getUserByEmail,
  isUserLocked,
  listApiKeys,
  recordFailedLogin,
  recordSuccessfulLogin,
  revokeApiKey,
  toPublicUser,
  verifyPassword
} from '../../shared/services/auth';
import { dbInstance } from '../database';
import { requireAuth } from '../middleware/auth';
import { requireDB } from '../utils/functions';

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: undefined, key: 'error.rateLimiter' }
});

const setupLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: undefined, key: 'error.rateLimiter' }
});

export const initAuthController = (app: Express) => {
  // Public: lets the web UI decide whether to show the "create the owner
  // account" screen or the login screen, without leaking anything else.
  app.get('/api/auth/status', requireDB, async (_req: Request, res: Response) => {
    const existing = await countUsers(dbInstance!);
    res.json({ success: true, data: { needsSetup: existing === 0 } });
  });

  // Only usable while no owner account exists yet — prevents an attacker
  // from calling this after setup to create a second, unauthorized account.
  app.post('/api/auth/setup', requireDB, setupLimiter, async (req: Request, res: Response) => {
    const existing = await countUsers(dbInstance!);
    if (existing > 0) {
      res.status(403).json({ success: false, message: undefined, key: 'error.alreadySetUp' });
      return;
    }

    const { email, password } = req.body as { email?: string; password?: string };
    if (!email || !password) {
      res.status(400).json({ success: false, message: undefined, key: 'error.missingFields' });
      return;
    }

    const result = await createUser(dbInstance!, email, password, 'owner');
    if (!result.success) {
      res.status(400).json(result);
      return;
    }

    req.session.userId = result.data!.id;
    res.json(result);
  });

  app.post('/api/auth/login', requireDB, loginLimiter, async (req: Request, res: Response) => {
    const { email, password } = req.body as { email?: string; password?: string };
    if (!email || !password) {
      res.status(400).json({ success: false, message: undefined, key: 'error.missingFields' });
      return;
    }

    const user = await getUserByEmail(dbInstance!, email);
    // Same generic error for "no such user" and "wrong password" so the
    // endpoint can't be used to enumerate which email addresses have accounts.
    const invalidCredentials = () =>
      res.status(401).json({ success: false, message: undefined, key: 'error.invalidCredentials' });

    if (!user) return invalidCredentials();

    if (isUserLocked(user)) {
      res.status(423).json({ success: false, message: undefined, key: 'error.accountLocked' });
      return;
    }

    const valid = verifyPassword(password, user.passwordHash);
    if (!valid) {
      await recordFailedLogin(dbInstance!, user.id, user.failedLoginCount);
      return invalidCredentials();
    }

    await recordSuccessfulLogin(dbInstance!, user.id);
    req.session.userId = user.id;
    res.json({ success: true, data: toPublicUser(user) });
  });

  app.post('/api/auth/logout', (req: Request, res: Response) => {
    req.session.destroy(() => {
      res.json({ success: true });
    });
  });

  app.get('/api/auth/me', requireAuth, requireDB, async (req: Request, res: Response) => {
    if (req.auth?.kind === 'session') {
      const user = await dbInstance!.get(`SELECT * FROM users WHERE "id" = ?`, [req.auth.userId]);
      if (!user) {
        res.status(401).json({ success: false, message: undefined, key: 'error.unauthorized' });
        return;
      }
      res.json({ success: true, data: toPublicUser(user as never) });
      return;
    }
    res.json({ success: true, data: { apiKey: true, name: req.auth?.name } });
  });

  // API keys are for machine clients (the MCP server, scripts) — creating one
  // requires an already-authenticated human session, not another API key,
  // so a leaked key can't be used to mint further keys for itself.
  app.get('/api/auth/api-keys', requireAuth, requireDB, async (req: Request, res: Response) => {
    if (req.auth?.kind !== 'session') {
      res.status(403).json({ success: false, message: undefined, key: 'error.forbidden' });
      return;
    }
    const result = await listApiKeys(dbInstance!);
    res.json(result);
  });

  app.post('/api/auth/api-keys', requireAuth, requireDB, async (req: Request, res: Response) => {
    if (req.auth?.kind !== 'session') {
      res.status(403).json({ success: false, message: undefined, key: 'error.forbidden' });
      return;
    }
    const { name } = req.body as { name?: string };
    const result = await createApiKey(dbInstance!, name ?? '', req.auth.userId);
    res.json(result);
  });

  app.delete('/api/auth/api-keys/:id', requireAuth, requireDB, async (req: Request, res: Response) => {
    if (req.auth?.kind !== 'session') {
      res.status(403).json({ success: false, message: undefined, key: 'error.forbidden' });
      return;
    }
    const result = await revokeApiKey(dbInstance!, Number(req.params.id));
    res.json(result);
  });
};
