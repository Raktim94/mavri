// Package config loads runtime settings from the environment.
//
// Names and defaults mirror the TypeScript web server (src/backend/webserver)
// so existing Docker/CasaOS environment files keep working unchanged.
package config

import (
	"os"
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
	FrontendOrigin string // FRONTEND_ORIGIN, else FE_SERVER_URL, else http://127.0.0.1:5173
	CookieSecure   bool   // COOKIE_SECURE == "true"
	TrustedProxies int    // proxy hops to trust for client IPs (TS: trust proxy = 1)
	Version        string
}

// Load reads the configuration from the process environment.
func Load() Config { return LoadFrom(os.Getenv) }

// LoadFrom reads the configuration through getenv, which makes it testable.
func LoadFrom(getenv func(string) string) Config {
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
	feServer := first(getenv("FE_SERVER_URL"), "http://127.0.0.1:5173")
	return Config{
		Port:           port,
		Host:           first(getenv("DEV_SERVER_URL"), "127.0.0.1"),
		DataDir:        first(getenv("DB_DIRECTORY"), "data"),
		FrontendOrigin: first(getenv("FRONTEND_ORIGIN"), feServer),
		CookieSecure:   getenv("COOKIE_SECURE") == "true",
		TrustedProxies: 1,
		Version:        Version,
	}
}
