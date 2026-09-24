import { randomBytes } from 'crypto';
import fs from 'fs';
import path from 'path';

// A session secret must stay stable across restarts (otherwise every deploy
// logs every user out) but should never be a guessable default baked into
// the image. SESSION_SECRET lets an operator pin one explicitly; otherwise
// we generate one on first boot and persist it next to the database so
// restarts keep working without requiring extra configuration.
export const getOrCreateSessionSecret = (dbDir: string): string => {
  if (process.env.SESSION_SECRET && process.env.SESSION_SECRET.length >= 32) {
    return process.env.SESSION_SECRET;
  }

  const secretPath = path.resolve(dbDir, '.session_secret');
  try {
    if (fs.existsSync(secretPath)) {
      const existing = fs.readFileSync(secretPath, 'utf-8').trim();
      if (existing.length >= 32) return existing;
    }
  } catch {
    // fall through to generating a new one
  }

  const secret = randomBytes(48).toString('hex');
  try {
    fs.mkdirSync(dbDir, { recursive: true });
    fs.writeFileSync(secretPath, secret, { mode: 0o600 });
  } catch (error) {
    console.warn('Could not persist session secret; sessions will not survive a restart.', error);
  }
  return secret;
};
