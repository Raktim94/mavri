package store

import (
	"context"
	"sort"
	"strings"
	"sync"
	"time"
)

type memSession struct {
	userID  int64
	expires time.Time
}

// Memory is an in-process Store. It loses everything on restart, so the
// server never uses it; it exists for tests.
type Memory struct {
	mu       sync.Mutex
	users    []*User
	keys     []*APIKey
	sessions map[string]memSession
	nextUser int64
	nextKey  int64
	Now      func() time.Time
}

// NewMemory returns an empty in-memory store.
func NewMemory() *Memory {
	return &Memory{sessions: map[string]memSession{}, nextUser: 1, nextKey: 1, Now: time.Now}
}

func (m *Memory) stamp() string { return m.Now().UTC().Format("2006-01-02T15:04:05.000Z") }

func (m *Memory) CountUsers(context.Context) (int, error) {
	m.mu.Lock()
	defer m.mu.Unlock()
	return len(m.users), nil
}

func (m *Memory) UserByEmail(_ context.Context, email string) (*User, error) {
	m.mu.Lock()
	defer m.mu.Unlock()
	email = strings.ToLower(strings.TrimSpace(email))
	for _, u := range m.users {
		if u.Email == email {
			c := *u
			return &c, nil
		}
	}
	return nil, nil
}

func (m *Memory) UserByID(_ context.Context, id int64) (*User, error) {
	m.mu.Lock()
	defer m.mu.Unlock()
	for _, u := range m.users {
		if u.ID == id {
			c := *u
			return &c, nil
		}
	}
	return nil, nil
}

func (m *Memory) CreateUser(_ context.Context, email, hash, role string) (*User, error) {
	m.mu.Lock()
	defer m.mu.Unlock()
	for _, u := range m.users {
		if u.Email == email {
			return nil, ErrDuplicate
		}
	}
	u := &User{ID: m.nextUser, Email: email, PasswordHash: hash, Role: role, CreatedAt: m.stamp()}
	m.nextUser++
	m.users = append(m.users, u)
	c := *u
	return &c, nil
}

func (m *Memory) RecordLoginFailure(_ context.Context, id int64, count int, lockedUntil string) error {
	m.mu.Lock()
	defer m.mu.Unlock()
	for _, u := range m.users {
		if u.ID == id {
			u.FailedLoginCount = count
			if lockedUntil != "" {
				u.LockedUntil = lockedUntil
			}
		}
	}
	return nil
}

func (m *Memory) RecordLoginSuccess(_ context.Context, id int64, at string) error {
	m.mu.Lock()
	defer m.mu.Unlock()
	for _, u := range m.users {
		if u.ID == id {
			u.FailedLoginCount, u.LockedUntil, u.LastLoginAt = 0, "", at
		}
	}
	return nil
}

func (m *Memory) CreateAPIKey(_ context.Context, name, prefix, hash string, createdBy int64) (*APIKey, error) {
	m.mu.Lock()
	defer m.mu.Unlock()
	k := &APIKey{ID: m.nextKey, Name: name, KeyPrefix: prefix, KeyHash: hash, CreatedByUserID: createdBy, CreatedAt: m.stamp()}
	m.nextKey++
	m.keys = append(m.keys, k)
	c := *k
	return &c, nil
}

// ListAPIKeys returns every key, newest first.
func (m *Memory) ListAPIKeys(context.Context) ([]APIKey, error) {
	m.mu.Lock()
	defer m.mu.Unlock()
	out := make([]APIKey, 0, len(m.keys))
	for _, k := range m.keys {
		out = append(out, *k)
	}
	sort.SliceStable(out, func(i, j int) bool { return out[i].ID > out[j].ID })
	return out, nil
}

func (m *Memory) RevokeAPIKey(_ context.Context, id int64, at string) error {
	m.mu.Lock()
	defer m.mu.Unlock()
	for _, k := range m.keys {
		if k.ID == id && k.RevokedAt == "" {
			k.RevokedAt = at
		}
	}
	return nil
}

func (m *Memory) ActiveAPIKeyByHash(_ context.Context, hash, at string) (*APIKey, error) {
	m.mu.Lock()
	defer m.mu.Unlock()
	for _, k := range m.keys {
		if k.KeyHash == hash && k.RevokedAt == "" {
			k.LastUsedAt = at
			c := *k
			return &c, nil
		}
	}
	return nil, nil
}

func (m *Memory) CreateSession(_ context.Context, sid string, userID int64, expires time.Time) error {
	m.mu.Lock()
	defer m.mu.Unlock()
	m.sessions[sid] = memSession{userID: userID, expires: expires}
	return nil
}

func (m *Memory) SessionUser(_ context.Context, sid string, now time.Time) (int64, bool, error) {
	m.mu.Lock()
	defer m.mu.Unlock()
	s, ok := m.sessions[sid]
	if !ok {
		return 0, false, nil
	}
	if !s.expires.After(now) {
		delete(m.sessions, sid)
		return 0, false, nil
	}
	return s.userID, true, nil
}

func (m *Memory) DeleteSession(_ context.Context, sid string) error {
	m.mu.Lock()
	defer m.mu.Unlock()
	delete(m.sessions, sid)
	return nil
}
