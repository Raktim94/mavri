// Package storetest is the behaviour contract every store.Store must meet.
// Each implementation's tests call Run with a factory for a fresh, empty store.
package storetest

import (
	"context"
	"testing"
	"time"

	"github.com/Raktim94/nodedr-invoice/rewrite/internal/store"
)

// Run executes the shared contract against stores built by fresh.
func Run(t *testing.T, fresh func(t *testing.T) store.Store) {
	ctx := context.Background()
	t.Run("users", func(t *testing.T) {
		s := fresh(t)
		if n, err := s.CountUsers(ctx); err != nil || n != 0 {
			t.Fatalf("count: %d %v", n, err)
		}
		u, err := s.CreateUser(ctx, "owner@example.com", "hash", "owner")
		if err != nil || u.ID == 0 || u.Role != "owner" || u.CreatedAt == "" {
			t.Fatalf("create: %+v %v", u, err)
		}
		if _, err := s.CreateUser(ctx, "owner@example.com", "h2", "owner"); err != store.ErrDuplicate {
			t.Errorf("duplicate email: %v", err)
		}
		for _, q := range []string{"owner@example.com", "  OWNER@Example.com "} {
			got, err := s.UserByEmail(ctx, q)
			if err != nil || got == nil || got.ID != u.ID || got.PasswordHash != "hash" {
				t.Errorf("by email %q: %+v %v", q, got, err)
			}
		}
		if got, err := s.UserByEmail(ctx, "nobody@example.com"); got != nil || err != nil {
			t.Errorf("missing email: %+v %v", got, err)
		}
		if got, err := s.UserByID(ctx, 999); got != nil || err != nil {
			t.Errorf("missing id: %+v %v", got, err)
		}
		if err := s.RecordLoginFailure(ctx, u.ID, 5, "2026-10-11T10:00:00.000Z"); err != nil {
			t.Fatal(err)
		}
		got, _ := s.UserByID(ctx, u.ID)
		if got.FailedLoginCount != 5 || got.LockedUntil != "2026-10-11T10:00:00.000Z" {
			t.Errorf("after failure: %+v", got)
		}
		// A failure below the threshold keeps an existing lock value untouched.
		_ = s.RecordLoginFailure(ctx, u.ID, 6, "")
		if got, _ = s.UserByID(ctx, u.ID); got.FailedLoginCount != 6 || got.LockedUntil == "" {
			t.Errorf("lock should persist: %+v", got)
		}
		if err := s.RecordLoginSuccess(ctx, u.ID, "2026-10-11T11:00:00.000Z"); err != nil {
			t.Fatal(err)
		}
		got, _ = s.UserByID(ctx, u.ID)
		if got.CreatedAt == "" {
			t.Error("createdAt empty")
		}
		if got.FailedLoginCount != 0 || got.LockedUntil != "" || got.LastLoginAt != "2026-10-11T11:00:00.000Z" {
			t.Errorf("after success: %+v", got)
		}
		if n, _ := s.CountUsers(ctx); n != 1 {
			t.Errorf("count %d", n)
		}
	})

	t.Run("api keys", func(t *testing.T) {
		s := fresh(t)
		u, _ := s.CreateUser(ctx, "o@example.com", "h", "owner")
		a, err := s.CreateAPIKey(ctx, "first", "ndr_aaaaaaaa", "hash-a", u.ID)
		if err != nil || a.ID == 0 || a.CreatedByUserID != u.ID {
			t.Fatalf("create: %+v %v", a, err)
		}
		b, _ := s.CreateAPIKey(ctx, "second", "ndr_bbbbbbbb", "hash-b", u.ID)
		list, err := s.ListAPIKeys(ctx)
		if err != nil || len(list) != 2 || list[0].ID != b.ID || list[1].ID != a.ID {
			t.Fatalf("list should be newest first: %+v %v", list, err)
		}
		if k, _ := s.ActiveAPIKeyByHash(ctx, "nope", "t"); k != nil {
			t.Error("unknown hash matched")
		}
		k, err := s.ActiveAPIKeyByHash(ctx, "hash-a", "2026-10-11T12:00:00.000Z")
		if err != nil || k == nil || k.Name != "first" {
			t.Fatalf("by hash: %+v %v", k, err)
		}
		list, _ = s.ListAPIKeys(ctx)
		if list[1].LastUsedAt != "2026-10-11T12:00:00.000Z" {
			t.Errorf("lastUsedAt not stamped: %+v", list[1])
		}
		if err := s.RevokeAPIKey(ctx, a.ID, "2026-10-11T13:00:00.000Z"); err != nil {
			t.Fatal(err)
		}
		// Revoking twice keeps the first revocation time.
		_ = s.RevokeAPIKey(ctx, a.ID, "2026-10-11T14:00:00.000Z")
		if k, _ := s.ActiveAPIKeyByHash(ctx, "hash-a", "t"); k != nil {
			t.Error("revoked key still active")
		}
		list, _ = s.ListAPIKeys(ctx)
		if list[1].RevokedAt != "2026-10-11T13:00:00.000Z" {
			t.Errorf("revokedAt: %+v", list[1])
		}
	})

	t.Run("sessions", func(t *testing.T) {
		s := fresh(t)
		u, _ := s.CreateUser(ctx, "o@example.com", "h", "owner")
		now := time.Date(2026, 10, 11, 9, 0, 0, 0, time.UTC)
		if err := s.CreateSession(ctx, "sid-1", u.ID, now.Add(time.Hour)); err != nil {
			t.Fatal(err)
		}
		if id, ok, err := s.SessionUser(ctx, "sid-1", now); err != nil || !ok || id != u.ID {
			t.Errorf("live session: %d %v %v", id, ok, err)
		}
		if _, ok, _ := s.SessionUser(ctx, "sid-1", now.Add(2*time.Hour)); ok {
			t.Error("expired session accepted")
		}
		if _, ok, _ := s.SessionUser(ctx, "missing", now); ok {
			t.Error("unknown session accepted")
		}
		_ = s.CreateSession(ctx, "sid-2", u.ID, now.Add(time.Hour))
		_ = s.DeleteSession(ctx, "sid-2")
		if _, ok, _ := s.SessionUser(ctx, "sid-2", now); ok {
			t.Error("deleted session accepted")
		}
		if err := s.DeleteSession(ctx, "never-existed"); err != nil {
			t.Errorf("deleting a missing session: %v", err)
		}
	})
}
