// Package web is Mavri's HTTP layer: routing, sessions and API keys, JSON
// handlers for every resource, webhooks and the single-page app.
package web

import (
	"context"
	"encoding/json"
	"errors"
	"io"
	"log/slog"
	"net"
	"net/http"
	"strings"
	"sync"
	"time"

	"github.com/Raktim94/mavri/server/internal/db"
	"github.com/Raktim94/mavri/server/internal/store"
)

type apiError struct {
	Code     string   `json:"code"`
	Message  string   `json:"message"`
	Problems []string `json:"problems,omitempty"`
}

func writeJSON(w http.ResponseWriter, status int, v any) {
	w.Header().Set("Content-Type", "application/json; charset=utf-8")
	w.WriteHeader(status)
	_ = json.NewEncoder(w).Encode(v)
}

func fail(w http.ResponseWriter, status int, code, msg string) {
	writeJSON(w, status, map[string]apiError{"error": {Code: code, Message: msg}})
}

// problem maps an error from the layers below to a status and code.
func (s *Server) problem(w http.ResponseWriter, r *http.Request, err error) {
	var v store.Validation
	switch {
	case errors.As(err, &v):
		fail(w, http.StatusBadRequest, "validation", v.Msg)
	case errors.Is(err, db.ErrNotFound):
		fail(w, http.StatusNotFound, "not_found", "not found")
	case errors.Is(err, db.ErrConflict):
		fail(w, http.StatusConflict, "conflict", "this record is in use or already exists")
	default:
		s.Log.Error("request failed", "method", r.Method, "path", r.URL.Path, "error", err)
		fail(w, http.StatusInternalServerError, "internal", "something went wrong")
	}
}

const maxBody = 32 << 20 // 32 MB: backups and attachments

// readJSON decodes the request body into v; false means an error was sent.
func readJSON(w http.ResponseWriter, r *http.Request, v any) bool {
	body, err := io.ReadAll(http.MaxBytesReader(w, r.Body, maxBody))
	if err != nil {
		fail(w, http.StatusRequestEntityTooLarge, "validation", "the request is too large")
		return false
	}
	if err := json.Unmarshal(body, v); err != nil {
		fail(w, http.StatusBadRequest, "validation", "the request body is not valid JSON for this resource")
		return false
	}
	return true
}

// ---- rate limiting ---------------------------------------------------------

type limiter struct {
	mu     sync.Mutex
	window time.Duration
	max    int
	hits   map[string][]time.Time
	now    func() time.Time
}

func newLimiter(window time.Duration, max int) *limiter {
	return &limiter{window: window, max: max, hits: map[string][]time.Time{}, now: time.Now}
}

// allow records an attempt and reports whether it is within the limit.
func (l *limiter) allow(key string) bool {
	l.mu.Lock()
	defer l.mu.Unlock()
	now := l.now()
	keep := l.hits[key][:0]
	for _, t := range l.hits[key] {
		if now.Sub(t) < l.window {
			keep = append(keep, t)
		}
	}
	if len(keep) >= l.max {
		l.hits[key] = keep
		return false
	}
	l.hits[key] = append(keep, now)
	if len(l.hits) > 10000 { // drop idle keys so the map cannot grow without bound
		for k, v := range l.hits {
			if len(v) == 0 || now.Sub(v[len(v)-1]) > l.window {
				delete(l.hits, k)
			}
		}
	}
	return true
}

// clientIP is the caller's address; behind a trusted proxy it is the entry
// that many hops from the right of X-Forwarded-For.
func (s *Server) clientIP(r *http.Request) string {
	if s.Cfg.TrustProxy > 0 {
		parts := strings.Split(r.Header.Get("X-Forwarded-For"), ",")
		if i := len(parts) - s.Cfg.TrustProxy; i >= 0 && strings.TrimSpace(parts[i]) != "" {
			return strings.TrimSpace(parts[i])
		}
	}
	host, _, err := net.SplitHostPort(r.RemoteAddr)
	if err != nil {
		return r.RemoteAddr
	}
	return host
}

func (s *Server) limited(l *limiter, key func(*http.Request) string, h http.HandlerFunc) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		if !l.allow(key(r)) {
			w.Header().Set("Retry-After", "60")
			fail(w, http.StatusTooManyRequests, "rate_limited", "too many requests, try again in a minute")
			return
		}
		h(w, r)
	}
}

// ---- middleware ------------------------------------------------------------

type statusWriter struct {
	http.ResponseWriter
	status int
}

func (w *statusWriter) WriteHeader(code int) { w.status = code; w.ResponseWriter.WriteHeader(code) }

func (s *Server) wrap(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		start := time.Now()
		sw := &statusWriter{ResponseWriter: w, status: 200}
		h := w.Header()
		h.Set("X-Content-Type-Options", "nosniff")
		h.Set("X-Frame-Options", "DENY")
		h.Set("Referrer-Policy", "same-origin")
		h.Set("Content-Security-Policy", "default-src 'self'; img-src 'self' data:; style-src 'self' 'unsafe-inline'; frame-ancestors 'none'")
		defer func() {
			if rec := recover(); rec != nil {
				s.Log.Error("panic", "path", r.URL.Path, "panic", rec)
				if sw.status == 200 {
					fail(sw, http.StatusInternalServerError, "internal", "something went wrong")
				}
			}
			if strings.HasPrefix(r.URL.Path, "/api/") && r.URL.Path != "/api/health" {
				s.Log.LogAttrs(r.Context(), slog.LevelInfo, "request", slog.String("method", r.Method), slog.String("path", r.URL.Path),
					slog.Int("status", sw.status), slog.Int64("ms", time.Since(start).Milliseconds()))
			}
		}()
		next.ServeHTTP(sw, r)
	})
}

type ctxKey int

const principalKey ctxKey = 1

type principal struct {
	UserID int64 // 0 for an API key
	KeyID  int64
}

func principalFrom(ctx context.Context) principal {
	p, _ := ctx.Value(principalKey).(principal)
	return p
}

const sessionCookie = "mavri_session"

// sameOrigin blocks cross-site form posts: a request carrying an Origin must match the host.
func sameOrigin(r *http.Request) bool {
	o := r.Header.Get("Origin")
	if o == "" {
		return true
	}
	return strings.HasSuffix(o, "://"+r.Host)
}

// auth lets a request through with a valid session cookie or API key.
// humanOnly additionally refuses API keys.
func (s *Server) auth(humanOnly bool, h http.HandlerFunc) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		ctx := r.Context()
		if hdr := r.Header.Get("Authorization"); strings.HasPrefix(hdr, "Bearer ") {
			if humanOnly {
				fail(w, http.StatusForbidden, "forbidden", "this needs a signed-in user, not an API key")
				return
			}
			if id, ok := s.Auth.VerifyKey(ctx, strings.TrimPrefix(hdr, "Bearer ")); ok {
				h(w, r.WithContext(context.WithValue(ctx, principalKey, principal{KeyID: id})))
				return
			}
			fail(w, http.StatusUnauthorized, "unauthorized", "invalid API key")
			return
		}
		c, err := r.Cookie(sessionCookie)
		if err != nil {
			fail(w, http.StatusUnauthorized, "unauthorized", "sign in first")
			return
		}
		u, err := s.Auth.UserForSession(ctx, c.Value)
		if err != nil {
			fail(w, http.StatusUnauthorized, "unauthorized", "sign in first")
			return
		}
		if r.Method != http.MethodGet && r.Method != http.MethodHead && !sameOrigin(r) {
			fail(w, http.StatusForbidden, "forbidden", "cross-site request refused")
			return
		}
		h(w, r.WithContext(context.WithValue(ctx, principalKey, principal{UserID: u.ID})))
	}
}
