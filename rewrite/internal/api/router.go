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
)

const maxJSONBody = 50 << 20 // 50 MB, same as the TypeScript server

// NewHandler builds the full HTTP handler with the middleware stack in the
// same order as the TypeScript server: headers, body limit, CORS, then the
// global /api rate limit (300 requests per minute per client).
func NewHandler(cfg config.Config, log *slog.Logger) http.Handler {
	mux := http.NewServeMux()
	mux.HandleFunc("GET /api/health", func(w http.ResponseWriter, _ *http.Request) {
		httpx.WriteJSON(w, http.StatusOK, map[string]bool{"ok": true})
	})
	mux.HandleFunc("GET /api/version", func(w http.ResponseWriter, _ *http.Request) {
		httpx.WriteJSON(w, http.StatusOK, map[string]string{"version": cfg.Version})
	})
	// No database layer yet, so the service is never "ready". The renderer
	// uses this to decide whether to show the database chooser.
	mux.HandleFunc("GET /api/databases/ready", func(w http.ResponseWriter, _ *http.Request) {
		httpx.OK(w, map[string]bool{"ready": false})
	})

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
