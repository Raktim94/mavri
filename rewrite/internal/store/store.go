// Package store defines what the HTTP layer needs from persistence. The SQL
// implementations (SQLite, PostgreSQL) come later; Memory backs the tests and
// keeps the handlers independent of any database driver.
package store

import (
	"context"
	"errors"
	"time"
)

// ErrDuplicate is returned when a unique value (an email) already exists.
var ErrDuplicate = errors.New("store: duplicate")

// User mirrors the users table. Timestamps are ISO-8601 strings, the format
// existing databases already hold.
type User struct {
	ID               int64
	Email            string
	PasswordHash     string
	Role             string
	FailedLoginCount int
	LockedUntil      string
	LastLoginAt      string
	CreatedAt        string
}

// APIKey mirrors the api_keys table.
type APIKey struct {
	ID              int64
	Name            string
	KeyPrefix       string
	KeyHash         string
	CreatedByUserID int64
	LastUsedAt      string
	RevokedAt       string
	CreatedAt       string
}

// Store is the persistence contract for authentication. Lookups that find
// nothing return (nil, nil) rather than an error.
type Store interface {
	CountUsers(ctx context.Context) (int, error)
	UserByEmail(ctx context.Context, email string) (*User, error)
	UserByID(ctx context.Context, id int64) (*User, error)
	CreateUser(ctx context.Context, email, passwordHash, role string) (*User, error)
	RecordLoginFailure(ctx context.Context, id int64, count int, lockedUntil string) error
	RecordLoginSuccess(ctx context.Context, id int64, at string) error

	CreateAPIKey(ctx context.Context, name, prefix, hash string, createdBy int64) (*APIKey, error)
	ListAPIKeys(ctx context.Context) ([]APIKey, error)
	RevokeAPIKey(ctx context.Context, id int64, at string) error
	// ActiveAPIKeyByHash returns the unrevoked key with this hash and stamps
	// its lastUsedAt, or nil when there is none.
	ActiveAPIKeyByHash(ctx context.Context, hash, at string) (*APIKey, error)

	CreateSession(ctx context.Context, sid string, userID int64, expires time.Time) error
	// SessionUser returns the user id for a live session; ok is false for
	// unknown or expired sessions.
	SessionUser(ctx context.Context, sid string, now time.Time) (userID int64, ok bool, err error)
	DeleteSession(ctx context.Context, sid string) error
}
