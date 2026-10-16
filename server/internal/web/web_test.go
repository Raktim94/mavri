package web

import (
	"bytes"
	"compress/gzip"
	"encoding/json"
	"io"
	"log/slog"
	"mime/multipart"
	"net/http"
	"net/http/cookiejar"
	"net/http/httptest"
	"os"
	"path/filepath"
	"strings"
	"testing"

	"github.com/Raktim94/mavri/server/internal/auth"
	"github.com/Raktim94/mavri/server/internal/db"
	"github.com/Raktim94/mavri/server/internal/shop"
)

type client struct {
	t   *testing.T
	srv *httptest.Server
	c   *http.Client
	key string
}

func newClient(t *testing.T, cfg Config) *client {
	t.Helper()
	auth.Iterations = 10
	d, err := db.Open(":memory:")
	if err != nil {
		t.Fatal(err)
	}
	box, _ := shop.NewBox(t.TempDir(), "")
	srv := httptest.NewServer(New(cfg, slog.New(slog.NewTextHandler(io.Discard, nil)), d, box))
	t.Cleanup(func() { srv.Close(); d.Close() })
	jar, _ := cookiejar.New(nil)
	return &client{t: t, srv: srv, c: &http.Client{Jar: jar, CheckRedirect: func(*http.Request, []*http.Request) error { return http.ErrUseLastResponse }}}
}

func (c *client) do(method, path string, body any, headers ...string) (int, []byte) {
	c.t.Helper()
	var rd io.Reader
	switch b := body.(type) {
	case nil:
	case []byte:
		rd = bytes.NewReader(b)
	case string:
		rd = strings.NewReader(b)
	default:
		raw, _ := json.Marshal(b)
		rd = bytes.NewReader(raw)
	}
	req, _ := http.NewRequest(method, c.srv.URL+path, rd)
	if rd != nil {
		req.Header.Set("Content-Type", "application/json")
	}
	if c.key != "" {
		req.Header.Set("Authorization", "Bearer "+c.key)
	}
	for i := 0; i+1 < len(headers); i += 2 {
		req.Header.Set(headers[i], headers[i+1])
	}
	res, err := c.c.Do(req)
	if err != nil {
		c.t.Fatal(err)
	}
	defer res.Body.Close()
	out, _ := io.ReadAll(res.Body)
	return res.StatusCode, out
}

func (c *client) json(method, path string, body any, want int) map[string]any {
	c.t.Helper()
	code, raw := c.do(method, path, body)
	if code != want {
		c.t.Fatalf("%s %s: status %d, want %d: %s", method, path, code, want, raw)
	}
	var out map[string]any
	_ = json.Unmarshal(raw, &out)
	return out
}

func (c *client) list(path string) []any {
	c.t.Helper()
	code, raw := c.do("GET", path, nil)
	if code != 200 {
		c.t.Fatalf("GET %s: %d %s", path, code, raw)
	}
	var out []any
	if err := json.Unmarshal(raw, &out); err != nil {
		c.t.Fatalf("GET %s: not a list: %s", path, raw)
	}
	return out
}

func id(m map[string]any) float64 { return m["id"].(float64) }

func signedIn(t *testing.T) *client {
	c := newClient(t, Config{})
	c.json("POST", "/api/setup", map[string]string{"email": "o@x.co", "password": "password1"}, 201)
	return c
}

func TestSetupLoginLogoutAndErrors(t *testing.T) {
	c := newClient(t, Config{})
	if st := c.json("GET", "/api/setup", nil, 200); st["needsSetup"] != true {
		t.Fatal("fresh install needs setup")
	}
	c.json("GET", "/api/documents", nil, 401)
	c.json("POST", "/api/setup", map[string]string{"email": "bad", "password": "password1"}, 400)
	c.json("POST", "/api/setup", map[string]string{"email": "o@x.co", "password": "weak"}, 400)
	c.json("POST", "/api/setup", map[string]string{"email": "o@x.co", "password": "password1"}, 201)
	c.json("POST", "/api/setup", map[string]string{"email": "z@x.co", "password": "password1"}, 403)
	if me := c.json("GET", "/api/session", nil, 200); me["email"] != "o@x.co" {
		t.Fatalf("me: %v", me)
	}
	c.json("DELETE", "/api/session", nil, 204)
	c.json("GET", "/api/session", nil, 401)
	c.json("POST", "/api/session", map[string]string{"email": "o@x.co", "password": "nope"}, 401)
	c.json("POST", "/api/session", map[string]string{"email": "o@x.co", "password": "password1"}, 200)
	c.json("GET", "/api/session", nil, 200)
	c.json("GET", "/api/health", nil, 200)
	c.json("GET", "/api/nothing-here", nil, 404)
}

func TestLoginRateLimit(t *testing.T) {
	c := newClient(t, Config{})
	got429 := false
	for i := 0; i < 15; i++ {
		if code, _ := c.do("POST", "/api/session", map[string]string{"email": "a@b.co", "password": "x"}); code == 429 {
			got429 = true
		}
	}
	if !got429 {
		t.Fatal("login is not rate limited")
	}
}

func TestCrossSiteWritesRefused(t *testing.T) {
	c := signedIn(t)
	code, _ := c.do("POST", "/api/parties", map[string]string{"kind": "customer", "name": "X"}, "Origin", "https://evil.example")
	if code != 403 {
		t.Fatalf("cross-site POST allowed: %d", code)
	}
	if code, _ := c.do("POST", "/api/parties", map[string]string{"kind": "customer", "name": "X"}, "Origin", c.srv.URL); code != 201 {
		t.Fatalf("same-origin POST refused: %d", code)
	}
}

func TestRecordsCRUD(t *testing.T) {
	c := signedIn(t)
	p := c.json("POST", "/api/parties", map[string]any{"kind": "customer", "name": " Acme ", "country": "de"}, 201)
	if p["name"] != "Acme" || p["country"] != "DE" {
		t.Fatalf("not normalised: %v", p)
	}
	c.json("POST", "/api/parties", map[string]any{"kind": "other", "name": "X"}, 400)
	c.json("POST", "/api/parties", map[string]any{"kind": "customer", "name": ""}, 400)
	p["email"] = "a@acme.example"
	if u := c.json("PUT", "/api/parties/1", p, 200); u["email"] != "a@acme.example" {
		t.Fatalf("update: %v", u)
	}
	c.json("PUT", "/api/parties/99", p, 404)
	if n := len(c.list("/api/parties?kind=customer")); n != 1 {
		t.Fatalf("filter: %d", n)
	}
	if n := len(c.list("/api/parties?kind=issuer")); n != 0 {
		t.Fatalf("filter: %d", n)
	}
	if n := len(c.list("/api/currencies")); n < 10 {
		t.Fatalf("currencies were not seeded: %d", n)
	}
	cur := c.json("POST", "/api/currencies", map[string]any{"code": "xts", "symbol": "T", "name": "Test", "decimals": 3}, 201)
	if cur["code"] != "XTS" {
		t.Fatalf("code: %v", cur)
	}
	c.json("POST", "/api/currencies", map[string]any{"code": "XTS", "symbol": "T", "name": "Dup"}, 409)
	g := c.json("POST", "/api/groups", map[string]any{"kind": "unit", "name": "hour"}, 201)
	prod := c.json("POST", "/api/products", map[string]any{"name": "Consulting", "priceCents": 15000, "unitId": id(g)}, 201)
	if prod["unitId"] != id(g) {
		t.Fatalf("product: %v", prod)
	}
	c.json("DELETE", "/api/groups/"+jsonNum(id(g)), nil, 204) // products keep working: unit set to null
	if got := c.json("GET", "/api/products/"+jsonNum(id(prod)), nil, 200); got["unitId"] != nil {
		t.Fatalf("unit not cleared: %v", got)
	}
	c.json("POST", "/api/styles", map[string]any{"name": "Bold", "accent": "red"}, 400)
	c.json("POST", "/api/styles", map[string]any{"name": "Bold", "accent": "#112233"}, 201)
	c.json("POST", "/api/banks", map[string]any{"label": "Main"}, 201)
	c.json("DELETE", "/api/parties/1", nil, 204)
	c.json("DELETE", "/api/parties/1", nil, 404)
}

func jsonNum(f float64) string { b, _ := json.Marshal(int64(f)); return string(b) }

func setupParties(c *client) (issuer, customer float64) {
	i := c.json("POST", "/api/parties", map[string]any{"kind": "issuer", "name": "Northwind", "country": "DE", "taxId": "DE1",
		"eScheme": "9930", "eAddress": "DE1", "email": "a@n.example", "phone": "1", "address": "Str 1\n20457 Hamburg"}, 201)
	k := c.json("POST", "/api/parties", map[string]any{"kind": "customer", "name": "Acme", "country": "DE", "eScheme": "0204",
		"eAddress": "991-1", "buyerReference": "BR-1", "address": "Pl 2\n10115 Berlin"}, 201)
	return id(i), id(k)
}

func TestDocumentFlow(t *testing.T) {
	c := signedIn(t)
	issuer, customer := setupParties(c)
	doc := map[string]any{"kind": "invoice", "issuerId": issuer, "customerId": customer, "currencyId": 2, "issuedOn": "2026-10-01", "dueOn": "2026-10-31",
		"lines": []any{map[string]any{"name": "Work", "quantity": 3, "unitCents": 10000, "taxRate": 19, "taxMode": "add"}}}
	d := c.json("POST", "/api/documents", doc, 201)
	totals := d["totals"].(map[string]any)
	if d["fullNumber"] != "1" || totals["totalCents"] != float64(35700) || d["status"] != "unpaid" {
		t.Fatalf("created: %v", d)
	}
	c.json("POST", "/api/documents", map[string]any{"kind": "invoice"}, 400)
	c.json("POST", "/api/documents", "not json", 400)
	docID := jsonNum(id(d))

	// payments change the status
	doc["payments"] = []any{map[string]any{"amountCents": 35700, "paidOn": "2026-10-05", "method": "bank"}}
	if u := c.json("PUT", "/api/documents/"+docID, doc, 200); u["status"] != "paid" || u["paidCents"] != float64(35700) {
		t.Fatalf("paid: %v", u)
	}
	// list summaries
	list := c.json("GET", "/api/documents?kind=invoice&status=paid&q=acme", nil, 200)
	items := list["items"].([]any)
	if list["total"] != float64(1) || items[0].(map[string]any)["totalCents"] != float64(35700) || items[0].(map[string]any)["customerName"] != "Acme" {
		t.Fatalf("list: %v", list)
	}
	if got := c.json("GET", "/api/documents?kind=quote", nil, 200); got["total"] != float64(0) {
		t.Fatalf("quotes: %v", got)
	}
	if nn := c.json("GET", "/api/documents/next-number?kind=invoice&issuerId="+jsonNum(issuer), nil, 200); nn["number"] != "2" {
		t.Fatalf("next number: %v", nn)
	}
	// e-invoice
	code, raw := c.do("GET", "/api/documents/"+docID+"/einvoice?format=ubl", nil)
	if code != 200 || !strings.Contains(string(raw), "<cbc:ID>1</cbc:ID>") {
		t.Fatalf("ubl: %d %s", code, raw)
	}
	code, raw = c.do("GET", "/api/documents/"+docID+"/einvoice?format=xrechnung", nil)
	if code != 200 || !strings.Contains(string(raw), "xrechnung_3.0") {
		t.Fatalf("xrechnung: %d %s", code, raw)
	}
	// duplicate, quote, convert
	if dup := c.json("POST", "/api/documents/"+docID+"/duplicate", nil, 201); dup["fullNumber"] != "2" {
		t.Fatalf("duplicate: %v", dup["fullNumber"])
	}
	q := c.json("POST", "/api/documents", map[string]any{"kind": "quote", "issuerId": issuer, "customerId": customer, "currencyId": 2, "issuedOn": "2026-10-02",
		"lines": []any{map[string]any{"name": "Plan", "quantity": 1, "unitCents": 5000}}}, 201)
	if q["fullNumber"] != "Q-1" {
		t.Fatalf("quote number: %v", q["fullNumber"])
	}
	conv := c.json("POST", "/api/documents/"+jsonNum(id(q))+"/convert", nil, 201)
	if conv["kind"] != "invoice" || conv["convertedFrom"] != id(q) {
		t.Fatalf("convert: %v", conv)
	}
	c.json("POST", "/api/documents/"+jsonNum(id(q))+"/convert", nil, 400)
	// quote cannot be exported
	c.json("GET", "/api/documents/"+jsonNum(id(q))+"/einvoice", nil, 422)
	c.json("DELETE", "/api/documents/"+docID, nil, 204)
	c.json("GET", "/api/documents/"+docID, nil, 404)
	// customers in use cannot be deleted
	c.json("DELETE", "/api/parties/"+jsonNum(customer), nil, 409)
	// report
	rep := c.json("GET", "/api/reports/year?year=2026", nil, 200)
	if len(rep["byMonth"].([]any)) != 1 {
		t.Fatalf("report: %v", rep)
	}
}

func TestEInvoiceIncompleteAndSwitchedOff(t *testing.T) {
	c := signedIn(t)
	i := c.json("POST", "/api/parties", map[string]any{"kind": "issuer", "name": "Me"}, 201)
	k := c.json("POST", "/api/parties", map[string]any{"kind": "customer", "name": "You"}, 201)
	d := c.json("POST", "/api/documents", map[string]any{"kind": "invoice", "issuerId": id(i), "customerId": id(k), "currencyId": 1, "issuedOn": "2026-10-01",
		"lines": []any{map[string]any{"name": "W", "quantity": 1, "unitCents": 100}}}, 201)
	out := c.json("GET", "/api/documents/"+jsonNum(id(d))+"/einvoice?format=xrechnung", nil, 422)
	e := out["error"].(map[string]any)
	if e["code"] != "einvoice_incomplete" || len(e["problems"].([]any)) < 4 {
		t.Fatalf("problems: %v", e)
	}
	set := c.json("GET", "/api/settings", nil, 200)
	set["features"].(map[string]any)["ubl"] = false
	c.json("PUT", "/api/settings", set, 200)
	c.json("GET", "/api/documents/"+jsonNum(id(d))+"/einvoice?format=ubl", nil, 403)
}

func TestSettings(t *testing.T) {
	c := signedIn(t)
	s := c.json("GET", "/api/settings", nil, 200)
	if s["dateFormat"] != "yyyy-MM-dd" {
		t.Fatalf("defaults: %v", s)
	}
	s["invoicePrefix"] = "INV-"
	c.json("PUT", "/api/settings", s, 200)
	if got := c.json("GET", "/api/settings", nil, 200); got["invoicePrefix"] != "INV-" {
		t.Fatalf("not saved: %v", got)
	}
	s["invoicePrefix"] = strings.Repeat("x", 30)
	c.json("PUT", "/api/settings", s, 400)
}

func TestAPIKeys(t *testing.T) {
	c := signedIn(t)
	made := c.json("POST", "/api/keys", map[string]string{"label": "ci"}, 201)
	secret := made["secret"].(string)
	if !strings.HasPrefix(secret, "mvr_") {
		t.Fatalf("secret: %s", secret)
	}
	if n := len(c.list("/api/keys")); n != 1 {
		t.Fatal("key list")
	}
	k := newClient(t, Config{})
	_ = k
	// A second client with only the key (no cookie jar state) can read, but not manage keys.
	c2 := &client{t: t, srv: c.srv, c: &http.Client{}, key: secret}
	c2.json("GET", "/api/v1/documents", nil, 200)
	c2.json("GET", "/api/keys", nil, 403)
	c2.json("POST", "/api/backup", nil, 403)
	c.json("DELETE", "/api/keys/"+jsonNum(id(made["key"].(map[string]any))), nil, 204)
	c2.json("GET", "/api/v1/documents", nil, 401)
	c3 := &client{t: t, srv: c.srv, c: &http.Client{}, key: "mvr_wrong"}
	c3.json("GET", "/api/v1/documents", nil, 401)
}

func TestShopsWebhooksAndV1(t *testing.T) {
	c := signedIn(t)
	issuer, _ := setupParties(c)
	created := c.json("POST", "/api/shops", map[string]any{"name": "Shop", "platform": "generic", "issuerId": issuer, "currencyId": 1, "defaultTax": 10, "markPaid": true}, 201)
	secret := created["secret"].(string)
	shopID := jsonNum(id(created["shop"].(map[string]any)))
	hookURL := created["shop"].(map[string]any)["webhookUrl"].(string)
	if !strings.HasSuffix(hookURL, "/api/hooks/generic/"+shopID) {
		t.Fatalf("webhook url: %s", hookURL)
	}
	c.json("POST", "/api/shops", map[string]any{"name": "", "platform": "generic"}, 400)

	body := `{"externalOrderId":"W-1","customer":{"name":"Zed","email":"z@x.co"},"lineItems":[{"name":"Hat","quantity":2,"unitPriceMajor":12.5}],"paid":true}`
	post := func(sig string) (int, map[string]any) {
		code, raw := c.do("POST", "/api/hooks/generic/"+shopID, body, "X-Webhook-Signature", sig)
		var out map[string]any
		_ = json.Unmarshal(raw, &out)
		return code, out
	}
	if code, _ := post("deadbeef"); code != 401 {
		t.Fatalf("bad signature accepted: %d", code)
	}
	code, first := post(shop.Sign("generic", []byte(body), secret))
	if code != 201 || first["duplicate"] != false {
		t.Fatalf("first delivery: %d %v", code, first)
	}
	code, again := post(shop.Sign("generic", []byte(body), secret))
	if code != 200 || again["duplicate"] != true || again["documentId"] != first["documentId"] {
		t.Fatalf("repeat delivery: %d %v", code, again)
	}
	inv := c.json("GET", "/api/documents/"+jsonNum(first["documentId"].(float64)), nil, 200)
	if inv["status"] != "paid" || inv["totals"].(map[string]any)["totalCents"] != float64(2750) {
		t.Fatalf("invoice from order: %v", inv["totals"])
	}
	// v1 order API with an API key
	key := c.json("POST", "/api/keys", map[string]string{"label": "store"}, 201)["secret"].(string)
	api := &client{t: t, srv: c.srv, c: &http.Client{}, key: key}
	api.json("POST", "/api/v1/orders", `{"externalOrderId":"V-1","lineItems":[{"name":"X","quantity":1,"unitPriceMajor":1}]}`, 400) // no shopId
	v1 := `{"shopId":` + shopID + `,"externalOrderId":"V-1","customer":{"name":"Q"},"lineItems":[{"name":"X","quantity":1,"unitPriceMajor":1}]}`
	before := len(c.json("GET", "/api/documents", nil, 200)["items"].([]any))
	pv := api.json("POST", "/api/v1/orders?dryRun=1", v1, 200)
	if pv["dryRun"] != true || pv["duplicate"] != false || pv["customer"].(map[string]any)["willCreate"] != true || pv["totals"].(map[string]any)["totalCents"] != float64(110) || len(pv["warnings"].([]any)) == 0 {
		t.Fatalf("dry run: %v", pv)
	}
	if after := len(c.json("GET", "/api/documents", nil, 200)["items"].([]any)); after != before {
		t.Fatalf("a dry run created an invoice: %d -> %d", before, after)
	}
	if out := api.json("POST", "/api/v1/orders", v1, 201); out["duplicate"] != false {
		t.Fatalf("v1: %v", out)
	}
	if out := api.json("POST", "/api/v1/orders", v1, 200); out["duplicate"] != true {
		t.Fatalf("v1 repeat: %v", out)
	}
	if pv := api.json("POST", "/api/v1/orders?dryRun=1", v1, 200); pv["duplicate"] != true || pv["customer"].(map[string]any)["willCreate"] != false {
		t.Fatalf("dry run after the order exists: %v", pv)
	}
	// pause, then deliveries are refused
	c.json("POST", "/api/shops/"+shopID+"/pause", nil, 204)
	if code, _ := post(shop.Sign("generic", []byte(body), secret)); code != 403 {
		t.Fatalf("paused shop accepted an order: %d", code)
	}
	api.json("POST", "/api/v1/orders", v1, 403)
	if shops := c.list("/api/shops"); shops[0].(map[string]any)["active"] != false {
		t.Fatal("shop still active")
	}
	c.json("DELETE", "/api/shops/"+shopID, nil, 204)
	if code, _ := post("x"); code != 404 {
		t.Fatalf("deleted shop: %d", code)
	}
}

func TestBackupRoundTripOverHTTP(t *testing.T) {
	c := signedIn(t)
	issuer, customer := setupParties(c)
	c.json("POST", "/api/documents", map[string]any{"kind": "invoice", "issuerId": issuer, "customerId": customer, "currencyId": 1, "issuedOn": "2026-10-01",
		"lines": []any{map[string]any{"name": "W", "quantity": 1, "unitCents": 100}}}, 201)
	code, gz := c.do("GET", "/api/backup", nil)
	if code != 200 {
		t.Fatalf("export: %d", code)
	}
	if zr, err := gzip.NewReader(bytes.NewReader(gz)); err != nil {
		t.Fatal("export is not gzip")
	} else if raw, _ := io.ReadAll(zr); !strings.Contains(string(raw), `"app":"mavri"`) {
		t.Fatal("export is not a Mavri backup")
	}
	c.json("DELETE", "/api/documents/1", nil, 204)

	upload := func(name string, data []byte) int {
		var buf bytes.Buffer
		mw := multipart.NewWriter(&buf)
		fw, _ := mw.CreateFormFile("file", name)
		fw.Write(data)
		mw.Close()
		req, _ := http.NewRequest("POST", c.srv.URL+"/api/backup", &buf)
		req.Header.Set("Content-Type", mw.FormDataContentType())
		res, err := c.c.Do(req)
		if err != nil {
			t.Fatal(err)
		}
		res.Body.Close()
		return res.StatusCode
	}
	if code := upload("b.json.gz", []byte("plain text")); code != 400 {
		t.Fatalf("garbage accepted: %d", code)
	}
	if code := upload("b.json.gz", gz); code != 204 {
		t.Fatalf("restore: %d", code)
	}
	if list := c.json("GET", "/api/documents", nil, 200); list["total"] != float64(1) {
		t.Fatalf("restore did not bring the invoice back: %v", list)
	}
}

func TestServesTheApp(t *testing.T) {
	dir := t.TempDir()
	os.MkdirAll(filepath.Join(dir, "assets"), 0o755)
	os.WriteFile(filepath.Join(dir, "index.html"), []byte("<html>app</html>"), 0o644)
	os.WriteFile(filepath.Join(dir, "assets", "a.js"), []byte("js"), 0o644)
	c := newClient(t, Config{FrontendDir: dir})
	for path, want := range map[string]int{"/": 200, "/invoices/5": 200, "/assets/a.js": 200, "/assets/missing.js": 404, "/api/nope": 404} {
		if code, _ := c.do("GET", path, nil); code != want {
			t.Errorf("GET %s = %d, want %d", path, code, want)
		}
	}
	if code, body := c.do("GET", "/invoices/5", nil); code != 200 || !strings.Contains(string(body), "app") {
		t.Error("deep link does not serve the app")
	}
	if code, _ := c.do("GET", "/../etc/passwd", nil); code == 200 {
		t.Error("path traversal served a file")
	}
}
