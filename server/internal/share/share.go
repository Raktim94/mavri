// Package share manages secure client links: a random token that opens a
// read-only view of one document, with view counting and revocation.
package share

import (
	"context"
	"crypto/rand"
	"database/sql"
	"encoding/base64"
	"errors"
	"time"
)

// ErrGone means the link does not exist or was revoked.
var ErrGone = errors.New("link not found or revoked")

// Link is the state of a document's sharing.
type Link struct {
	Token         string `json:"token"`
	CreatedAt     string `json:"createdAt"`
	FirstViewedAt string `json:"firstViewedAt"`
	LastViewedAt  string `json:"lastViewedAt"`
	Views         int    `json:"views"`
}

// Links reads and writes share_links.
type Links struct {
	DB  *sql.DB
	Now func() time.Time
}

func (l *Links) now() string {
	t := time.Now()
	if l.Now != nil {
		t = l.Now()
	}
	return t.UTC().Format(time.RFC3339)
}

func newToken() (string, error) {
	b := make([]byte, 24) // 192 bits
	if _, err := rand.Read(b); err != nil {
		return "", err
	}
	return base64.RawURLEncoding.EncodeToString(b), nil
}

// Active returns the document's current link, if it has one.
func (l *Links) Active(ctx context.Context, docID int64) (Link, bool, error) {
	var k Link
	err := l.DB.QueryRowContext(ctx, `SELECT token, created_at, first_viewed_at, last_viewed_at, views FROM share_links
		WHERE document_id = ? AND revoked_at = '' ORDER BY id DESC LIMIT 1`, docID).Scan(&k.Token, &k.CreatedAt, &k.FirstViewedAt, &k.LastViewedAt, &k.Views)
	if errors.Is(err, sql.ErrNoRows) {
		return Link{}, false, nil
	}
	return k, err == nil, err
}

// Ensure returns the active link, creating one if there is none. created tells which.
func (l *Links) Ensure(ctx context.Context, docID int64) (k Link, created bool, err error) {
	if k, ok, err := l.Active(ctx, docID); err != nil || ok {
		return k, false, err
	}
	tok, err := newToken()
	if err != nil {
		return Link{}, false, err
	}
	now := l.now()
	if _, err := l.DB.ExecContext(ctx, `INSERT INTO share_links (document_id, token, created_at) VALUES (?, ?, ?)`, docID, tok, now); err != nil {
		return Link{}, false, err
	}
	return Link{Token: tok, CreatedAt: now}, true, nil
}

// Revoke switches off every link of the document.
func (l *Links) Revoke(ctx context.Context, docID int64) error {
	_, err := l.DB.ExecContext(ctx, `UPDATE share_links SET revoked_at = ? WHERE document_id = ? AND revoked_at = ''`, l.now(), docID)
	return err
}

// Lookup finds the document behind an active token.
func (l *Links) Lookup(ctx context.Context, token string) (int64, error) {
	if len(token) < 16 || len(token) > 64 {
		return 0, ErrGone
	}
	var id int64
	err := l.DB.QueryRowContext(ctx, `SELECT document_id FROM share_links WHERE token = ? AND revoked_at = ''`, token).Scan(&id)
	if errors.Is(err, sql.ErrNoRows) {
		return 0, ErrGone
	}
	return id, err
}

// Viewed counts a visit and reports whether it was the first.
func (l *Links) Viewed(ctx context.Context, token string) (first bool, err error) {
	now := l.now()
	var prev string
	if err := l.DB.QueryRowContext(ctx, `SELECT first_viewed_at FROM share_links WHERE token = ?`, token).Scan(&prev); err != nil {
		return false, err
	}
	_, err = l.DB.ExecContext(ctx, `UPDATE share_links SET views = views + 1, last_viewed_at = ?,
		first_viewed_at = CASE WHEN first_viewed_at = '' THEN ? ELSE first_viewed_at END WHERE token = ?`, now, now, token)
	return prev == "", err
}
