package vies

import (
	"context"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
)

func serve(t *testing.T, status int, body string) (*Client, *string) {
	t.Helper()
	var path string
	s := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		path = r.URL.Path
		w.WriteHeader(status)
		w.Write([]byte(body))
	}))
	t.Cleanup(s.Close)
	return &Client{BaseURL: s.URL}, &path
}

func TestAnActiveNumber(t *testing.T) {
	c, path := serve(t, 200, `{"isValid":true,"requestDate":"2026-10-17T10:00:00Z","name":"ACME SARL","address":"1 RUE X\n75001 PARIS","vatNumber":"AB123456789"}`)
	r, err := c.Check(context.Background(), "fr", "FR AB 123 456 789")
	if err != nil || !r.Valid || r.Unavailable || r.Name != "ACME SARL" || r.Address != "1 RUE X, 75001 PARIS" {
		t.Fatalf("%v %+v", err, r)
	}
	if *path != "/ms/FR/vat/AB123456789" {
		t.Fatalf("the request: %s", *path)
	}
}

func TestAnInactiveNumberIsNotTheSameAsAnUnavailableService(t *testing.T) {
	c, _ := serve(t, 200, `{"isValid":false,"name":"---","address":"---"}`)
	r, _ := c.Check(context.Background(), "DE", "123456789")
	if r.Valid || r.Unavailable || r.Name != "" {
		t.Fatalf("invalid: %+v", r)
	}
	c, _ = serve(t, 200, `{"userError":"MS_UNAVAILABLE"}`)
	if r, _ := c.Check(context.Background(), "DE", "123456789"); !r.Unavailable || r.Valid {
		t.Fatalf("a member state that is down must not read as invalid: %+v", r)
	}
	c, _ = serve(t, 503, `busy`)
	if r, _ := c.Check(context.Background(), "DE", "123456789"); !r.Unavailable {
		t.Fatalf("503: %+v", r)
	}
	c, _ = serve(t, 200, `<html>`)
	if r, _ := c.Check(context.Background(), "DE", "123456789"); !r.Unavailable {
		t.Fatalf("garbage must not read as an answer: %+v", r)
	}
	if r, _ := (&Client{BaseURL: "http://127.0.0.1:1"}).Check(context.Background(), "DE", "123456789"); !r.Unavailable {
		t.Fatalf("unreachable: %+v", r)
	}
}

func TestGreeceUsesEL(t *testing.T) {
	c, path := serve(t, 200, `{"isValid":true}`)
	c.Check(context.Background(), "GR", "EL123456789")
	if !strings.HasPrefix(*path, "/ms/EL/vat/123456789") {
		t.Fatalf("%s", *path)
	}
}

func TestBadInputNeverReachesTheService(t *testing.T) {
	c, path := serve(t, 200, `{"isValid":true}`)
	if _, err := c.Check(context.Background(), "DE", "12/34"); err == nil {
		t.Fatal("a path character was accepted")
	}
	if _, err := c.Check(context.Background(), "", "123"); err == nil {
		t.Fatal("no country")
	}
	if *path != "" {
		t.Fatalf("a request was made: %s", *path)
	}
}
