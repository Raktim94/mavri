package web

import (
	"context"
	"database/sql"
	"log/slog"
	"net/http"
	"os"
	"path/filepath"
	"strconv"
	"strings"
	"time"

	"github.com/Raktim94/mavri/server/internal/activity"
	"github.com/Raktim94/mavri/server/internal/auth"
	"github.com/Raktim94/mavri/server/internal/automation"
	"github.com/Raktim94/mavri/server/internal/backup"
	"github.com/Raktim94/mavri/server/internal/collections"
	"github.com/Raktim94/mavri/server/internal/mailer"
	"github.com/Raktim94/mavri/server/internal/payments"
	"github.com/Raktim94/mavri/server/internal/share"
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

	Hub     *activity.Hub
	Links   *share.Links
	Mail    *mailer.Service
	Auto    *automation.Service
	Backups *backup.Service
	Pay     *payments.Service
	Coll    *collections.Service
	Errors  *ErrorLog // recent warnings and errors, for the health page
	Started time.Time

	loginLimit, setupLimit, hookLimit, publicLimit *limiter
}

// New builds the HTTP handler.
func New(cfg Config, log *slog.Logger, d *sql.DB, box *shop.Box) http.Handler {
	h, _ := Build(cfg, log, d, box)
	return h
}

// Build builds the HTTP handler and the server behind it. Call Start on the server to run the background jobs.
func Build(cfg Config, log *slog.Logger, d *sql.DB, box *shop.Box) (http.Handler, *Server) {
	st := &store.Store{DB: d}
	hub := &activity.Hub{DB: d, Box: box, Log: log}
	links := &share.Links{DB: d}
	ml := &mailer.Service{DB: d, Box: box, Store: st, Links: links, Hub: hub}
	s := &Server{Cfg: cfg, Log: log, DB: d, Store: st, Auth: &auth.Service{DB: d}, Shops: &shop.Service{Store: st, Box: box},
		Hub: hub, Links: links, Mail: ml, Started: time.Now(), Errors: errorLogFrom(log),
		loginLimit: newLimiter(time.Minute, 10), setupLimit: newLimiter(time.Minute, 5), hookLimit: newLimiter(time.Minute, 120), publicLimit: newLimiter(time.Minute, 60)}
	s.Auto = &automation.Service{DB: d, Store: st, Mail: ml, Hub: hub}
	s.Auto.BaseURL = func(ctx context.Context) string {
		c, _ := s.Auto.Load(ctx)
		return strings.TrimRight(c.PublicURL, "/")
	}
	s.Coll = &collections.Service{DB: d, Store: st, Hub: hub}
	s.Pay = &payments.Service{DB: d, Box: box, Store: st, Hub: hub}
	s.Backups = &backup.Service{DB: d, Box: box, Dir: filepath.Join(cfg.DataDir, "backups"), Hub: hub}
	mux := http.NewServeMux()
	s.routes(mux)
	return s.wrap(mux), s
}

// Start runs the background jobs (webhook deliveries, reminders, recurring invoices, scheduled backups) until ctx ends.
func (s *Server) Start(ctx context.Context) {
	logf := func(msg string, args ...any) { s.Log.Warn(msg, args...) }
	go s.Hub.Run(ctx)
	go s.Auto.Run(ctx, logf)
	go s.Backups.Run(ctx, logf)
}

func (s *Server) routes(mux *http.ServeMux) {
	user := func(h http.HandlerFunc) http.HandlerFunc { return s.auth(false, h) }
	human := func(h http.HandlerFunc) http.HandlerFunc { return s.auth(true, h) }
	// ownerHuman is for what only a signed-in owner may do: settings, keys, payments, backups, webhooks and people.
	ownerHuman := func(h http.HandlerFunc) http.HandlerFunc { return s.authRole(true, true, h) }
	owner := func(h http.HandlerFunc) http.HandlerFunc { return s.authRole(false, true, h) }

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
	mux.HandleFunc("POST /api/update", ownerHuman(s.applyUpdate))

	// sign-in
	mux.HandleFunc("GET /api/setup", s.setupStatus)
	mux.HandleFunc("POST /api/setup", s.limited(s.setupLimit, s.clientIP, s.setup))
	mux.HandleFunc("POST /api/session", s.limited(s.loginLimit, s.clientIP, s.login))
	mux.HandleFunc("GET /api/session", user(s.me))
	mux.HandleFunc("DELETE /api/session", s.logout)
	mux.HandleFunc("GET /api/keys", ownerHuman(s.listKeys))
	mux.HandleFunc("POST /api/keys", ownerHuman(s.createKey))
	mux.HandleFunc("DELETE /api/keys/{id}", ownerHuman(s.revokeKey))

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
	mux.HandleFunc("POST /api/documents/bulk", human(s.bulkDocuments))
	mux.HandleFunc("GET /api/documents/{id}", user(s.getDocument))
	mux.HandleFunc("PUT /api/documents/{id}", user(s.updateDocument))
	mux.HandleFunc("DELETE /api/documents/{id}", user(s.deleteDocument))
	mux.HandleFunc("POST /api/documents/{id}/duplicate", user(s.duplicateDocument))
	mux.HandleFunc("POST /api/documents/{id}/convert", user(s.convertDocument))
	mux.HandleFunc("GET /api/documents/{id}/einvoice", user(s.einvoice))
	mux.HandleFunc("POST /api/documents/{id}/issue", user(s.issueDocument))
	mux.HandleFunc("GET /api/documents/{id}/corrections", user(s.listCorrections))
	mux.HandleFunc("POST /api/documents/{id}/corrections", user(s.createCorrection))
	mux.HandleFunc("GET /api/reports/year", user(s.yearReport))

	// settings and backup
	mux.HandleFunc("GET /api/settings", user(s.getSettings))
	mux.HandleFunc("PUT /api/settings", owner(s.putSettings))
	mux.HandleFunc("GET /api/backup", user(s.exportBackup))
	mux.HandleFunc("POST /api/backup", ownerHuman(s.importBackup))

	// share links, email, reminders
	mux.HandleFunc("GET /api/documents/{id}/share", user(s.getShare))
	mux.HandleFunc("POST /api/documents/{id}/share", user(s.createShare))
	mux.HandleFunc("DELETE /api/documents/{id}/share", user(s.revokeShare))
	mux.HandleFunc("POST /api/documents/{id}/email/preview", user(s.emailPreview))
	mux.HandleFunc("POST /api/documents/{id}/email", human(s.emailSend))
	mux.HandleFunc("GET /api/documents/{id}/mail", user(s.documentMail))
	mux.HandleFunc("GET /api/mail/log", user(s.mailLog))
	mux.HandleFunc("GET /api/mail/config", ownerHuman(s.getMailConfig))
	mux.HandleFunc("PUT /api/mail/config", ownerHuman(s.putMailConfig))
	mux.HandleFunc("POST /api/mail/test", ownerHuman(s.mailTest))
	mux.HandleFunc("GET /api/automation", user(s.getAutomation))
	mux.HandleFunc("PUT /api/automation", ownerHuman(s.putAutomation))
	mux.HandleFunc("GET /api/overdue", user(s.overdue))
	mux.HandleFunc("GET /api/recurring", user(s.listRecurring))
	mux.HandleFunc("POST /api/recurring", user(s.createRecurring))
	mux.HandleFunc("POST /api/recurring/preview", user(s.previewDraftRecurring))
	mux.HandleFunc("PUT /api/recurring/{id}", user(s.updateRecurring))
	mux.HandleFunc("DELETE /api/recurring/{id}", user(s.deleteRecurring))
	mux.HandleFunc("GET /api/recurring/{id}/preview", user(s.previewRecurring))

	// collections: promises, disputes, pauses and the daily list
	mux.HandleFunc("GET /api/attention", user(s.attention))
	mux.HandleFunc("GET /api/documents/{id}/follow-ups", user(s.listFollowUps))
	mux.HandleFunc("POST /api/documents/{id}/follow-ups", user(s.addFollowUp))
	mux.HandleFunc("POST /api/follow-ups/{id}/resolve", user(s.resolveFollowUp))
	mux.HandleFunc("GET /api/documents/{id}/payment-options", user(s.paymentOptions))
	mux.HandleFunc("GET /api/public/documents/{token}/payment-options", s.limited(s.publicLimit, s.clientIP, s.publicPaymentOptions))

	// people
	mux.HandleFunc("GET /api/users", ownerHuman(s.listUsers))
	mux.HandleFunc("POST /api/users", ownerHuman(s.createUser))
	mux.HandleFunc("PUT /api/users/{id}", ownerHuman(s.updateUser))
	mux.HandleFunc("DELETE /api/users/{id}", ownerHuman(s.deleteUser))
	mux.HandleFunc("POST /api/session/password", s.authRole(true, false, s.changePassword))

	// tax guidance
	mux.HandleFunc("GET /api/tax/packs", user(s.taxPacks))
	mux.HandleFunc("POST /api/tax/explain", user(s.taxExplain))
	mux.HandleFunc("GET /api/tax/validate", user(s.taxValidate))

	// activity history
	mux.HandleFunc("GET /api/activity", user(s.listActivity))
	mux.HandleFunc("GET /api/activity.csv", human(s.activityCSV))

	// webhooks
	mux.HandleFunc("GET /api/webhooks", ownerHuman(s.listWebhooks))
	mux.HandleFunc("POST /api/webhooks", ownerHuman(s.createWebhook))
	mux.HandleFunc("GET /api/webhooks/deliveries", ownerHuman(s.listDeliveries))
	mux.HandleFunc("POST /api/webhooks/deliveries/{id}/replay", ownerHuman(s.replayDelivery))
	mux.HandleFunc("PUT /api/webhooks/{id}", ownerHuman(s.updateWebhook))
	mux.HandleFunc("DELETE /api/webhooks/{id}", ownerHuman(s.deleteWebhook))
	mux.HandleFunc("POST /api/webhooks/{id}/test", ownerHuman(s.testWebhook))

	// CSV
	mux.HandleFunc("GET /api/export/{file}", user(s.exportCSV))
	mux.HandleFunc("POST /api/import/{kind}", human(s.importCSV))

	// backups
	mux.HandleFunc("GET /api/backups", ownerHuman(s.backupStatus))
	mux.HandleFunc("PUT /api/backups/config", ownerHuman(s.putBackupConfig))
	mux.HandleFunc("POST /api/backups/run", ownerHuman(s.runBackup))
	mux.HandleFunc("POST /api/backups/test-s3", ownerHuman(s.testS3))
	mux.HandleFunc("GET /api/backups/s3", ownerHuman(s.listS3Backups))
	mux.HandleFunc("GET /api/backups/files/{name}", ownerHuman(s.downloadBackupFile))
	mux.HandleFunc("POST /api/backups/verify", ownerHuman(s.verifyBackup))
	mux.HandleFunc("POST /api/backups/restore", ownerHuman(s.restoreBackup))

	// health and the API description
	mux.HandleFunc("GET /api/admin/health", ownerHuman(s.health))
	mux.HandleFunc("GET /api/openapi.yaml", s.openapi)

	// what a client sees through a secure link (no sign-in)
	mux.HandleFunc("GET /api/public/documents/{token}", s.limited(s.publicLimit, s.clientIP, s.publicGet))
	mux.HandleFunc("POST /api/public/documents/{token}/respond", s.limited(s.publicLimit, s.clientIP, s.publicRespond))

	// online payments
	mux.HandleFunc("GET /api/payments/config", ownerHuman(s.getPayConfig))
	mux.HandleFunc("PUT /api/payments/config", ownerHuman(s.putPayConfig))
	mux.HandleFunc("GET /api/public/documents/{token}/options", s.limited(s.publicLimit, s.clientIP, s.publicOptions))
	mux.HandleFunc("GET /api/public/documents/{token}/einvoice", s.limited(s.publicLimit, s.clientIP, s.publicEInvoice))
	mux.HandleFunc("POST /api/public/documents/{token}/pay", s.limited(s.publicLimit, s.clientIP, s.publicPay))
	mux.HandleFunc("POST /api/hooks/stripe", s.limited(s.hookLimit, s.clientIP, s.stripeHook))

	// stores
	mux.HandleFunc("GET /api/shops", user(s.listShops))
	mux.HandleFunc("POST /api/shops", owner(s.createShop))
	mux.HandleFunc("POST /api/shops/{id}/pause", owner(s.pauseShop))
	mux.HandleFunc("DELETE /api/shops/{id}", owner(s.deleteShop))
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
