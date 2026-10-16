package auth

import (
	"context"
	"errors"
	"testing"
)

func TestTeamManagement(t *testing.T) {
	Iterations = 10
	s, ctx := newService(t), context.Background()
	owner, err := s.CreateOwner(ctx, "o@x.co", "password1")
	if err != nil {
		t.Fatal(err)
	}
	staff, err := s.CreateUser(ctx, "Staff@X.co", "password1", RoleStaff)
	if err != nil || staff.Email != "staff@x.co" {
		t.Fatalf("create: %v %+v", err, staff)
	}
	if _, err := s.CreateUser(ctx, "staff@x.co", "password1", RoleViewer); !errors.Is(err, ErrEmailTaken) {
		t.Fatalf("duplicate: %v", err)
	}
	if _, err := s.CreateUser(ctx, "v@x.co", "weak", RoleViewer); !errors.Is(err, ErrWeak) {
		t.Fatalf("weak: %v", err)
	}
	if _, err := s.CreateUser(ctx, "v@x.co", "password1", "admin"); !errors.Is(err, ErrRole) {
		t.Fatalf("role: %v", err)
	}
	if u, tok, err := s.Login(ctx, "staff@x.co", "password1"); err != nil || u.Role != RoleStaff || tok == "" {
		t.Fatalf("the new person can sign in: %v %+v", err, u)
	}
	// The last owner cannot be demoted or deleted; with a second owner both are allowed.
	if err := s.SetRole(ctx, owner.ID, RoleStaff); !errors.Is(err, ErrLastOwner) {
		t.Fatalf("demote last owner: %v", err)
	}
	if err := s.DeleteUser(ctx, owner.ID); !errors.Is(err, ErrLastOwner) {
		t.Fatalf("delete last owner: %v", err)
	}
	if err := s.SetRole(ctx, staff.ID, RoleOwner); err != nil {
		t.Fatal(err)
	}
	if err := s.SetRole(ctx, owner.ID, RoleViewer); err != nil {
		t.Fatalf("with another owner this is fine: %v", err)
	}
	// A password reset signs the person out everywhere.
	_, tok, _ := s.Login(ctx, "o@x.co", "password1")
	if err := s.ResetPassword(ctx, owner.ID, "newpass123"); err != nil {
		t.Fatal(err)
	}
	if _, err := s.UserForSession(ctx, tok); !errors.Is(err, ErrNoSession) {
		t.Fatalf("session survived a reset: %v", err)
	}
	if _, _, err := s.Login(ctx, "o@x.co", "newpass123"); err != nil {
		t.Fatalf("new password: %v", err)
	}
	// Changing one's own password needs the old one and keeps the current session only.
	_, keep, _ := s.Login(ctx, "o@x.co", "newpass123")
	_, other, _ := s.Login(ctx, "o@x.co", "newpass123")
	if err := s.ChangePassword(ctx, owner.ID, "wrong", "another123", keep); !errors.Is(err, ErrBadOld) {
		t.Fatalf("wrong current password: %v", err)
	}
	if err := s.ChangePassword(ctx, owner.ID, "newpass123", "another123", keep); err != nil {
		t.Fatal(err)
	}
	if _, err := s.UserForSession(ctx, keep); err != nil {
		t.Fatalf("the current session should stay: %v", err)
	}
	if _, err := s.UserForSession(ctx, other); !errors.Is(err, ErrNoSession) {
		t.Fatalf("another session should end: %v", err)
	}
	if err := s.DeleteUser(ctx, owner.ID); err != nil {
		t.Fatal(err)
	}
	if list, _ := s.ListUsers(ctx); len(list) != 1 {
		t.Fatalf("users: %+v", list)
	}
	if err := s.DeleteUser(ctx, 9999); !errors.Is(err, ErrNoUser) {
		t.Fatalf("unknown: %v", err)
	}
}
