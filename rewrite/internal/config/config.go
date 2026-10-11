// Package config loads runtime settings from the environment.
//
// Names and defaults mirror the TypeScript web server (src/backend/webserver)
// so existing Docker/CasaOS environment files keep working unchanged.
package config

import (
	"os"
	"path/filepath"
	"strconv"
)

// Version is the application version reported by /api/version. It mirrors
// APP_CONFIG.VERSION in the TypeScript backend until the release process
// stamps it at build time.
const Version = "2.7.1"

// Config holds all process-level settings.
type Config struct {
	Port           int    // PORT (default 3000)
	Host           string // DEV_SERVER_URL, the bind address (default 127.0.0.1)
	DataDir        string // DB_DIRECTORY (default "data")
	FrontendDir    string // FRONTEND_DIR: built web app to serve next to the API (empty: API only)
	EncryptionKey  string // ENCRYPTION_KEY: pins the key that protects webhook secrets
	DefaultDB      string // DEFAULT_DATABASE file name inside DataDir; "invoice.db" when NODE_ENV=docker, else none
	FrontendOrigin string // FRONTEND_ORIGIN, else FE_SERVER_URL, else http://127.0.0.1:5173
	CookieSecure   bool   // COOKIE_SECURE == "true"
	TrustedProxies int    // TRUST_PROXY: proxy hops whose X-Forwarded-For to trust for client IPs (default 1, as the TS server did)
	Version        string
}

// Load reads the configuration from the process environment.
func Load() Config { return loadWith(os.LookupEnv) }

// LoadFrom reads the configuration through getenv, which makes it testable.
func LoadFrom(getenv func(string) string) Config {
	return loadWith(func(k string) (string, bool) { v := getenv(k); return v, v != "" })
}

// loadWith takes a lookup that reports whether a variable is set at all, which
// DEFAULT_DATABASE needs: set to empty means "no default database".
func loadWith(lookup func(string) (string, bool)) Config {
	getenv := func(k string) string { v, _ := lookup(k); return v }
	first := func(vals ...string) string {
		for _, v := range vals {
			if v != "" {
				return v
			}
		}
		return ""
	}
	port := 3000
	if p, err := strconv.Atoi(getenv("PORT")); err == nil && p > 0 && p < 65536 {
		port = p
	}
	defaultDB := ""
	if v, ok := lookup("DEFAULT_DATABASE"); ok {
		if v != "" {
			defaultDB = filepath.Base(v) // a bare file name; never a path
		}
	} else if getenv("NODE_ENV") == "docker" {
		defaultDB = "invoice.db"
	}
	feServer := first(getenv("FE_SERVER_URL"), "http://127.0.0.1:5173")
	return Config{
		Port:           port,
		Host:           first(getenv("DEV_SERVER_URL"), "127.0.0.1"),
		DataDir:        first(getenv("DB_DIRECTORY"), "data"),
		FrontendDir:    getenv("FRONTEND_DIR"),
		EncryptionKey:  getenv("ENCRYPTION_KEY"),
		DefaultDB:      defaultDB,
		FrontendOrigin: first(getenv("FRONTEND_ORIGIN"), feServer),
		CookieSecure:   getenv("COOKIE_SECURE") == "true",
		TrustedProxies: trustedProxies(getenv("TRUST_PROXY")),
		Version:        Version,
	}
}

// trustedProxies reads TRUST_PROXY: how many reverse proxies sit in front of
// the server. 1 (the default) suits nginx or Caddy; 0 means clients connect
// directly, so X-Forwarded-For is ignored and cannot be used to dodge the
// per-address rate limits.
func trustedProxies(v string) int {
	if n, err := strconv.Atoi(v); err == nil && n >= 0 && n <= 10 {
		return n
	}
	return 1
}
