package web

import (
	"database/sql"
	"log/slog"
	"net/http"
	"os"
	"strconv"
	"time"

	"github.com/Raktim94/mavri/server/internal/auth"
	"github.com/Raktim94/mavri/server/internal/shop"
	"github.com/Raktim94/mavri/server/internal/store"
)

// Version is set at build time with -ldflags "-X .../web.Version=1.2.3".
var Version = "dev"

// Config is read from the environment.
type Config struct {
	Host          string
	Port          int
	DataDir       string
	Database      string // file name inside DataDir
	FrontendDir   string // built web app; empty serves the API only
	CookieSecure  bool
	TrustProxy    int // number of reverse proxies in front (for client addresses)
	EncryptionKey string
}

func env(key, def string) string {
	if v := os.Getenv(key); v != "" {
		return v
	}
	return def
}

// ConfigFromEnv reads PORT, HOST, DB_DIRECTORY, DB_FILE, FRONTEND_DIR, COOKIE_SECURE, TRUST_PROXY and ENCRYPTION_KEY.
func ConfigFromEnv() Config {
	port, _ := strconv.Atoi(env("PORT", "3001"))
	hops, _ := strconv.Atoi(env("TRUST_PROXY", "0"))
	return Config{Host: env("HOST", "0.0.0.0"), Port: port, DataDir: env("DB_DIRECTORY", "./data"), Database: env("DB_FILE", "mavri.db"),
		FrontendDir: os.Getenv("FRONTEND_DIR"), CookieSecure: env("COOKIE_SECURE", "") == "true" || env("COOKIE_SECURE", "") == "1",
		TrustProxy: hops, EncryptionKey: os.Getenv("ENCRYPTION_KEY")}
}

// Server holds what the handlers share.
type Server struct {
	Cfg   Config
	Log   *slog.Logger
	DB    *sql.DB
	Store *store.Store
	Auth  *auth.Service
	Shops *shop.Service

	loginLimit, setupLimit, hookLimit *limiter
}

// New builds the HTTP handler.
func New(cfg Config, log *slog.Logger, d *sql.DB, box *shop.Box) http.Handler {
	st := &store.Store{DB: d}
	s := &Server{Cfg: cfg, Log: log, DB: d, Store: st, Auth: &auth.Service{DB: d}, Shops: &shop.Service{Store: st, Box: box},
		loginLimit: newLimiter(time.Minute, 10), setupLimit: newLimiter(time.Minute, 5), hookLimit: newLimiter(time.Minute, 120)}
	mux := http.NewServeMux()
	s.routes(mux)
	return s.wrap(mux)
}

func (s *Server) routes(mux *http.ServeMux) {
	user := func(h http.HandlerFunc) http.HandlerFunc { return s.auth(false, h) }
	human := func(h http.HandlerFunc) http.HandlerFunc { return s.auth(true, h) }

	mux.HandleFunc("GET /api/health", func(w http.ResponseWriter, r *http.Request) {
		if err := s.DB.PingContext(r.Context()); err != nil {
			fail(w, http.StatusServiceUnavailable, "internal", "database unavailable")
			return
		}
		writeJSON(w, http.StatusOK, map[string]string{"status": "ok"})
	})
	mux.HandleFunc("GET /api/version", func(w http.ResponseWriter, _ *http.Request) {
		writeJSON(w, http.StatusOK, map[string]string{"version": Version})
	})

	// updates
	mux.HandleFunc("GET /api/update/status", user(s.updateStatusHandler))
	mux.HandleFunc("GET /api/update/progress", user(s.updateProgress))
	mux.HandleFunc("POST /api/update", human(s.applyUpdate))

	// sign-in
	mux.HandleFunc("GET /api/setup", s.setupStatus)
	mux.HandleFunc("POST /api/setup", s.limited(s.setupLimit, s.clientIP, s.setup))
	mux.HandleFunc("POST /api/session", s.limited(s.loginLimit, s.clientIP, s.login))
	mux.HandleFunc("GET /api/session", user(s.me))
	mux.HandleFunc("DELETE /api/session", s.logout)
	mux.HandleFunc("GET /api/keys", human(s.listKeys))
	mux.HandleFunc("POST /api/keys", human(s.createKey))
	mux.HandleFunc("DELETE /api/keys/{id}", human(s.revokeKey))

	// records
	order := func(col string) func(*http.Request) (string, []any) {
		return func(*http.Request) (string, []any) { return "ORDER BY " + col, nil }
	}
	crud(s, mux, "/api/parties", store.Parties, store.CheckParty, func(r *http.Request) (string, []any) {
		if k := r.URL.Query().Get("kind"); k != "" {
			return "WHERE kind = ? ORDER BY name COLLATE NOCASE", []any{k}
		}
		return "ORDER BY kind, name COLLATE NOCASE", nil
	})
	crud(s, mux, "/api/currencies", store.Currencies, store.CheckCurrency, order("code"))
	crud(s, mux, "/api/banks", store.Banks, store.CheckBank, order("label COLLATE NOCASE"))
	crud(s, mux, "/api/groups", store.Groups, store.CheckGroup, func(r *http.Request) (string, []any) {
		if k := r.URL.Query().Get("kind"); k != "" {
			return "WHERE kind = ? ORDER BY name COLLATE NOCASE", []any{k}
		}
		return "ORDER BY kind, name COLLATE NOCASE", nil
	})
	crud(s, mux, "/api/products", store.Products, store.CheckProduct, order("name COLLATE NOCASE"))
	crud(s, mux, "/api/styles", store.Styles, store.CheckStyle, order("name COLLATE NOCASE"))
	crud(s, mux, "/api/presets", store.Presets, store.CheckPreset, order("name COLLATE NOCASE"))

	// documents
	mux.HandleFunc("GET /api/documents", user(s.listDocuments))
	mux.HandleFunc("GET /api/documents/next-number", user(s.nextNumber))
	mux.HandleFunc("POST /api/documents", user(s.createDocument))
	mux.HandleFunc("GET /api/documents/{id}", user(s.getDocument))
	mux.HandleFunc("PUT /api/documents/{id}", user(s.updateDocument))
	mux.HandleFunc("DELETE /api/documents/{id}", user(s.deleteDocument))
	mux.HandleFunc("POST /api/documents/{id}/duplicate", user(s.duplicateDocument))
	mux.HandleFunc("POST /api/documents/{id}/convert", user(s.convertDocument))
	mux.HandleFunc("GET /api/documents/{id}/einvoice", user(s.einvoice))
	mux.HandleFunc("GET /api/reports/year", user(s.yearReport))

	// settings and backup
	mux.HandleFunc("GET /api/settings", user(s.getSettings))
	mux.HandleFunc("PUT /api/settings", user(s.putSettings))
	mux.HandleFunc("GET /api/backup", user(s.exportBackup))
	mux.HandleFunc("POST /api/backup", human(s.importBackup))

	// stores
	mux.HandleFunc("GET /api/shops", user(s.listShops))
	mux.HandleFunc("POST /api/shops", user(s.createShop))
	mux.HandleFunc("POST /api/shops/{id}/pause", user(s.pauseShop))
	mux.HandleFunc("DELETE /api/shops/{id}", user(s.deleteShop))
	mux.HandleFunc("POST /api/hooks/{platform}/{id}", s.limited(s.hookLimit, func(r *http.Request) string { return r.PathValue("id") }, s.webhook))

	// public API for other systems (same handlers, stable paths)
	mux.HandleFunc("POST /api/v1/orders", user(s.v1Order))
	mux.HandleFunc("GET /api/v1/documents", user(s.listDocuments))
	mux.HandleFunc("GET /api/v1/documents/{id}", user(s.getDocument))

	mux.Handle("/api/", http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
		fail(w, http.StatusNotFound, "not_found", "no such endpoint")
	}))
	if s.Cfg.FrontendDir != "" {
		mux.Handle("/", spa(s.Cfg.FrontendDir))
	}
}
