// Package auth holds the pure (database-free) authentication rules:
// password hashing, API-key secrets, password policy and login lockout.
//
// Formats and constants are compatible with data written by the existing
// TypeScript backend, so accounts and API keys keep working after the switch.
package auth

import (
	"crypto/rand"
	"crypto/subtle"
	"encoding/base64"
	"encoding/hex"
	"strconv"
	"strings"
	"time"
	"unicode/utf16"

	"github.com/Raktim94/nodedr-invoice/rewrite/internal/scrypt"
)

const (
	scryptN      = 16384
	scryptR      = 8
	scryptP      = 1
	scryptKeyLen = 64

	// MaxFailedAttempts consecutive failures lock an account for LockoutDuration.
	MaxFailedAttempts = 5
	LockoutDuration   = 15 * time.Minute

	// APIKeyPrefix starts every API key; the first 12 characters are shown in lists.
	APIKeyPrefix = "ndr_"
	apiKeySalt   = "nodedr-invoice-api-key"
	apiKeyLen    = 32
)

// HashPassword returns "scrypt:N:r:p:salt:hash". Like the TypeScript code,
// the salt is 16 random bytes written as 32 hex characters, and those hex
// characters (their UTF-8 bytes, not the decoded bytes) are the scrypt salt.
func HashPassword(password string) (string, error) {
	raw := make([]byte, 16)
	if _, err := rand.Read(raw); err != nil {
		return "", err
	}
	salt := hex.EncodeToString(raw)
	key, err := scrypt.Key([]byte(password), []byte(salt), scryptN, scryptR, scryptP, scryptKeyLen)
	if err != nil {
		return "", err
	}
	return "scrypt:" + strconv.Itoa(scryptN) + ":" + strconv.Itoa(scryptR) + ":" + strconv.Itoa(scryptP) +
		":" + salt + ":" + hex.EncodeToString(key), nil
}

// VerifyPassword checks password against a stored hash in constant time.
// Malformed or unreasonable stored values (including an empty hash, which the
// TypeScript version would have accepted) simply fail verification.
func VerifyPassword(password, stored string) bool {
	parts := strings.Split(stored, ":")
	if len(parts) != 6 || parts[0] != "scrypt" {
		return false
	}
	n, err1 := strconv.Atoi(parts[1])
	r, err2 := strconv.Atoi(parts[2])
	p, err3 := strconv.Atoi(parts[3])
	expected, err4 := hex.DecodeString(parts[5])
	if err1 != nil || err2 != nil || err3 != nil || err4 != nil || len(expected) == 0 {
		return false
	}
	actual, err := scrypt.Key([]byte(password), []byte(parts[4]), n, r, p, len(expected))
	if err != nil {
		return false
	}
	return subtle.ConstantTimeCompare(actual, expected) == 1
}

// IsPasswordStrongEnough: at least 10 characters (counted in UTF-16 code
// units, as JavaScript's length does) with an ASCII lower-case letter, an
// upper-case letter and a digit.
func IsPasswordStrongEnough(password string) bool {
	if len(utf16.Encode([]rune(password))) < 10 {
		return false
	}
	var lower, upper, digit bool
	for _, c := range password {
		switch {
		case c >= 'a' && c <= 'z':
			lower = true
		case c >= 'A' && c <= 'Z':
			upper = true
		case c >= '0' && c <= '9':
			digit = true
		}
	}
	return lower && upper && digit
}

// GenerateAPIKey returns a new secret ("ndr_" + 32 random bytes, base64url
// without padding) and its display prefix. The secret is shown once.
func GenerateAPIKey() (raw, prefix string, err error) {
	b := make([]byte, 32)
	if _, err = rand.Read(b); err != nil {
		return "", "", err
	}
	raw = APIKeyPrefix + base64.RawURLEncoding.EncodeToString(b)
	return raw, raw[:12], nil
}

// HashAPIKey is the value stored and looked up in api_keys.keyHash.
func HashAPIKey(raw string) (string, error) {
	key, err := scrypt.Key([]byte(raw), []byte(apiKeySalt), scryptN, scryptR, scryptP, apiKeyLen)
	if err != nil {
		return "", err
	}
	return hex.EncodeToString(key), nil
}

// LooksLikeAPIKey is the cheap check done before hashing a Bearer token.
func LooksLikeAPIKey(raw string) bool { return strings.HasPrefix(raw, APIKeyPrefix) }

// NextFailedLogin returns the new failed-login count and, when the threshold
// is reached, the lock expiry. The count is not reset when a lock expires, so
// the next failure after expiry locks again, exactly like the TypeScript code.
func NextFailedLogin(current int, now time.Time) (count int, lockedUntil *time.Time) {
	count = current + 1
	if count >= MaxFailedAttempts {
		t := now.Add(LockoutDuration)
		return count, &t
	}
	return count, nil
}

// FormatTimestamp renders t like JavaScript's Date.toISOString(), the format
// already stored in existing databases.
func FormatTimestamp(t time.Time) string { return t.UTC().Format("2006-01-02T15:04:05.000Z") }

// IsLocked reports whether a stored lockedUntil timestamp is still in the
// future. Empty or unparsable values mean "not locked".
func IsLocked(lockedUntil string, now time.Time) bool {
	if lockedUntil == "" {
		return false
	}
	t, err := time.Parse(time.RFC3339Nano, lockedUntil)
	if err != nil {
		return false
	}
	return t.After(now)
}
