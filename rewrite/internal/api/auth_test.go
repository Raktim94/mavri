package api

import (
	"context"
	"encoding/json"
	"io"
	"log/slog"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"

	"github.com/Raktim94/nodedr-invoice/rewrite/internal/config"
	"github.com/Raktim94/nodedr-invoice/rewrite/internal/store"
	"github.com/Raktim94/nodedr-invoice/rewrite/internal/store/sqlitestore"
)

const goodPassword = "Correct-Horse-9"

type env struct {
	t     *testing.T
	h     http.Handler
	st    *store.Memory
	clock time.Time
	sql   *sqlitestore.Store
	dir   string
}

func newEnv(t *testing.T) *env {
	e := &env{t: t, st: store.NewMemory(), clock: time.Date(2026, 10, 11, 9, 0, 0, 0, time.UTC)}
	e.st.Now = func() time.Time { return e.clock }
	cfg := config.LoadFrom(func(string) string { return "" })
	e.h = newHandler(cfg, slog.New(slog.NewJSONHandler(io.Discard, nil)), e.st, nil, func() time.Time { return e.clock })
	return e
}

type reply struct {
	Code    int
	Body    map[string]any
	Cookies []*http.Cookie
}

func (e *env) do(method, path, body string, hdr map[string]string, cookie *http.Cookie) reply {
	e.t.Helper()
	req := httptest.NewRequest(method, path, strings.NewReader(body))
	for k, v := range hdr {
		req.Header.Set(k, v)
	}
	if cookie != nil {
		req.AddCookie(cookie)
	}
	rec := httptest.NewRecorder()
	e.h.ServeHTTP(rec, req)
	var m map[string]any
	_ = json.Unmarshal(rec.Body.Bytes(), &m)
	return reply{Code: rec.Code, Body: m, Cookies: rec.Result().Cookies()}
}

func (r reply) key() any { return r.Body["key"] }
func (r reply) data() map[string]any {
	d, _ := r.Body["data"].(map[string]any)
	return d
}
func (r reply) session() *http.Cookie {
	for _, c := range r.Cookies {
		if c.Name == sessionCookie && c.MaxAge >= 0 && c.Value != "" {
			return c
		}
	}
	return nil
}

func creds(email, pw string) string {
	b, _ := json.Marshal(map[string]string{"email": email, "password": pw})
	return string(b)
}

func (e *env) setup() *http.Cookie {
	e.t.Helper()
	r := e.do("POST", "/api/auth/setup", creds("Owner@Example.com ", goodPassword), nil, nil)
	if r.Code != 200 || r.session() == nil {
		e.t.Fatalf("setup: %d %v", r.Code, r.Body)
	}
	return r.session()
}

func TestNoDatabaseAnswersNotInitialised(t *testing.T) {
	for _, p := range []string{"/api/auth/status"} {
		r := get(t, p)
		if r.Code != 400 || !strings.Contains(r.Body.String(), "error.databaseNotInitialized") {
			t.Errorf("%s: %d %s", p, r.Code, r.Body.String())
		}
	}
}

func TestSetupFlow(t *testing.T) {
	e := newEnv(t)
	if r := e.do("GET", "/api/auth/status", "", nil, nil); r.data()["needsSetup"] != true {
		t.Fatalf("fresh install should need setup: %v", r.Body)
	}
	if r := e.do("GET", "/api/databases/ready", "", nil, nil); r.data()["ready"] != true {
		t.Errorf("ready should be true with a store: %v", r.Body)
	}
	cases := []struct {
		body string
		code int
		key  string
	}{
		{`{"email":"a@b.co"}`, 400, "error.missingFields"},
		{creds("no-at-sign", goodPassword), 400, "error.invalidEmail"},
		{creds("a@b.co", "weak"), 400, "error.weakPassword"},
	}
	for _, c := range cases {
		if r := e.do("POST", "/api/auth/setup", c.body, nil, nil); r.Code != c.code || r.key() != c.key {
			t.Errorf("%s: got %d %v", c.body, r.Code, r.Body)
		}
	}
	ck := e.setup()
	me := e.do("GET", "/api/auth/me", "", nil, ck)
	if me.Code != 200 || me.data()["email"] != "owner@example.com" || me.data()["role"] != "owner" {
		t.Errorf("me after setup: %v", me.Body)
	}
	if _, has := me.data()["passwordHash"]; has {
		t.Error("password hash leaked")
	}
	if r := e.do("POST", "/api/auth/setup", creds("x@y.co", goodPassword), nil, nil); r.Code != 403 || r.key() != "error.alreadySetUp" {
		t.Errorf("second setup: %d %v", r.Code, r.Body)
	}
	if r := e.do("GET", "/api/auth/status", "", nil, nil); r.data()["needsSetup"] != false {
		t.Errorf("status after setup: %v", r.Body)
	}
}

func TestSessionCookieAttributes(t *testing.T) {
	e := newEnv(t)
	c := e.setup()
	if !c.HttpOnly || c.SameSite != http.SameSiteLaxMode || c.MaxAge != 86400 || c.Path != "/" {
		t.Errorf("cookie attributes: %+v", c)
	}
}

func TestLoginLockoutAndRecovery(t *testing.T) {
	e := newEnv(t)
	e.setup()
	wrong := creds("owner@example.com", "Wrong-Pass-12")
	unknown := e.do("POST", "/api/auth/login", creds("nobody@example.com", goodPassword), nil, nil)
	first := e.do("POST", "/api/auth/login", wrong, nil, nil)
	if unknown.Code != 401 || first.Code != 401 || unknown.key() != first.key() || first.key() != "error.invalidCredentials" {
		t.Fatalf("unknown user and wrong password must look identical: %v / %v", unknown.Body, first.Body)
	}
	for i := 0; i < 4; i++ {
		e.do("POST", "/api/auth/login", wrong, nil, nil)
	}
	// Five failures lock the account, so even the right password is refused.
	if r := e.do("POST", "/api/auth/login", creds("owner@example.com", goodPassword), nil, nil); r.Code != 423 || r.key() != "error.accountLocked" {
		t.Fatalf("expected lock: %d %v", r.Code, r.Body)
	}
	e.clock = e.clock.Add(16 * time.Minute)
	ok := e.do("POST", "/api/auth/login", creds("OWNER@example.com", goodPassword), nil, nil)
	if ok.Code != 200 || ok.session() == nil || ok.data()["lastLoginAt"] != nil {
		t.Fatalf("login after lock expiry: %d %v", ok.Code, ok.Body)
	}
	u, _ := e.st.UserByEmail(context.Background(), "owner@example.com")
	if u.LastLoginAt == "" {
		t.Error("the new login time should be stored")
	}
	if u.FailedLoginCount != 0 || u.LockedUntil != "" {
		t.Errorf("success should clear the counters: %+v", u)
	}
}

func TestLoginRateLimit(t *testing.T) {
	e := newEnv(t)
	e.setup()
	for i := 1; i <= 11; i++ {
		r := e.do("POST", "/api/auth/login", `{}`, nil, nil)
		want := 400
		if i == 11 {
			want = 429
		}
		if r.Code != want {
			t.Fatalf("attempt %d: got %d", i, r.Code)
		}
	}
}

func TestLogoutEndsSession(t *testing.T) {
	e := newEnv(t)
	ck := e.setup()
	if r := e.do("POST", "/api/auth/logout", "", nil, ck); r.Code != 200 || r.Body["success"] != true {
		t.Fatalf("logout: %v", r.Body)
	}
	if r := e.do("GET", "/api/auth/me", "", nil, ck); r.Code != 401 || r.key() != "error.unauthorized" {
		t.Errorf("old cookie must stop working: %d %v", r.Code, r.Body)
	}
}

func TestSessionExpires(t *testing.T) {
	e := newEnv(t)
	ck := e.setup()
	e.clock = e.clock.Add(25 * time.Hour)
	if r := e.do("GET", "/api/auth/me", "", nil, ck); r.Code != 401 {
		t.Errorf("expired session accepted: %d", r.Code)
	}
}

func TestUnauthenticatedAndForgedAccess(t *testing.T) {
	e := newEnv(t)
	e.setup()
	for _, c := range []*http.Cookie{nil, {Name: sessionCookie, Value: "forged"}} {
		if r := e.do("GET", "/api/auth/me", "", nil, c); r.Code != 401 {
			t.Errorf("cookie %v: %d", c, r.Code)
		}
	}
	for _, h := range []string{"Bearer ndr_nonsense", "Bearer not-a-key", "Basic abc"} {
		if r := e.do("GET", "/api/auth/api-keys", "", map[string]string{"Authorization": h}, nil); r.Code != 401 {
			t.Errorf("%q: %d", h, r.Code)
		}
	}
}

func TestAPIKeyLifecycle(t *testing.T) {
	e := newEnv(t)
	ck := e.setup()
	made := e.do("POST", "/api/auth/api-keys", `{"name":"  mcp  "}`, nil, ck)
	secret, _ := made.data()["secret"].(string)
	meta, _ := made.data()["apiKey"].(map[string]any)
	if made.Code != 200 || !strings.HasPrefix(secret, "ndr_") || meta["name"] != "mcp" || meta["keyPrefix"] != secret[:12] {
		t.Fatalf("create: %v", made.Body)
	}
	if _, leaked := meta["keyHash"]; leaked {
		t.Error("key hash leaked")
	}
	bearer := map[string]string{"Authorization": "Bearer " + secret}
	me := e.do("GET", "/api/auth/me", "", bearer, nil)
	if me.Code != 200 || me.data()["apiKey"] != true || me.data()["name"] != "mcp" {
		t.Errorf("me via key: %v", me.Body)
	}
	// Keys are for machines: they cannot list or mint keys.
	for _, m := range []string{"GET", "POST"} {
		if r := e.do(m, "/api/auth/api-keys", `{}`, bearer, nil); r.Code != 403 || r.key() != "error.forbidden" {
			t.Errorf("%s with key: %d %v", m, r.Code, r.Body)
		}
	}
	list := e.do("GET", "/api/auth/api-keys", "", nil, ck)
	rows, _ := list.Body["data"].([]any)
	if len(rows) != 1 || rows[0].(map[string]any)["lastUsedAt"] == nil {
		t.Errorf("list should show the key as used: %v", list.Body)
	}
	if r := e.do("DELETE", "/api/auth/api-keys/1", "", nil, ck); r.Code != 200 {
		t.Fatalf("revoke: %v", r.Body)
	}
	if r := e.do("GET", "/api/auth/me", "", bearer, nil); r.Code != 401 {
		t.Errorf("revoked key still works: %d", r.Code)
	}
	if r := e.do("DELETE", "/api/auth/api-keys/abc", "", nil, ck); r.Code != 200 {
		t.Errorf("non-numeric id: %d", r.Code)
	}
}

func TestDefaultKeyName(t *testing.T) {
	e := newEnv(t)
	ck := e.setup()
	r := e.do("POST", "/api/auth/api-keys", `{}`, nil, ck)
	name, _ := r.data()["apiKey"].(map[string]any)["name"].(string)
	if !strings.HasPrefix(name, "key-") || len(name) != 12 {
		t.Errorf("default name %q", name)
	}
}

func TestSetupRateLimit(t *testing.T) {
	e := newEnv(t)
	for i := 1; i <= 6; i++ {
		r := e.do("POST", "/api/auth/setup", `not json`, nil, nil)
		want := 400
		if i == 6 {
			want = 429
		}
		if r.Code != want {
			t.Fatalf("attempt %d: got %d", i, r.Code)
		}
	}
}
