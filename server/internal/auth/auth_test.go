package auth

import (
	"context"
	"testing"
	"time"

	"github.com/Raktim94/mavri/server/internal/db"
)

func newService(t *testing.T) *Service {
	t.Helper()
	Iterations = 10
	d, err := db.Open(":memory:")
	if err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() { d.Close() })
	return &Service{DB: d}
}

func TestPasswordHash(t *testing.T) {
	Iterations = 10
	h, err := HashPassword("correct horse 9")
	if err != nil || !CheckPassword("correct horse 9", h) || CheckPassword("wrong", h) || CheckPassword("x", "garbage") {
		t.Fatal("hash round trip")
	}
	if !StrongEnough("abcdefg1") || StrongEnough("abcdefgh") || StrongEnough("1234567") {
		t.Fatal("strength")
	}
}

func TestSetupLoginSession(t *testing.T) {
	s, ctx := newService(t), context.Background()
	if need, _ := s.NeedsSetup(ctx); !need {
		t.Fatal("fresh database needs setup")
	}
	if _, err := s.CreateOwner(ctx, "nope", "password1"); err != ErrEmail {
		t.Fatalf("email: %v", err)
	}
	if _, err := s.CreateOwner(ctx, "a@b.co", "short"); err != ErrWeak {
		t.Fatalf("weak: %v", err)
	}
	if _, err := s.CreateOwner(ctx, "A@b.co", "password1"); err != nil {
		t.Fatal(err)
	}
	if _, err := s.CreateOwner(ctx, "c@d.co", "password1"); err != ErrSetUp {
		t.Fatalf("second owner: %v", err)
	}
	u, tok, err := s.Login(ctx, "a@b.co", "password1")
	if err != nil || u.Email != "a@b.co" || tok == "" {
		t.Fatalf("login: %v %v", u, err)
	}
	if got, err := s.UserForSession(ctx, tok); err != nil || got.ID != u.ID {
		t.Fatalf("session: %v", err)
	}
	if err := s.Logout(ctx, tok); err != nil {
		t.Fatal(err)
	}
	if _, err := s.UserForSession(ctx, tok); err != ErrNoSession {
		t.Fatal("session should be gone")
	}
}

func TestLockout(t *testing.T) {
	s, ctx := newService(t), context.Background()
	now := time.Date(2026, 1, 1, 12, 0, 0, 0, time.UTC)
	s.Now = func() time.Time { return now }
	s.CreateOwner(ctx, "a@b.co", "password1")
	for i := 0; i < lockAfter; i++ {
		if _, _, err := s.Login(ctx, "a@b.co", "bad"); err != ErrInvalidLogin {
			t.Fatalf("attempt %d: %v", i, err)
		}
	}
	if _, _, err := s.Login(ctx, "a@b.co", "password1"); err != ErrLocked {
		t.Fatalf("expected lock, got %v", err)
	}
	now = now.Add(lockDuration + time.Second)
	if _, _, err := s.Login(ctx, "a@b.co", "password1"); err != nil {
		t.Fatalf("after lock: %v", err)
	}
	if _, _, err := s.Login(ctx, "nobody@x.co", "password1"); err != ErrInvalidLogin {
		t.Fatal("unknown user")
	}
}

func TestSessionExpiry(t *testing.T) {
	s, ctx := newService(t), context.Background()
	now := time.Date(2026, 1, 1, 0, 0, 0, 0, time.UTC)
	s.Now = func() time.Time { return now }
	s.CreateOwner(ctx, "a@b.co", "password1")
	_, tok, _ := s.Login(ctx, "a@b.co", "password1")
	now = now.Add(sessionLife + time.Hour)
	if _, err := s.UserForSession(ctx, tok); err != ErrNoSession {
		t.Fatal("expired session accepted")
	}
}

func TestAPIKeys(t *testing.T) {
	s, ctx := newService(t), context.Background()
	k, secret, err := s.CreateKey(ctx, "ci", 0)
	if err != nil || secret == "" || k.Prefix == secret {
		t.Fatal(err)
	}
	if _, ok := s.VerifyKey(ctx, secret); !ok {
		t.Fatal("key should verify")
	}
	if _, ok := s.VerifyKey(ctx, secret+"x"); ok {
		t.Fatal("wrong key verified")
	}
	if err := s.RevokeKey(ctx, k.ID); err != nil {
		t.Fatal(err)
	}
	if _, ok := s.VerifyKey(ctx, secret); ok {
		t.Fatal("revoked key verified")
	}
	if keys, _ := s.ListKeys(ctx); len(keys) != 1 || keys[0].RevokedAt == "" || keys[0].LastUsedAt == "" {
		t.Fatalf("list: %+v", keys)
	}
}
