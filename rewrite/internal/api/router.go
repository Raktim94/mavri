// Package api wires the REST routes. Only the public service endpoints exist
// so far; every other route is tracked in docs/rewrite/PARITY_MATRIX.md.
package api

import (
	"log/slog"
	"net/http"
	"strings"
	"time"

	"github.com/Raktim94/nodedr-invoice/rewrite/internal/config"
	"github.com/Raktim94/nodedr-invoice/rewrite/internal/httpx"
	"github.com/Raktim94/nodedr-invoice/rewrite/internal/store"
)

const maxJSONBody = 50 << 20 // 50 MB, same as the TypeScript server

// NewHandler builds the full HTTP handler with the middleware stack in the
// same order as the TypeScript server: headers, body limit, CORS, then the
// global /api rate limit (300 requests per minute per client). st may be nil
// while no database is configured: auth routes then answer
// error.databaseNotInitialized and /api/databases/ready reports false.
func NewHandler(cfg config.Config, log *slog.Logger, st store.Store) http.Handler {
	return newHandler(cfg, log, st, time.Now)
}

func newHandler(cfg config.Config, log *slog.Logger, st store.Store, now func() time.Time) http.Handler {
	mux := http.NewServeMux()
	mux.HandleFunc("GET /api/health", func(w http.ResponseWriter, _ *http.Request) {
		httpx.WriteJSON(w, http.StatusOK, map[string]bool{"ok": true})
	})
	mux.HandleFunc("GET /api/version", func(w http.ResponseWriter, _ *http.Request) {
		httpx.WriteJSON(w, http.StatusOK, map[string]string{"version": cfg.Version})
	})
	// The renderer uses this to decide whether to show the database chooser.
	mux.HandleFunc("GET /api/databases/ready", func(w http.ResponseWriter, _ *http.Request) {
		httpx.OK(w, map[string]bool{"ready": st != nil})
	})

	a := &authAPI{st: st, now: now, secure: cfg.CookieSecure}
	loginLimit := httpx.NewLimiter(15*time.Minute, 10, cfg.TrustedProxies)
	setupLimit := httpx.NewLimiter(time.Hour, 5, cfg.TrustedProxies)
	limited := func(l *httpx.Limiter, h http.HandlerFunc) http.HandlerFunc { return l.Middleware(h).ServeHTTP }
	mux.HandleFunc("GET /api/auth/status", a.requireDB(a.status))
	mux.HandleFunc("POST /api/auth/setup", a.requireDB(limited(setupLimit, a.setup)))
	mux.HandleFunc("POST /api/auth/login", a.requireDB(limited(loginLimit, a.login)))
	mux.HandleFunc("POST /api/auth/logout", a.logout)
	mux.HandleFunc("GET /api/auth/me", a.requireAuth(a.requireDB(a.me)))
	mux.HandleFunc("GET /api/auth/api-keys", a.requireAuth(humanOnly(a.requireDB(a.listKeys))))
	mux.HandleFunc("POST /api/auth/api-keys", a.requireAuth(humanOnly(a.requireDB(a.createKey))))
	mux.HandleFunc("DELETE /api/auth/api-keys/{id}", a.requireAuth(humanOnly(a.requireDB(a.revokeKey))))

	limiter := httpx.NewLimiter(time.Minute, 300, cfg.TrustedProxies)
	apiLimited := func(next http.Handler) http.Handler {
		limited := limiter.Middleware(next)
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			if r.URL.Path == "/api" || strings.HasPrefix(r.URL.Path, "/api/") {
				limited.ServeHTTP(w, r)
				return
			}
			next.ServeHTTP(w, r)
		})
	}
	return httpx.Chain(mux,
		httpx.Recover(log),
		httpx.AccessLog(log),
		httpx.SecurityHeaders(cfg.CookieSecure),
		httpx.MaxBody(maxJSONBody),
		httpx.CORS(cfg.FrontendOrigin),
		apiLimited,
	)
}
