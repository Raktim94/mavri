package api

import (
	"io"
	"log/slog"
	"net/http"
	"net/http/httptest"
	"os"
	"path/filepath"
	"strings"
	"testing"

	"github.com/Raktim94/nodedr-invoice/rewrite/internal/config"
)

func handler() http.Handler {
	cfg := config.LoadFrom(func(string) string { return "" })
	return NewHandler(cfg, slog.New(slog.NewJSONHandler(io.Discard, nil)), nil, nil)
}

func get(t *testing.T, path string) *httptest.ResponseRecorder {
	t.Helper()
	rec := httptest.NewRecorder()
	handler().ServeHTTP(rec, httptest.NewRequest("GET", path, nil))
	return rec
}

func TestPublicEndpointsMatchTypeScriptShapes(t *testing.T) {
	cases := map[string]string{
		"/api/health":          `{"ok":true}`,
		"/api/version":         `{"version":"2.7.1"}`,
		"/api/databases/ready": `{"success":true,"data":{"ready":false}}`,
	}
	for path, want := range cases {
		rec := get(t, path)
		if rec.Code != 200 || strings.TrimSpace(rec.Body.String()) != want {
			t.Errorf("%s: %d %q want %q", path, rec.Code, rec.Body.String(), want)
		}
		if ct := rec.Header().Get("Content-Type"); !strings.HasPrefix(ct, "application/json") {
			t.Errorf("%s content-type %q", path, ct)
		}
	}
}

func TestMiddlewareStackApplied(t *testing.T) {
	rec := get(t, "/api/health")
	if rec.Header().Get("X-Content-Type-Options") != "nosniff" ||
		rec.Header().Get("Access-Control-Allow-Origin") != "http://127.0.0.1:5173" ||
		rec.Header().Get("RateLimit-Limit") != "300" {
		t.Fatalf("stack headers missing: %v", rec.Header())
	}
}

func TestGlobalRateLimit(t *testing.T) {
	h := handler()
	var last int
	for i := 0; i < 301; i++ {
		rec := httptest.NewRecorder()
		r := httptest.NewRequest("GET", "/api/health", nil)
		r.RemoteAddr = "192.0.2.7:9"
		h.ServeHTTP(rec, r)
		last = rec.Code
	}
	if last != 429 {
		t.Fatalf("301st request got %d, want 429", last)
	}
}

func TestPostToReadOnlyRouteRejected(t *testing.T) {
	rec := httptest.NewRecorder()
	handler().ServeHTTP(rec, httptest.NewRequest("POST", "/api/health", nil))
	if rec.Code != http.StatusMethodNotAllowed {
		t.Fatalf("got %d", rec.Code)
	}
}

func TestServesTheWebAppNextToTheAPI(t *testing.T) {
	dir := t.TempDir()
	os.WriteFile(filepath.Join(dir, "index.html"), []byte("<html>app</html>"), 0o644)
	os.MkdirAll(filepath.Join(dir, "assets"), 0o755)
	os.WriteFile(filepath.Join(dir, "assets", "app.js"), []byte("console.log(1)"), 0o644)
	os.WriteFile(filepath.Join(filepath.Dir(dir), "secret.txt"), []byte("outside"), 0o644)
	h := NewHandler(config.LoadFrom(func(k string) string {
		if k == "FRONTEND_DIR" {
			return dir
		}
		return ""
	}), slog.New(slog.NewJSONHandler(io.Discard, nil)), nil, nil)
	get := func(p string) *httptest.ResponseRecorder {
		rec := httptest.NewRecorder()
		h.ServeHTTP(rec, httptest.NewRequest("GET", p, nil))
		return rec
	}
	if r := get("/"); r.Code != 200 || !strings.Contains(r.Body.String(), "app") || r.Header().Get("Cache-Control") != "no-cache" {
		t.Errorf("/: %d %q %q", r.Code, r.Body.String(), r.Header().Get("Cache-Control"))
	}
	if r := get("/assets/app.js"); r.Code != 200 || r.Body.String() != "console.log(1)" {
		t.Errorf("asset: %d %q", r.Code, r.Body.String())
	}
	if r := get("/invoices/42"); r.Code != 200 || !strings.Contains(r.Body.String(), "app") {
		t.Errorf("client route should fall back to the page: %d %q", r.Code, r.Body.String())
	}
	for _, p := range []string{"/../secret.txt", "/assets/../../secret.txt", "/%2e%2e/secret.txt"} {
		if r := get(p); strings.Contains(r.Body.String(), "outside") {
			t.Errorf("%s escaped the directory", p)
		}
	}
	if r := get("/api/nope"); r.Code != 404 || !strings.Contains(r.Body.String(), "error.notFound") {
		t.Errorf("unknown api path: %d %q", r.Code, r.Body.String())
	}
	if r := get("/api/health"); r.Code != 200 || r.Body.String() != "{\"ok\":true}\n" {
		t.Errorf("the API still answers: %d %q", r.Code, r.Body.String())
	}
}
