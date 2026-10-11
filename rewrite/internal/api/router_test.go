package api

import (
	"io"
	"log/slog"
	"net/http"
	"net/http/httptest"
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
