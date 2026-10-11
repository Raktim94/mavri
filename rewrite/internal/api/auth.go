package api

import (
	"context"
	"crypto/rand"
	"encoding/base64"
	"encoding/hex"
	"encoding/json"
	"net/http"
	"strconv"
	"strings"
	"sync"
	"time"

	"github.com/Raktim94/nodedr-invoice/rewrite/internal/auth"
	"github.com/Raktim94/nodedr-invoice/rewrite/internal/httpx"
	"github.com/Raktim94/nodedr-invoice/rewrite/internal/store"
)

const (
	sessionCookie = "nodedr.sid"
	sessionTTL    = 24 * time.Hour
	bearerPrefix  = "Bearer "
)

type principalKind int

const (
	bySession principalKind = iota + 1
	byAPIKey
)

type principal struct {
	kind   principalKind
	userID int64
	name   string // API key name
}

type ctxKey struct{}

func principalFrom(ctx context.Context) principal {
	p, _ := ctx.Value(ctxKey{}).(principal)
	return p
}

type publicUser struct {
	ID          int64   `json:"id"`
	Email       string  `json:"email"`
	Role        string  `json:"role"`
	LastLoginAt *string `json:"lastLoginAt"`
	CreatedAt   string  `json:"createdAt"`
}

type publicKey struct {
	ID         int64   `json:"id"`
	Name       string  `json:"name"`
	KeyPrefix  string  `json:"keyPrefix"`
	LastUsedAt *string `json:"lastUsedAt"`
	RevokedAt  *string `json:"revokedAt"`
	CreatedAt  string  `json:"createdAt"`
}

func optional(s string) *string {
	if s == "" {
		return nil
	}
	return &s
}

func toPublicUser(u *store.User) publicUser {
	return publicUser{ID: u.ID, Email: u.Email, Role: u.Role, LastLoginAt: optional(u.LastLoginAt), CreatedAt: u.CreatedAt}
}

func toPublicKey(k store.APIKey) publicKey {
	return publicKey{ID: k.ID, Name: k.Name, KeyPrefix: k.KeyPrefix, LastUsedAt: optional(k.LastUsedAt),
		RevokedAt: optional(k.RevokedAt), CreatedAt: k.CreatedAt}
}

// authAPI holds the dependencies of the /api/auth routes.
type authAPI struct {
	st        store.Store
	now       func() time.Time
	secure    bool
	dummyOnce sync.Once
	dummyHash string
}

func (a *authAPI) requireDB(next http.HandlerFunc) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		if a.st == nil {
			httpx.Fail(w, http.StatusBadRequest, "error.databaseNotInitialized")
			return
		}
		next(w, r)
	}
}

// requireAuth accepts a live session cookie or a Bearer API key.
func (a *authAPI) requireAuth(next http.HandlerFunc) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		if a.st == nil {
			httpx.Fail(w, http.StatusUnauthorized, "error.unauthorized")
			return
		}
		if c, err := r.Cookie(sessionCookie); err == nil && c.Value != "" {
			if id, ok, err := a.st.SessionUser(r.Context(), c.Value, a.now()); err == nil && ok {
				next(w, r.WithContext(context.WithValue(r.Context(), ctxKey{}, principal{kind: bySession, userID: id})))
				return
			}
		}
		if h := r.Header.Get("Authorization"); strings.HasPrefix(h, bearerPrefix) {
			raw := strings.TrimSpace(h[len(bearerPrefix):])
			if auth.LooksLikeAPIKey(raw) {
				if hash, err := auth.HashAPIKey(raw); err == nil {
					k, err := a.st.ActiveAPIKeyByHash(r.Context(), hash, auth.FormatTimestamp(a.now()))
					if err == nil && k != nil {
						next(w, r.WithContext(context.WithValue(r.Context(), ctxKey{}, principal{kind: byAPIKey, name: k.Name})))
						return
					}
				}
			}
		}
		httpx.Fail(w, http.StatusUnauthorized, "error.unauthorized")
	}
}

// humanOnly rejects API keys: a leaked key must not be able to mint more keys.
func humanOnly(next http.HandlerFunc) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		if principalFrom(r.Context()).kind != bySession {
			httpx.Fail(w, http.StatusForbidden, "error.forbidden")
			return
		}
		next(w, r)
	}
}

func (a *authAPI) startSession(w http.ResponseWriter, r *http.Request, userID int64) error {
	b := make([]byte, 32)
	if _, err := rand.Read(b); err != nil {
		return err
	}
	sid := base64.RawURLEncoding.EncodeToString(b)
	if err := a.st.CreateSession(r.Context(), sid, userID, a.now().Add(sessionTTL)); err != nil {
		return err
	}
	http.SetCookie(w, &http.Cookie{Name: sessionCookie, Value: sid, Path: "/", HttpOnly: true, Secure: a.secure,
		SameSite: http.SameSiteLaxMode, MaxAge: int(sessionTTL.Seconds())})
	return nil
}

type credentials struct {
	Email    string `json:"email"`
	Password string `json:"password"`
}

// readCredentials decodes the body; anything unusable counts as missing fields.
func readCredentials(r *http.Request) (credentials, bool) {
	var c credentials
	if err := json.NewDecoder(r.Body).Decode(&c); err != nil || c.Email == "" || c.Password == "" {
		return c, false
	}
	return c, true
}

func serverError(w http.ResponseWriter) {
	httpx.Fail(w, http.StatusInternalServerError, "error.unknownError")
}

func (a *authAPI) status(w http.ResponseWriter, r *http.Request) {
	n, err := a.st.CountUsers(r.Context())
	if err != nil {
		serverError(w)
		return
	}
	httpx.OK(w, map[string]bool{"needsSetup": n == 0})
}

// setup creates the owner account. It only works while no user exists, so it
// cannot be used afterwards to add an unauthorised account.
func (a *authAPI) setup(w http.ResponseWriter, r *http.Request) {
	n, err := a.st.CountUsers(r.Context())
	if err != nil {
		serverError(w)
		return
	}
	if n > 0 {
		httpx.Fail(w, http.StatusForbidden, "error.alreadySetUp")
		return
	}
	c, ok := readCredentials(r)
	if !ok {
		httpx.Fail(w, http.StatusBadRequest, "error.missingFields")
		return
	}
	email := strings.ToLower(strings.TrimSpace(c.Email))
	if email == "" || !strings.Contains(email, "@") {
		httpx.Fail(w, http.StatusBadRequest, "error.invalidEmail")
		return
	}
	if !auth.IsPasswordStrongEnough(c.Password) {
		httpx.Fail(w, http.StatusBadRequest, "error.weakPassword")
		return
	}
	hash, err := auth.HashPassword(c.Password)
	if err != nil {
		serverError(w)
		return
	}
	u, err := a.st.CreateUser(r.Context(), email, hash, "owner")
	if err == store.ErrDuplicate {
		httpx.Fail(w, http.StatusForbidden, "error.alreadySetUp")
		return
	}
	if err != nil || a.startSession(w, r, u.ID) != nil {
		serverError(w)
		return
	}
	httpx.OK(w, toPublicUser(u))
}

func (a *authAPI) login(w http.ResponseWriter, r *http.Request) {
	c, ok := readCredentials(r)
	if !ok {
		httpx.Fail(w, http.StatusBadRequest, "error.missingFields")
		return
	}
	u, err := a.st.UserByEmail(r.Context(), c.Email)
	if err != nil {
		serverError(w)
		return
	}
	// One generic answer for "no such user" and "wrong password", and the
	// same hashing work either way, so neither the response nor its timing
	// reveals which addresses have accounts.
	if u == nil {
		a.dummyOnce.Do(func() { a.dummyHash, _ = auth.HashPassword("not-a-real-password") })
		auth.VerifyPassword(c.Password, a.dummyHash)
		httpx.Fail(w, http.StatusUnauthorized, "error.invalidCredentials")
		return
	}
	now := a.now()
	if auth.IsLocked(u.LockedUntil, now) {
		httpx.Fail(w, http.StatusLocked, "error.accountLocked")
		return
	}
	if !auth.VerifyPassword(c.Password, u.PasswordHash) {
		count, until := auth.NextFailedLogin(u.FailedLoginCount, now)
		locked := ""
		if until != nil {
			locked = auth.FormatTimestamp(*until)
		}
		if err := a.st.RecordLoginFailure(r.Context(), u.ID, count, locked); err != nil {
			serverError(w)
			return
		}
		httpx.Fail(w, http.StatusUnauthorized, "error.invalidCredentials")
		return
	}
	at := auth.FormatTimestamp(now)
	if err := a.st.RecordLoginSuccess(r.Context(), u.ID, at); err != nil || a.startSession(w, r, u.ID) != nil {
		serverError(w)
		return
	}
	u.LastLoginAt = at
	httpx.OK(w, toPublicUser(u))
}

func (a *authAPI) logout(w http.ResponseWriter, r *http.Request) {
	if c, err := r.Cookie(sessionCookie); err == nil && a.st != nil {
		_ = a.st.DeleteSession(r.Context(), c.Value)
	}
	http.SetCookie(w, &http.Cookie{Name: sessionCookie, Value: "", Path: "/", HttpOnly: true, Secure: a.secure,
		SameSite: http.SameSiteLaxMode, MaxAge: -1})
	httpx.WriteJSON(w, http.StatusOK, httpx.Envelope{Success: true})
}

func (a *authAPI) me(w http.ResponseWriter, r *http.Request) {
	p := principalFrom(r.Context())
	if p.kind == byAPIKey {
		httpx.OK(w, map[string]any{"apiKey": true, "name": p.name})
		return
	}
	u, err := a.st.UserByID(r.Context(), p.userID)
	if err != nil {
		serverError(w)
		return
	}
	if u == nil {
		httpx.Fail(w, http.StatusUnauthorized, "error.unauthorized")
		return
	}
	httpx.OK(w, toPublicUser(u))
}

func (a *authAPI) listKeys(w http.ResponseWriter, r *http.Request) {
	keys, err := a.st.ListAPIKeys(r.Context())
	if err != nil {
		serverError(w)
		return
	}
	out := make([]publicKey, 0, len(keys))
	for _, k := range keys {
		out = append(out, toPublicKey(k))
	}
	httpx.OK(w, out)
}

func (a *authAPI) createKey(w http.ResponseWriter, r *http.Request) {
	var body struct {
		Name string `json:"name"`
	}
	_ = json.NewDecoder(r.Body).Decode(&body)
	name := strings.TrimSpace(body.Name)
	if name == "" {
		b := make([]byte, 4)
		_, _ = rand.Read(b)
		name = "key-" + hex.EncodeToString(b)
	}
	raw, prefix, err := auth.GenerateAPIKey()
	if err != nil {
		serverError(w)
		return
	}
	hash, err := auth.HashAPIKey(raw)
	if err != nil {
		serverError(w)
		return
	}
	k, err := a.st.CreateAPIKey(r.Context(), name, prefix, hash, principalFrom(r.Context()).userID)
	if err != nil {
		serverError(w)
		return
	}
	httpx.OK(w, map[string]any{"apiKey": toPublicKey(*k), "secret": raw})
}

func (a *authAPI) revokeKey(w http.ResponseWriter, r *http.Request) {
	// A non-numeric id matches no key, which is still a success (as before).
	if id, err := strconv.ParseInt(r.PathValue("id"), 10, 64); err == nil {
		if err := a.st.RevokeAPIKey(r.Context(), id, auth.FormatTimestamp(a.now())); err != nil {
			serverError(w)
			return
		}
	}
	httpx.WriteJSON(w, http.StatusOK, httpx.Envelope{Success: true})
}
