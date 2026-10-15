// Package auth handles the owner account, browser sessions and API keys.
package auth

import (
	"context"
	"crypto/pbkdf2"
	"crypto/rand"
	"crypto/sha256"
	"crypto/subtle"
	"database/sql"
	"encoding/base64"
	"encoding/hex"
	"errors"
	"fmt"
	"strconv"
	"strings"
	"time"
	"unicode"
)

// Errors the HTTP layer maps to status codes.
var (
	ErrInvalidLogin = errors.New("invalid email or password")
	ErrLocked       = errors.New("account temporarily locked")
	ErrWeak         = errors.New("password too weak")
	ErrEmail        = errors.New("invalid email address")
	ErrSetUp        = errors.New("already set up")
	ErrNoSession    = errors.New("no session")
)

const (
	sessionLife  = 14 * 24 * time.Hour
	lockAfter    = 5
	lockDuration = 15 * time.Minute
	keyPrefix    = "mvr_"
)

// Iterations is the PBKDF2 work factor for new hashes; tests lower it.
var Iterations = 600_000

// User is the account holder.
type User struct {
	ID          int64  `json:"id"`
	Email       string `json:"email"`
	Role        string `json:"role"`
	LastLoginAt string `json:"lastLoginAt"`
}

// APIKey is the stored (never secret) part of an API key.
type APIKey struct {
	ID         int64  `json:"id"`
	Label      string `json:"label"`
	Prefix     string `json:"prefix"`
	LastUsedAt string `json:"lastUsedAt"`
	RevokedAt  string `json:"revokedAt"`
	CreatedAt  string `json:"createdAt"`
}

// Service works on the database.
type Service struct {
	DB  *sql.DB
	Now func() time.Time
}

func (s *Service) now() time.Time {
	if s.Now != nil {
		return s.Now().UTC()
	}
	return time.Now().UTC()
}

func stamp(t time.Time) string { return t.UTC().Format(time.RFC3339) }

// HashPassword returns "pbkdf2-sha256$iterations$salt$hash".
func HashPassword(pw string) (string, error) {
	salt := make([]byte, 16)
	if _, err := rand.Read(salt); err != nil {
		return "", err
	}
	key, err := pbkdf2.Key(sha256.New, pw, salt, Iterations, 32)
	if err != nil {
		return "", err
	}
	return fmt.Sprintf("pbkdf2-sha256$%d$%s$%s", Iterations, base64.RawStdEncoding.EncodeToString(salt), base64.RawStdEncoding.EncodeToString(key)), nil
}

// CheckPassword compares in constant time.
func CheckPassword(pw, stored string) bool {
	parts := strings.Split(stored, "$")
	if len(parts) != 4 || parts[0] != "pbkdf2-sha256" {
		return false
	}
	iter, err := strconv.Atoi(parts[1])
	if err != nil || iter < 1 {
		return false
	}
	salt, err1 := base64.RawStdEncoding.DecodeString(parts[2])
	want, err2 := base64.RawStdEncoding.DecodeString(parts[3])
	if err1 != nil || err2 != nil {
		return false
	}
	got, err := pbkdf2.Key(sha256.New, pw, salt, iter, len(want))
	return err == nil && subtle.ConstantTimeCompare(got, want) == 1
}

// StrongEnough wants 8+ characters with at least one letter and one digit.
func StrongEnough(pw string) bool {
	var letter, digit bool
	for _, r := range pw {
		letter = letter || unicode.IsLetter(r)
		digit = digit || unicode.IsDigit(r)
	}
	return len(pw) >= 8 && letter && digit
}

func randomToken(n int) (string, error) {
	b := make([]byte, n)
	if _, err := rand.Read(b); err != nil {
		return "", err
	}
	return base64.RawURLEncoding.EncodeToString(b), nil
}

func digest(token string) string {
	h := sha256.Sum256([]byte(token))
	return hex.EncodeToString(h[:])
}

// NeedsSetup is true until the owner account exists.
func (s *Service) NeedsSetup(ctx context.Context) (bool, error) {
	var n int
	err := s.DB.QueryRowContext(ctx, `SELECT COUNT(*) FROM users`).Scan(&n)
	return n == 0, err
}

// CreateOwner makes the first account. It refuses once any account exists.
func (s *Service) CreateOwner(ctx context.Context, email, password string) (User, error) {
	email = strings.ToLower(strings.TrimSpace(email))
	if !strings.Contains(email, "@") || len(email) < 3 {
		return User{}, ErrEmail
	}
	if !StrongEnough(password) {
		return User{}, ErrWeak
	}
	hash, err := HashPassword(password)
	if err != nil {
		return User{}, err
	}
	// The conditional insert makes "only the first account" atomic.
	res, err := s.DB.ExecContext(ctx, `INSERT INTO users (email, password_hash, role, created_at)
		SELECT ?, ?, 'owner', ? WHERE NOT EXISTS (SELECT 1 FROM users)`, email, hash, stamp(s.now()))
	if err != nil {
		return User{}, err
	}
	if n, _ := res.RowsAffected(); n == 0 {
		return User{}, ErrSetUp
	}
	id, _ := res.LastInsertId()
	return User{ID: id, Email: email, Role: "owner"}, nil
}

// Login checks the password and starts a session, returning the cookie token.
// The previous login time is reported, like a "last seen" line.
func (s *Service) Login(ctx context.Context, email, password string) (User, string, error) {
	email = strings.ToLower(strings.TrimSpace(email))
	var u User
	var hash, locked string
	var fails int
	err := s.DB.QueryRowContext(ctx, `SELECT id, email, role, password_hash, failed_logins, locked_until, last_login_at FROM users WHERE email = ?`, email).
		Scan(&u.ID, &u.Email, &u.Role, &hash, &fails, &locked, &u.LastLoginAt)
	if errors.Is(err, sql.ErrNoRows) {
		// Same work as a real check, so timing does not reveal which emails exist.
		CheckPassword(password, "pbkdf2-sha256$1$AAAAAAAAAAAAAAAAAAAAAA$AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA")
		_, _ = HashPassword(password)
		return User{}, "", ErrInvalidLogin
	}
	if err != nil {
		return User{}, "", err
	}
	now := s.now()
	if locked != "" {
		if t, err := time.Parse(time.RFC3339, locked); err == nil && now.Before(t) {
			return User{}, "", ErrLocked
		}
	}
	if !CheckPassword(password, hash) {
		fails++
		until := ""
		if fails >= lockAfter {
			until, fails = stamp(now.Add(lockDuration)), 0
		}
		if _, err := s.DB.ExecContext(ctx, `UPDATE users SET failed_logins = ?, locked_until = ? WHERE id = ?`, fails, until, u.ID); err != nil {
			return User{}, "", err
		}
		return User{}, "", ErrInvalidLogin
	}
	if _, err := s.DB.ExecContext(ctx, `UPDATE users SET failed_logins = 0, locked_until = '', last_login_at = ? WHERE id = ?`, stamp(now), u.ID); err != nil {
		return User{}, "", err
	}
	token, err := randomToken(32)
	if err != nil {
		return User{}, "", err
	}
	if _, err := s.DB.ExecContext(ctx, `INSERT INTO sessions (token_hash, user_id, created_at, expires_at) VALUES (?, ?, ?, ?)`,
		digest(token), u.ID, stamp(now), stamp(now.Add(sessionLife))); err != nil {
		return User{}, "", err
	}
	_, _ = s.DB.ExecContext(ctx, `DELETE FROM sessions WHERE expires_at < ?`, stamp(now))
	return u, token, nil
}

// UserForSession finds the user a cookie token belongs to.
func (s *Service) UserForSession(ctx context.Context, token string) (User, error) {
	var u User
	var expires string
	err := s.DB.QueryRowContext(ctx, `SELECT u.id, u.email, u.role, u.last_login_at, s.expires_at FROM sessions s JOIN users u ON u.id = s.user_id WHERE s.token_hash = ?`, digest(token)).
		Scan(&u.ID, &u.Email, &u.Role, &u.LastLoginAt, &expires)
	if errors.Is(err, sql.ErrNoRows) {
		return User{}, ErrNoSession
	}
	if err != nil {
		return User{}, err
	}
	if t, err := time.Parse(time.RFC3339, expires); err != nil || !s.now().Before(t) {
		return User{}, ErrNoSession
	}
	return u, nil
}

// Logout ends the session of this cookie token.
func (s *Service) Logout(ctx context.Context, token string) error {
	_, err := s.DB.ExecContext(ctx, `DELETE FROM sessions WHERE token_hash = ?`, digest(token))
	return err
}

// CreateKey makes an API key and returns its secret, which is shown once and never stored.
func (s *Service) CreateKey(ctx context.Context, label string, createdBy int64) (APIKey, string, error) {
	label = strings.TrimSpace(label)
	if label == "" {
		label = "key " + s.now().Format("2006-01-02")
	}
	raw, err := randomToken(32)
	if err != nil {
		return APIKey{}, "", err
	}
	secret := keyPrefix + raw
	k := APIKey{Label: label, Prefix: secret[:len(keyPrefix)+4], CreatedAt: stamp(s.now())}
	var by any
	if createdBy != 0 {
		by = createdBy
	}
	res, err := s.DB.ExecContext(ctx, `INSERT INTO api_keys (label, prefix, secret_hash, created_by, created_at) VALUES (?, ?, ?, ?, ?)`,
		k.Label, k.Prefix, digest(secret), by, k.CreatedAt)
	if err != nil {
		return APIKey{}, "", err
	}
	k.ID, _ = res.LastInsertId()
	return k, secret, nil
}

// ListKeys returns all keys, newest first.
func (s *Service) ListKeys(ctx context.Context) ([]APIKey, error) {
	rows, err := s.DB.QueryContext(ctx, `SELECT id, label, prefix, last_used_at, revoked_at, created_at FROM api_keys ORDER BY id DESC`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	out := []APIKey{}
	for rows.Next() {
		var k APIKey
		if err := rows.Scan(&k.ID, &k.Label, &k.Prefix, &k.LastUsedAt, &k.RevokedAt, &k.CreatedAt); err != nil {
			return nil, err
		}
		out = append(out, k)
	}
	return out, rows.Err()
}

// RevokeKey disables a key; it is kept so the list shows it was used.
func (s *Service) RevokeKey(ctx context.Context, id int64) error {
	res, err := s.DB.ExecContext(ctx, `UPDATE api_keys SET revoked_at = ? WHERE id = ? AND revoked_at = ''`, stamp(s.now()), id)
	if err != nil {
		return err
	}
	if n, _ := res.RowsAffected(); n == 0 {
		return sql.ErrNoRows
	}
	return nil
}

// VerifyKey reports whether the secret is a live key, and notes the use.
func (s *Service) VerifyKey(ctx context.Context, secret string) (int64, bool) {
	if !strings.HasPrefix(secret, keyPrefix) {
		return 0, false
	}
	var id int64
	err := s.DB.QueryRowContext(ctx, `SELECT id FROM api_keys WHERE secret_hash = ? AND revoked_at = ''`, digest(secret)).Scan(&id)
	if err != nil {
		return 0, false
	}
	_, _ = s.DB.ExecContext(ctx, `UPDATE api_keys SET last_used_at = ? WHERE id = ?`, stamp(s.now()), id)
	return id, true
}
