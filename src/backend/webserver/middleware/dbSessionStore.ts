import { Store, type SessionData } from 'express-session';
import type { DatabaseAdapter } from '../../shared/types/DatabaseAdapter';

const DEFAULT_TTL_MS = 24 * 60 * 60 * 1000;

// express-session's MemoryStore leaks memory and loses every logged-in user
// on restart — unacceptable once this server can be reached from the
// internet. Sessions live in the same SQLite/Postgres database as everything
// else, so no extra infra (Redis, etc.) is required for a self-hosted app.
// The active database can change at runtime (multi-database / multi-tenant
// self-hosted mode switches the SQLite file via /api/databases), so the
// store looks up the current adapter on every call rather than capturing
// one at construction time.
export class DbSessionStore extends Store {
  private readonly getDb: () => DatabaseAdapter | null;

  constructor(getDb: () => DatabaseAdapter | null) {
    super();
    this.getDb = getDb;
  }

  get = (sid: string, callback: (err: unknown, session?: SessionData | null) => void): void => {
    const db = this.getDb();
    if (!db) return callback(null, null);

    void db
      .get<{ data: string; expiresAt: string }>(`SELECT * FROM sessions WHERE "sid" = ?`, [sid])
      .then(row => {
        if (!row) return callback(null, null);
        if (new Date(row.expiresAt).getTime() < Date.now()) {
          void this.destroy(sid, () => {});
          return callback(null, null);
        }
        try {
          callback(null, JSON.parse(row.data) as SessionData);
        } catch {
          callback(null, null);
        }
      })
      .catch(callback);
  };

  set = (sid: string, session: SessionData, callback?: (err?: unknown) => void): void => {
    const db = this.getDb();
    if (!db) return callback?.();

    const maxAge = session.cookie?.maxAge ?? DEFAULT_TTL_MS;
    const expiresAt = new Date(Date.now() + maxAge).toISOString();
    const data = JSON.stringify(session);

    void db
      .run(`DELETE FROM sessions WHERE "sid" = ?`, [sid])
      .then(() => db.run(`INSERT INTO sessions ("sid", "data", "expiresAt") VALUES (?, ?, ?)`, [sid, data, expiresAt]))
      .then(() => callback?.())
      .catch(err => callback?.(err));
  };

  destroy = (sid: string, callback?: (err?: unknown) => void): void => {
    const db = this.getDb();
    if (!db) return callback?.();

    void db
      .run(`DELETE FROM sessions WHERE "sid" = ?`, [sid])
      .then(() => callback?.())
      .catch(err => callback?.(err));
  };

  touch = (sid: string, session: SessionData, callback?: (err?: unknown) => void): void => {
    const db = this.getDb();
    if (!db) return callback?.();

    const maxAge = session.cookie?.maxAge ?? DEFAULT_TTL_MS;
    const expiresAt = new Date(Date.now() + maxAge).toISOString();
    void db
      .run(`UPDATE sessions SET "expiresAt" = ? WHERE "sid" = ?`, [expiresAt, sid])
      .then(() => callback?.())
      .catch(err => callback?.(err));
  };
}
