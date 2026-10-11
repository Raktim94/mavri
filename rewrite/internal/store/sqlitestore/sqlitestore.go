// Package sqlitestore is the SQLite implementation of store.Store. It uses
// the same tables as the TypeScript backend, so an existing database file can
// be opened as is, and the TypeScript migrations still recognise the tables.
package sqlitestore

import (
	"context"
	"database/sql"
	"errors"
	"fmt"
	"net/url"
	"strings"
	"time"

	_ "modernc.org/sqlite" // pure-Go driver, registers "sqlite"

	"github.com/Raktim94/nodedr-invoice/rewrite/internal/schema"
	"github.com/Raktim94/nodedr-invoice/rewrite/internal/store"
)

// Store is a SQLite-backed store.Store.
type Store struct{ db *sql.DB }

var _ store.Store = (*Store)(nil)

// Open opens (creating if needed) the database file at path and makes sure
// the schema exists (see package schema). Use ":memory:" for a throwaway database.
func Open(path string) (*Store, error) {
	q := url.Values{}
	for _, p := range []string{"foreign_keys(1)", "busy_timeout(5000)", "journal_mode(WAL)"} {
		q.Add("_pragma", p)
	}
	db, err := sql.Open("sqlite", "file:"+path+"?"+q.Encode())
	if err != nil {
		return nil, err
	}
	// One connection: SQLite allows a single writer anyway, and it keeps
	// ":memory:" databases from splitting into one per connection.
	db.SetMaxOpenConns(1)
	if err := schema.Apply(db); err != nil {
		db.Close()
		return nil, err
	}
	return &Store{db: db}, nil
}

// DB exposes the connection pool to the resource layer.
func (s *Store) DB() *sql.DB { return s.db }

// Close releases the database.
func (s *Store) Close() error { return s.db.Close() }

func isUnique(err error) bool {
	return err != nil && strings.Contains(err.Error(), "UNIQUE constraint failed")
}

const userCols = `"id","email","passwordHash","role","failedLoginCount",COALESCE(CAST("lockedUntil" AS TEXT),''),COALESCE(CAST("lastLoginAt" AS TEXT),''),CAST("createdAt" AS TEXT)`

func scanUser(row *sql.Row) (*store.User, error) {
	var u store.User
	err := row.Scan(&u.ID, &u.Email, &u.PasswordHash, &u.Role, &u.FailedLoginCount, &u.LockedUntil, &u.LastLoginAt, &u.CreatedAt)
	if errors.Is(err, sql.ErrNoRows) {
		return nil, nil
	}
	if err != nil {
		return nil, err
	}
	return &u, nil
}

func (s *Store) CountUsers(ctx context.Context) (int, error) {
	var n int
	err := s.db.QueryRowContext(ctx, `SELECT COUNT(*) FROM users`).Scan(&n)
	return n, err
}

func (s *Store) UserByEmail(ctx context.Context, email string) (*store.User, error) {
	return scanUser(s.db.QueryRowContext(ctx, `SELECT `+userCols+` FROM users WHERE "email" = ?`,
		strings.ToLower(strings.TrimSpace(email))))
}

func (s *Store) UserByID(ctx context.Context, id int64) (*store.User, error) {
	return scanUser(s.db.QueryRowContext(ctx, `SELECT `+userCols+` FROM users WHERE "id" = ?`, id))
}

func (s *Store) CreateUser(ctx context.Context, email, hash, role string) (*store.User, error) {
	res, err := s.db.ExecContext(ctx, `INSERT INTO users ("email","passwordHash","role") VALUES (?,?,?)`, email, hash, role)
	if isUnique(err) {
		return nil, store.ErrDuplicate
	}
	if err != nil {
		return nil, err
	}
	id, err := res.LastInsertId()
	if err != nil {
		return nil, err
	}
	return s.UserByID(ctx, id)
}

func (s *Store) RecordLoginFailure(ctx context.Context, id int64, count int, lockedUntil string) error {
	if lockedUntil == "" {
		_, err := s.db.ExecContext(ctx, `UPDATE users SET "failedLoginCount" = ? WHERE "id" = ?`, count, id)
		return err
	}
	_, err := s.db.ExecContext(ctx, `UPDATE users SET "failedLoginCount" = ?, "lockedUntil" = ? WHERE "id" = ?`, count, lockedUntil, id)
	return err
}

func (s *Store) RecordLoginSuccess(ctx context.Context, id int64, at string) error {
	_, err := s.db.ExecContext(ctx,
		`UPDATE users SET "failedLoginCount" = 0, "lockedUntil" = NULL, "lastLoginAt" = ? WHERE "id" = ?`, at, id)
	return err
}

const keyCols = `"id","name","keyPrefix","keyHash",COALESCE("createdByUserId",0),COALESCE(CAST("lastUsedAt" AS TEXT),''),COALESCE(CAST("revokedAt" AS TEXT),''),CAST("createdAt" AS TEXT)`

type scanner interface{ Scan(...any) error }

func scanKey(r scanner) (store.APIKey, error) {
	var k store.APIKey
	err := r.Scan(&k.ID, &k.Name, &k.KeyPrefix, &k.KeyHash, &k.CreatedByUserID, &k.LastUsedAt, &k.RevokedAt, &k.CreatedAt)
	return k, err
}

func (s *Store) CreateAPIKey(ctx context.Context, name, prefix, hash string, createdBy int64) (*store.APIKey, error) {
	var by any
	if createdBy != 0 {
		by = createdBy
	}
	res, err := s.db.ExecContext(ctx,
		`INSERT INTO api_keys ("name","keyPrefix","keyHash","createdByUserId") VALUES (?,?,?,?)`, name, prefix, hash, by)
	if err != nil {
		return nil, err
	}
	id, err := res.LastInsertId()
	if err != nil {
		return nil, err
	}
	k, err := scanKey(s.db.QueryRowContext(ctx, `SELECT `+keyCols+` FROM api_keys WHERE "id" = ?`, id))
	return &k, err
}

func (s *Store) ListAPIKeys(ctx context.Context) ([]store.APIKey, error) {
	rows, err := s.db.QueryContext(ctx, `SELECT `+keyCols+` FROM api_keys ORDER BY "createdAt" DESC, "id" DESC`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var out []store.APIKey
	for rows.Next() {
		k, err := scanKey(rows)
		if err != nil {
			return nil, err
		}
		out = append(out, k)
	}
	return out, rows.Err()
}

func (s *Store) RevokeAPIKey(ctx context.Context, id int64, at string) error {
	_, err := s.db.ExecContext(ctx, `UPDATE api_keys SET "revokedAt" = ? WHERE "id" = ? AND "revokedAt" IS NULL`, at, id)
	return err
}

func (s *Store) ActiveAPIKeyByHash(ctx context.Context, hash, at string) (*store.APIKey, error) {
	k, err := scanKey(s.db.QueryRowContext(ctx, `SELECT `+keyCols+` FROM api_keys WHERE "keyHash" = ? AND "revokedAt" IS NULL`, hash))
	if errors.Is(err, sql.ErrNoRows) {
		return nil, nil
	}
	if err != nil {
		return nil, err
	}
	if _, err := s.db.ExecContext(ctx, `UPDATE api_keys SET "lastUsedAt" = ? WHERE "id" = ?`, at, k.ID); err != nil {
		return nil, err
	}
	k.LastUsedAt = at
	return &k, nil
}

func stamp(t time.Time) string { return t.UTC().Format("2006-01-02T15:04:05.000Z") }

func (s *Store) CreateSession(ctx context.Context, sid string, userID int64, expires time.Time) error {
	data := fmt.Sprintf(`{"userId":%d}`, userID)
	_, err := s.db.ExecContext(ctx, `INSERT OR REPLACE INTO sessions ("sid","data","expiresAt") VALUES (?,?,?)`, sid, data, stamp(expires))
	return err
}

func (s *Store) SessionUser(ctx context.Context, sid string, now time.Time) (int64, bool, error) {
	var data, exp string
	err := s.db.QueryRowContext(ctx, `SELECT "data","expiresAt" FROM sessions WHERE "sid" = ?`, sid).Scan(&data, &exp)
	if errors.Is(err, sql.ErrNoRows) {
		return 0, false, nil
	}
	if err != nil {
		return 0, false, err
	}
	if exp <= stamp(now) { // fixed-width ISO strings compare chronologically
		_, _ = s.db.ExecContext(ctx, `DELETE FROM sessions WHERE "sid" = ?`, sid)
		return 0, false, nil
	}
	var id int64
	if _, err := fmt.Sscanf(data, `{"userId":%d}`, &id); err != nil || id == 0 {
		return 0, false, nil
	}
	return id, true, nil
}

func (s *Store) DeleteSession(ctx context.Context, sid string) error {
	_, err := s.db.ExecContext(ctx, `DELETE FROM sessions WHERE "sid" = ?`, sid)
	return err
}
