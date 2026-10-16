package auth

import (
	"context"
	"database/sql"
	"errors"
	"strings"
)

// Roles. The owner can do everything. Staff work with records and documents but cannot change settings, keys,
// payments, backups, webhooks or other people. A viewer can only read.
const (
	RoleOwner  = "owner"
	RoleStaff  = "staff"
	RoleViewer = "viewer"
)

// Errors from managing people.
var (
	ErrRole       = errors.New("the role must be owner, staff or viewer")
	ErrLastOwner  = errors.New("there must always be at least one owner")
	ErrEmailTaken = errors.New("an account with this email already exists")
	ErrNoUser     = errors.New("no such account")
	ErrBadOld     = errors.New("the current password is not right")
)

// ValidRole reports whether r is a role.
func ValidRole(r string) bool { return r == RoleOwner || r == RoleStaff || r == RoleViewer }

// Member is a person with an account, as shown in the team list.
type Member struct {
	ID          int64  `json:"id"`
	Email       string `json:"email"`
	Role        string `json:"role"`
	LastLoginAt string `json:"lastLoginAt"`
	CreatedAt   string `json:"createdAt"`
}

// ListUsers returns everyone with an account, oldest first.
func (s *Service) ListUsers(ctx context.Context) ([]Member, error) {
	rows, err := s.DB.QueryContext(ctx, `SELECT id, email, role, last_login_at, created_at FROM users ORDER BY id`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	out := []Member{}
	for rows.Next() {
		var m Member
		if err := rows.Scan(&m.ID, &m.Email, &m.Role, &m.LastLoginAt, &m.CreatedAt); err != nil {
			return nil, err
		}
		out = append(out, m)
	}
	return out, rows.Err()
}

// CreateUser adds a person with a first password the owner chooses and tells them.
func (s *Service) CreateUser(ctx context.Context, email, password, role string) (Member, error) {
	email = strings.ToLower(strings.TrimSpace(email))
	if !strings.Contains(email, "@") || len(email) < 3 {
		return Member{}, ErrEmail
	}
	if !ValidRole(role) {
		return Member{}, ErrRole
	}
	if !StrongEnough(password) {
		return Member{}, ErrWeak
	}
	hash, err := HashPassword(password)
	if err != nil {
		return Member{}, err
	}
	now := stamp(s.now())
	res, err := s.DB.ExecContext(ctx, `INSERT INTO users (email, password_hash, role, created_at) VALUES (?, ?, ?, ?)`, email, hash, role, now)
	if err != nil {
		if strings.Contains(err.Error(), "UNIQUE") {
			return Member{}, ErrEmailTaken
		}
		return Member{}, err
	}
	id, _ := res.LastInsertId()
	return Member{ID: id, Email: email, Role: role, CreatedAt: now}, nil
}

// SetRole changes a person's role. The last owner cannot be demoted.
func (s *Service) SetRole(ctx context.Context, id int64, role string) error {
	if !ValidRole(role) {
		return ErrRole
	}
	var cur string
	if err := s.DB.QueryRowContext(ctx, `SELECT role FROM users WHERE id = ?`, id).Scan(&cur); errors.Is(err, sql.ErrNoRows) {
		return ErrNoUser
	} else if err != nil {
		return err
	}
	if cur == RoleOwner && role != RoleOwner {
		if err := s.requireAnotherOwner(ctx, id); err != nil {
			return err
		}
	}
	_, err := s.DB.ExecContext(ctx, `UPDATE users SET role = ? WHERE id = ?`, role, id)
	return err
}

func (s *Service) requireAnotherOwner(ctx context.Context, id int64) error {
	var n int
	if err := s.DB.QueryRowContext(ctx, `SELECT COUNT(*) FROM users WHERE role = 'owner' AND id <> ?`, id).Scan(&n); err != nil {
		return err
	}
	if n == 0 {
		return ErrLastOwner
	}
	return nil
}

// DeleteUser removes an account and ends its sessions. The last owner cannot be removed.
func (s *Service) DeleteUser(ctx context.Context, id int64) error {
	var cur string
	if err := s.DB.QueryRowContext(ctx, `SELECT role FROM users WHERE id = ?`, id).Scan(&cur); errors.Is(err, sql.ErrNoRows) {
		return ErrNoUser
	} else if err != nil {
		return err
	}
	if cur == RoleOwner {
		if err := s.requireAnotherOwner(ctx, id); err != nil {
			return err
		}
	}
	_, err := s.DB.ExecContext(ctx, `DELETE FROM users WHERE id = ?`, id)
	return err
}

// ResetPassword sets a new password for a person and signs them out everywhere.
func (s *Service) ResetPassword(ctx context.Context, id int64, password string) error {
	if !StrongEnough(password) {
		return ErrWeak
	}
	hash, err := HashPassword(password)
	if err != nil {
		return err
	}
	res, err := s.DB.ExecContext(ctx, `UPDATE users SET password_hash = ?, failed_logins = 0, locked_until = '' WHERE id = ?`, hash, id)
	if err != nil {
		return err
	}
	if n, _ := res.RowsAffected(); n == 0 {
		return ErrNoUser
	}
	_, err = s.DB.ExecContext(ctx, `DELETE FROM sessions WHERE user_id = ?`, id)
	return err
}

// ChangePassword lets a person change their own password after proving they know the current one. Their other
// sessions end; the session `keep` (the one asking) stays.
func (s *Service) ChangePassword(ctx context.Context, id int64, current, password, keepToken string) error {
	var stored string
	if err := s.DB.QueryRowContext(ctx, `SELECT password_hash FROM users WHERE id = ?`, id).Scan(&stored); errors.Is(err, sql.ErrNoRows) {
		return ErrNoUser
	} else if err != nil {
		return err
	}
	if !CheckPassword(current, stored) {
		return ErrBadOld
	}
	if !StrongEnough(password) {
		return ErrWeak
	}
	hash, err := HashPassword(password)
	if err != nil {
		return err
	}
	if _, err := s.DB.ExecContext(ctx, `UPDATE users SET password_hash = ? WHERE id = ?`, hash, id); err != nil {
		return err
	}
	_, err = s.DB.ExecContext(ctx, `DELETE FROM sessions WHERE user_id = ? AND token_hash <> ?`, id, digest(keepToken))
	return err
}
