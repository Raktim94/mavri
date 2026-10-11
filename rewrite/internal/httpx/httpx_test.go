package httpx

import (
	"encoding/json"
	"io"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"
)

var ok200 = http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) { w.WriteHeader(200) })

func req(remote, xff string) *http.Request {
	r := httptest.NewRequest("GET", "/api/x", nil)
	r.RemoteAddr = remote
	if xff != "" {
		r.Header.Set("X-Forwarded-For", xff)
	}
	return r
}

func TestClientIP(t *testing.T) {
	cases := []struct {
		name, remote, xff string
		hops              int
		want              string
	}{
		{"no proxy header", "10.0.0.1:5000", "", 1, "10.0.0.1"},
		{"one trusted hop uses last xff", "10.0.0.1:5000", "203.0.113.9", 1, "203.0.113.9"},
		{"spoofed leading entries ignored", "10.0.0.1:5000", "1.1.1.1, 203.0.113.9", 1, "203.0.113.9"},
		{"hops 0 ignores header", "10.0.0.1:5000", "203.0.113.9", 0, "10.0.0.1"},
		{"two hops", "10.0.0.1:5000", "203.0.113.9, 10.0.0.2", 2, "203.0.113.9"},
	}
	for _, c := range cases {
		if got := ClientIP(req(c.remote, c.xff), c.hops); got != c.want {
			t.Errorf("%s: got %s want %s", c.name, got, c.want)
		}
	}
}

func TestLimiterBlocksAfterMaxAndResets(t *testing.T) {
	now := time.Unix(1000, 0)
	l := NewLimiter(time.Minute, 3, 0)
	l.Now = func() time.Time { return now }
	h := l.Middleware(ok200)
	do := func() *httptest.ResponseRecorder {
		rec := httptest.NewRecorder()
		h.ServeHTTP(rec, req("192.0.2.1:1", ""))
		return rec
	}
	for i := 0; i < 3; i++ {
		if rec := do(); rec.Code != 200 {
			t.Fatalf("request %d blocked", i+1)
		}
	}
	rec := do()
	if rec.Code != 429 || rec.Header().Get("Retry-After") == "" || rec.Header().Get("RateLimit-Remaining") != "0" {
		t.Fatalf("expected 429 with headers, got %d %v", rec.Code, rec.Header())
	}
	var body map[string]any
	_ = json.Unmarshal(rec.Body.Bytes(), &body)
	if body["success"] != false || body["key"] != "error.rateLimiter" {
		t.Fatalf("bad body: %s", rec.Body.String())
	}
	if _, has := body["message"]; has {
		t.Fatalf("message must be omitted, got %s", rec.Body.String())
	}
	now = now.Add(61 * time.Second)
	if rec := do(); rec.Code != 200 {
		t.Fatal("window did not reset")
	}
}

func TestLimiterIsPerClient(t *testing.T) {
	l := NewLimiter(time.Minute, 1, 0)
	h := l.Middleware(ok200)
	for _, ip := range []string{"192.0.2.1:1", "192.0.2.2:1"} {
		rec := httptest.NewRecorder()
		h.ServeHTTP(rec, req(ip, ""))
		if rec.Code != 200 {
			t.Fatalf("%s blocked", ip)
		}
	}
}

func TestSecurityHeadersAndHSTS(t *testing.T) {
	for _, hsts := range []bool{false, true} {
		rec := httptest.NewRecorder()
		SecurityHeaders(hsts)(ok200).ServeHTTP(rec, req("192.0.2.1:1", ""))
		h := rec.Header()
		if h.Get("X-Content-Type-Options") != "nosniff" || h.Get("Cross-Origin-Resource-Policy") != "same-site" ||
			h.Get("X-Frame-Options") != "SAMEORIGIN" {
			t.Fatalf("missing headers: %v", h)
		}
		if got := h.Get("Strict-Transport-Security") != ""; got != hsts {
			t.Fatalf("hsts=%v but header present=%v", hsts, got)
		}
		if h.Get("Content-Security-Policy") != "" {
			t.Fatal("CSP must stay off for the JSON API")
		}
	}
}

func TestCORSFixedOriginNeverReflects(t *testing.T) {
	h := CORS("https://app.example")(ok200)
	r := httptest.NewRequest("GET", "/api/x", nil)
	r.Header.Set("Origin", "https://evil.example")
	rec := httptest.NewRecorder()
	h.ServeHTTP(rec, r)
	if rec.Header().Get("Access-Control-Allow-Origin") != "https://app.example" ||
		rec.Header().Get("Access-Control-Allow-Credentials") != "true" {
		t.Fatalf("bad CORS headers: %v", rec.Header())
	}
}

func TestCORSPreflight(t *testing.T) {
	h := CORS("https://app.example")(ok200)
	r := httptest.NewRequest("OPTIONS", "/api/x", nil)
	r.Header.Set("Access-Control-Request-Method", "POST")
	r.Header.Set("Access-Control-Request-Headers", "content-type,authorization")
	rec := httptest.NewRecorder()
	h.ServeHTTP(rec, r)
	if rec.Code != 204 || rec.Header().Get("Access-Control-Allow-Headers") != "content-type,authorization" ||
		!strings.Contains(rec.Header().Get("Access-Control-Allow-Methods"), "DELETE") {
		t.Fatalf("bad preflight: %d %v", rec.Code, rec.Header())
	}
}

func TestMaxBody(t *testing.T) {
	h := MaxBody(10)(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if _, err := io.ReadAll(r.Body); err != nil {
			w.WriteHeader(413)
			return
		}
		w.WriteHeader(200)
	}))
	for body, want := range map[string]int{"short": 200, strings.Repeat("x", 11): 413} {
		rec := httptest.NewRecorder()
		h.ServeHTTP(rec, httptest.NewRequest("POST", "/", strings.NewReader(body)))
		if rec.Code != want {
			t.Errorf("len %d: got %d want %d", len(body), rec.Code, want)
		}
	}
}

func TestForwardedForIsIgnoredWithoutAProxy(t *testing.T) {
	r := httptest.NewRequest("GET", "/", nil)
	r.RemoteAddr = "203.0.113.9:5555"
	r.Header.Set("X-Forwarded-For", "1.2.3.4, 5.6.7.8")
	if got := ClientIP(r, 0); got != "203.0.113.9" {
		t.Errorf("a spoofed header must not change the client with no proxy trusted: %q", got)
	}
	if got := ClientIP(r, 1); got != "5.6.7.8" {
		t.Errorf("one trusted proxy: %q", got)
	}
}
