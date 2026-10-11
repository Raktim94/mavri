package httpx

import (
	"log/slog"
	"net"
	"net/http"
	"strings"
	"time"
)

// Chain applies middleware so the first argument is the outermost wrapper.
func Chain(h http.Handler, mw ...func(http.Handler) http.Handler) http.Handler {
	for i := len(mw) - 1; i >= 0; i-- {
		h = mw[i](h)
	}
	return h
}

// Recover turns a panic into a 500 without leaking details to the client.
func Recover(log *slog.Logger) func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			defer func() {
				if v := recover(); v != nil {
					log.Error("panic in handler", "method", r.Method, "path", r.URL.Path, "panic", v)
					Fail(w, http.StatusInternalServerError, "error.unknownError")
				}
			}()
			next.ServeHTTP(w, r)
		})
	}
}

type statusWriter struct {
	http.ResponseWriter
	status int
}

func (s *statusWriter) WriteHeader(code int) { s.status = code; s.ResponseWriter.WriteHeader(code) }

// AccessLog logs method, path, status and duration only. It never logs query
// strings, headers, cookies or bodies, which can carry credentials or invoice data.
func AccessLog(log *slog.Logger) func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			start := time.Now()
			sw := &statusWriter{ResponseWriter: w, status: http.StatusOK}
			next.ServeHTTP(sw, r)
			log.Info("request", "method", r.Method, "path", r.URL.Path, "status", sw.status, "ms", time.Since(start).Milliseconds())
		})
	}
}

// SecurityHeaders sets the Helmet defaults the TypeScript server used, with
// the content-security-policy left off and Cross-Origin-Resource-Policy set
// to same-site. HSTS is sent only when TLS is terminated in front of us.
// The exact header set must be confirmed against a captured TS response by
// the API contract tests before this row is marked done in the parity matrix.
func SecurityHeaders(hsts bool) func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			h := w.Header()
			h.Set("Cross-Origin-Opener-Policy", "same-origin")
			h.Set("Cross-Origin-Resource-Policy", "same-site")
			h.Set("Origin-Agent-Cluster", "?1")
			h.Set("Referrer-Policy", "no-referrer")
			h.Set("X-Content-Type-Options", "nosniff")
			h.Set("X-DNS-Prefetch-Control", "off")
			h.Set("X-Download-Options", "noopen")
			h.Set("X-Frame-Options", "SAMEORIGIN")
			h.Set("X-Permitted-Cross-Domain-Policies", "none")
			h.Set("X-XSS-Protection", "0")
			if hsts {
				h.Set("Strict-Transport-Security", "max-age=15552000; includeSubDomains")
			}
			next.ServeHTTP(w, r)
		})
	}
}

// CORS allows exactly one configured origin with credentials, as the TS
// server did. It never reflects the request's Origin.
func CORS(origin string) func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			h := w.Header()
			h.Set("Access-Control-Allow-Origin", origin)
			h.Add("Vary", "Origin")
			h.Set("Access-Control-Allow-Credentials", "true")
			if r.Method == http.MethodOptions && r.Header.Get("Access-Control-Request-Method") != "" {
				h.Set("Access-Control-Allow-Methods", "GET,HEAD,PUT,PATCH,POST,DELETE")
				if reqH := r.Header.Get("Access-Control-Request-Headers"); reqH != "" {
					h.Add("Vary", "Access-Control-Request-Headers")
					h.Set("Access-Control-Allow-Headers", reqH)
				}
				h.Set("Content-Length", "0")
				w.WriteHeader(http.StatusNoContent)
				return
			}
			next.ServeHTTP(w, r)
		})
	}
}

// MaxBody caps request bodies (50 MB for JSON, as before). Reads past the
// limit fail, so handlers cannot be made to buffer unbounded input.
func MaxBody(limit int64) func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			r.Body = http.MaxBytesReader(w, r.Body, limit)
			next.ServeHTTP(w, r)
		})
	}
}

// ClientIP returns the caller's address, trusting `hops` reverse proxies.
// With hops=1 (nginx/CasaOS in front) it is the last X-Forwarded-For entry,
// matching Express `trust proxy = 1`. With hops=0 forwarded headers are ignored.
func ClientIP(r *http.Request, hops int) string {
	remote, _, err := net.SplitHostPort(r.RemoteAddr)
	if err != nil {
		remote = r.RemoteAddr
	}
	if hops <= 0 {
		return remote
	}
	var chain []string
	for _, part := range strings.Split(strings.Join(r.Header.Values("X-Forwarded-For"), ","), ",") {
		if p := strings.TrimSpace(part); p != "" {
			chain = append(chain, p)
		}
	}
	chain = append(chain, remote)
	idx := len(chain) - 1 - hops
	if idx < 0 {
		idx = 0
	}
	return chain[idx]
}
