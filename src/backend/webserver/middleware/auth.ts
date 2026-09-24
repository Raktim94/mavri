import type { NextFunction, Request, Response } from 'express';
import 'express-session';
import { countUsers, verifyApiKey } from '../../shared/services/auth';
import { dbInstance } from '../database';

declare module 'express-session' {
  interface SessionData {
    userId?: number;
  }
}

export type AuthPrincipal = { kind: 'session'; userId: number } | { kind: 'apiKey'; apiKeyId: number; name: string };

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      auth?: AuthPrincipal;
    }
  }
}

const BEARER_PREFIX = 'Bearer ';

export const requireAuth = async (req: Request, res: Response, next: NextFunction) => {
  if (req.session?.userId) {
    req.auth = { kind: 'session', userId: req.session.userId };
    return next();
  }

  const header = req.headers.authorization;
  if (header?.startsWith(BEARER_PREFIX) && dbInstance) {
    const raw = header.slice(BEARER_PREFIX.length).trim();
    const apiKey = await verifyApiKey(dbInstance, raw);
    if (apiKey) {
      req.auth = { kind: 'apiKey', apiKeyId: apiKey.id, name: apiKey.name };
      return next();
    }
  }

  res.status(401).json({ success: false, message: undefined, key: 'error.unauthorized' });
};

// For endpoints that must exist before any account can log in (selecting or
// creating the very first database, on a fresh install). Once an owner
// account has been created, these endpoints require normal auth like
// everything else — otherwise a database switch/create would stay open to
// anyone forever just because the app allows first-run bootstrapping.
export const requireAuthOnceConfigured = async (req: Request, res: Response, next: NextFunction) => {
  if (!dbInstance) return next();

  const existingUsers = await countUsers(dbInstance);
  if (existingUsers === 0) return next();

  return requireAuth(req, res, next);
};
