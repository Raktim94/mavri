package api

import (
	"bytes"
	"crypto/hmac"
	"crypto/sha256"
	"encoding/base64"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"net/http"
	"net/http/httptest"
	"testing"
)

// store signs and posts a webhook like an online shop would.
func (e *env) hook(t *testing.T, platform string, id any, secret string, doc any, hexSig bool) reply {
	t.Helper()
	body, _ := json.Marshal(doc)
	mac := hmac.New(sha256.New, []byte(secret))
	mac.Write(body)
	header, sig := "X-Shopify-Hmac-Sha256", base64.StdEncoding.EncodeToString(mac.Sum(nil))
	if hexSig {
		header, sig = "X-Webhook-Signature", hex.EncodeToString(mac.Sum(nil))
	}
	req := httptest.NewRequest("POST", fmt.Sprintf("/api/webhooks/ecommerce/%s/%v", platform, id), bytes.NewReader(body))
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set(header, sig)
	rec := httptest.NewRecorder()
	e.h.ServeHTTP(rec, req)
	var m map[string]any
	_ = json.Unmarshal(rec.Body.Bytes(), &m)
	return reply{Code: rec.Code, Body: m}
}

func shopEnv(t *testing.T) (*env, func(method, path, body string) reply, string, float64) {
	e, do := invoiceEnv(t)
	do("POST", "/api/currencies", `{"code":"USD","symbol":"$","text":"Dollar","format":"{symbol}{amount}","subunit":100}`)
	made := do("POST", "/api/ecommerce/integrations", `{"name":"Shop","platform":"generic","businessId":1,"currencyId":1,"defaultTaxRate":8}`)
	if made.Body["success"] != true {
		t.Fatalf("integration: %v", made.Body)
	}
	return e, do, made.data()["webhookSecret"].(string), made.data()["integration"].(map[string]any)["id"].(float64)
}

func generic(id string, name, email string) map[string]any {
	return map[string]any{"externalOrderId": id, "customer": map[string]any{"name": name, "email": email},
		"lineItems": []any{map[string]any{"name": "Widget", "quantity": 2, "unitPriceMajor": 12.5}}, "shippingMajor": 5}
}

func TestSecretIsShownOnceAndStoredEncrypted(t *testing.T) {
	e, do, secret, id := shopEnv(t)
	var stored string
	e.sql.DB().QueryRow(`SELECT "webhookSecretEncrypted" FROM ecommerce_integrations WHERE "id" = ?`, id).Scan(&stored)
	if stored == "" || stored == secret {
		t.Fatalf("the secret must be encrypted at rest: %q", stored)
	}
	list := do("GET", "/api/ecommerce/integrations", "")
	row := rows(t, list)[0]
	if _, has := row["webhookSecretEncrypted"]; has {
		t.Error("the encrypted secret must not be listed")
	}
	if want := fmt.Sprintf("/api/webhooks/ecommerce/generic/%v", id); row["webhookUrl"] == nil || !bytes.HasSuffix([]byte(row["webhookUrl"].(string)), []byte(want)) {
		t.Errorf("webhookUrl: %v", row["webhookUrl"])
	}
	if row["autoIssue"] != float64(1) || row["isActive"] != float64(1) {
		t.Errorf("flags stay 0/1: %v %v", row["autoIssue"], row["isActive"])
	}
}

// The old server could not create a client from an order unless the customer's
// name fit the two-letter short name column; Go derives the short name.
func TestNewCustomerWithALongNameGetsAClient(t *testing.T) {
	e, do, secret, id := shopEnv(t)
	r := e.hook(t, "generic", id, secret, generic("L-1", "Alexandria Smith", "alex@shop.test"), true)
	if r.Code != 200 || r.Body["success"] != true {
		t.Fatalf("webhook: %d %v", r.Code, r.Body)
	}
	var short, name string
	e.sql.DB().QueryRow(`SELECT "name","shortName" FROM clients WHERE "email" = 'alex@shop.test'`).Scan(&name, &short)
	if name != "Alexandria Smith" || short != "Al" {
		t.Errorf("client: %q %q", name, short)
	}
	// The same email later reuses the client and never overwrites it.
	e.hook(t, "generic", id, secret, generic("L-2", "Someone Else", "alex@shop.test"), true)
	var n int
	e.sql.DB().QueryRow(`SELECT COUNT(*) FROM clients WHERE "email" = 'alex@shop.test'`).Scan(&n)
	if n != 1 {
		t.Errorf("repeat customer duplicated: %d", n)
	}
	inv := rows(t, do("GET", "/api/invoices?type=invoice", ""))
	if len(inv) != 2 {
		t.Fatalf("invoices: %d", len(inv))
	}
}

func TestOrderBecomesAnInvoice(t *testing.T) {
	e, do, secret, id := shopEnv(t)
	r := e.hook(t, "generic", id, secret, generic("O-1", "Zo", "zo@shop.test"), true)
	invID := r.data()["invoiceId"]
	inv := do("GET", fmt.Sprintf("/api/v1/invoices/%v", invID), "").data()
	if inv["status"] != "open" || inv["taxRate"] != float64(8) || inv["shippingFeeCents"] != "500" {
		t.Errorf("invoice: status=%v tax=%v shipping=%v", inv["status"], inv["taxRate"], inv["shippingFeeCents"])
	}
	line := inv["invoiceItems"].([]any)[0].(map[string]any)
	if line["quantity"] != "2" || line["invoiceItemSnapshot"].(map[string]any)["unitPriceCents"] != "1250" {
		t.Errorf("line: %v", line)
	}
	// Redelivery: same invoice, nothing new.
	again := e.hook(t, "generic", id, secret, generic("O-1", "Zo", "zo@shop.test"), true)
	if again.data()["deduplicated"] != true || again.data()["invoiceId"] != invID {
		t.Errorf("redelivery: %v", again.Body)
	}
	var orders int
	e.sql.DB().QueryRow(`SELECT COUNT(*) FROM ecommerce_orders WHERE "status" = 'processed'`).Scan(&orders)
	if orders != 1 {
		t.Errorf("ledger rows: %d", orders)
	}
}

func TestDeletingTheBusinessRemovesItsIntegration(t *testing.T) {
	e, do, secret, id := shopEnv(t)
	do("DELETE", "/api/businesses/1", "")
	if r := e.hook(t, "generic", id, secret, generic("F-1", "Zo", "zo@shop.test"), true); r.Code != 404 {
		t.Fatalf("integration gone: %d %v", r.Code, r.Body)
	}
}

func TestFailedOrderIsRecordedAndCanBeRetried(t *testing.T) {
	e, _, secret, id := shopEnv(t)
	nameless := generic("R-1", "Zo", "nobody@x.test")
	nameless["customer"] = map[string]any{"email": "nobody@x.test"} // a customer with no name cannot become a client
	r := e.hook(t, "generic", id, secret, nameless, true)
	if r.Code != 500 || r.key() != "error.unknownError" {
		t.Fatalf("expected a server-side failure: %d %v", r.Code, r.Body)
	}
	var status, msg string
	e.sql.DB().QueryRow(`SELECT "status", COALESCE("errorMessage",'') FROM ecommerce_orders WHERE "externalOrderId" = 'R-1'`).Scan(&status, &msg)
	if status != "failed" || msg == "" {
		t.Errorf("ledger: %q %q", status, msg)
	}
	// The store retries with the order fixed: the same ledger row is reused.
	ok := e.hook(t, "generic", id, secret, generic("R-1", "Zo", "nobody@x.test"), true)
	if ok.Code != 200 || ok.data()["invoiceNumber"] == nil {
		t.Fatalf("retry: %d %v", ok.Code, ok.Body)
	}
	var n int
	e.sql.DB().QueryRow(`SELECT COUNT(*) FROM ecommerce_orders WHERE "externalOrderId" = 'R-1'`).Scan(&n)
	e.sql.DB().QueryRow(`SELECT "status" FROM ecommerce_orders WHERE "externalOrderId" = 'R-1'`).Scan(&status)
	if n != 1 || status != "processed" {
		t.Errorf("after retry: %d rows, status %q", n, status)
	}
}

func TestWebhookRejectsWhatItShould(t *testing.T) {
	e, do, secret, id := shopEnv(t)
	cases := []struct {
		name     string
		platform string
		id       any
		secret   string
		code     int
	}{
		{"wrong secret", "generic", id, secret + "x", 401},
		{"unknown platform", "magento", id, secret, 404},
		{"platform differs", "shopify", id, secret, 404},
		{"unknown id", "generic", 4242, secret, 404},
	}
	for _, c := range cases {
		if r := e.hook(t, c.platform, c.id, c.secret, generic("X", "Zo", "z@z.test"), true); r.Code != c.code {
			t.Errorf("%s: %d %v", c.name, r.Code, r.Body)
		}
	}
	do("POST", fmt.Sprintf("/api/ecommerce/integrations/%v/deactivate", id), "")
	if r := e.hook(t, "generic", id, secret, generic("X", "Zo", "z@z.test"), true); r.Code != 404 {
		t.Errorf("deactivated integration must look unknown: %d", r.Code)
	}
}

func TestWebhookRateLimitIsPerIntegration(t *testing.T) {
	e, _, secret, id := shopEnv(t)
	bad := generic("", "Zo", "z@z.test") // 400, but still counted
	for i := 1; i <= 61; i++ {
		r := e.hook(t, "generic", id, secret, bad, true)
		want := 400
		if i == 61 {
			want = 429
		}
		if r.Code != want {
			t.Fatalf("request %d: %d", i, r.Code)
		}
	}
	// Another integration id has its own budget.
	if r := e.hook(t, "generic", 4242, secret, bad, true); r.Code != 404 {
		t.Errorf("other id: %d", r.Code)
	}
}

func TestPublicAPIFiltersByClientIDProperly(t *testing.T) {
	e, do, secret, id := shopEnv(t)
	e.hook(t, "generic", id, secret, generic("A", "Zo", "zo@x.test"), true)
	e.hook(t, "generic", id, secret, generic("B", "Yi", "yi@x.test"), true)
	all := do("GET", "/api/v1/invoices", "").data()
	if all["total"] != float64(2) {
		t.Fatalf("total: %v", all)
	}
	// The old server compared the id with client names, so this always came back empty.
	byClient := do("GET", "/api/v1/invoices?clientId=2", "").data()
	if byClient["total"] != float64(2-1) {
		t.Errorf("filter by client id: %v", byClient)
	}
	if page := do("GET", "/api/v1/invoices?limit=1&offset=1", "").data(); page["total"] != float64(2) || len(page["items"].([]any)) != 1 {
		t.Errorf("paging: %v", page)
	}
}

func TestV1OrdersNeedsAuthAndValidInput(t *testing.T) {
	e, do, _, id := shopEnv(t)
	if r := e.do("POST", "/api/v1/orders", "{}", nil, nil); r.Code != 401 {
		t.Errorf("auth: %d", r.Code)
	}
	body := fmt.Sprintf(`{"integrationId":%v,"externalOrderId":"V-1","customer":{"name":"Yi","email":"yi@x.test"},"lineItems":[{"name":"Widget","quantity":1,"unitPriceMajor":12.5}]}`, id)
	if r := do("POST", "/api/v1/orders", body); r.Code != 201 || r.Body["success"] != true {
		t.Errorf("create: %d %v", r.Code, r.Body)
	}
	if r := do("POST", "/api/v1/orders", body); r.Code != 200 || r.data()["deduplicated"] != true {
		t.Errorf("dedup: %d %v", r.Code, r.Body)
	}
}

var _ = http.StatusOK
