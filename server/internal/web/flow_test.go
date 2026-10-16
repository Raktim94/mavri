package web

import (
	"bytes"
	"crypto/hmac"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"io"
	"log/slog"
	"mime/multipart"
	"net/http"
	"net/http/cookiejar"
	"net/http/httptest"
	"net/url"
	"strconv"
	"strings"
	"testing"
	"time"

	"github.com/Raktim94/mavri/server/internal/auth"
	"github.com/Raktim94/mavri/server/internal/db"
	"github.com/Raktim94/mavri/server/internal/mailer"
	"github.com/Raktim94/mavri/server/internal/shop"
)

// newFlow is signedIn with access to the server, for the background pieces.
func newFlow(t *testing.T) (*client, *Server) {
	t.Helper()
	auth.Iterations = 10
	d, err := db.Open(":memory:")
	if err != nil {
		t.Fatal(err)
	}
	box, _ := shop.NewBox(t.TempDir(), "")
	h, s := Build(Config{DataDir: t.TempDir()}, slog.New(slog.NewTextHandler(io.Discard, nil)), d, box)
	srv := httptest.NewServer(h)
	t.Cleanup(func() { srv.Close(); d.Close() })
	jar, _ := cookiejar.New(nil)
	c := &client{t: t, srv: srv, c: &http.Client{Jar: jar, CheckRedirect: func(*http.Request, []*http.Request) error { return http.ErrUseLastResponse }}}
	c.json("POST", "/api/setup", map[string]string{"email": "o@x.co", "password": "password1"}, 201)
	return c, s
}

// anonymous is a visitor with no session, such as a client opening a link.
func (c *client) anonymous() *client {
	return &client{t: c.t, srv: c.srv, c: &http.Client{}}
}

func (c *client) invoice(issuer, customer float64, extra map[string]any) map[string]any {
	doc := map[string]any{"kind": "invoice", "issuerId": issuer, "customerId": customer, "currencyId": 2, "issuedOn": "2026-10-01", "dueOn": "2026-10-31",
		"lines": []any{map[string]any{"name": "Work", "quantity": 1, "unitCents": 10000}}}
	for k, v := range extra {
		doc[k] = v
	}
	return c.json("POST", "/api/documents", doc, 201)
}

func upload(t *testing.T, c *client, path, field, name, content string, fields map[string]string) (int, []byte) {
	t.Helper()
	var buf bytes.Buffer
	mw := multipart.NewWriter(&buf)
	fw, _ := mw.CreateFormFile(field, name)
	fw.Write([]byte(content))
	for k, v := range fields {
		mw.WriteField(k, v)
	}
	mw.Close()
	req, _ := http.NewRequest("POST", c.srv.URL+path, &buf)
	req.Header.Set("Content-Type", mw.FormDataContentType())
	res, err := c.c.Do(req)
	if err != nil {
		t.Fatal(err)
	}
	defer res.Body.Close()
	out, _ := io.ReadAll(res.Body)
	return res.StatusCode, out
}

func TestSecureLinkShowsOnlyThatDocumentAndCanBeRevoked(t *testing.T) {
	c, _ := newFlow(t)
	issuer, customer := setupParties(c)
	doc := c.invoice(issuer, customer, nil)
	other := c.invoice(issuer, customer, nil)
	path := "/api/documents/" + jsonNum(id(doc)) + "/share"

	anon := c.anonymous()
	anon.json("POST", path, nil, 401) // creating a link needs a session
	link := c.json("POST", path, nil, 200)["link"].(map[string]any)
	token := link["token"].(string)
	if len(token) < 30 || !strings.HasSuffix(link["url"].(string), "/d/"+token) {
		t.Fatalf("link: %v", link)
	}
	if again := c.json("POST", path, nil, 200)["link"].(map[string]any); again["token"] != token {
		t.Fatal("sharing twice must not mint a second link")
	}

	pub := anon.json("GET", "/api/public/documents/"+token, nil, 200)
	if pub["id"] != id(doc) || pub["fullNumber"] != doc["fullNumber"] {
		t.Fatalf("public view shows the wrong document: %v", pub)
	}
	if _, has := pub["attachments"]; has && pub["attachments"] != nil {
		t.Fatalf("attachments must not be public: %v", pub["attachments"])
	}
	_ = other
	anon.json("GET", "/api/public/documents/not-a-real-token-at-all-0000", nil, 404)
	if st := c.json("GET", path, nil, 200)["link"].(map[string]any); st["views"] != float64(1) {
		t.Fatalf("views: %v", st)
	}
	// The link opens nothing but that one document, and writes nothing.
	anon.json("GET", "/api/documents/"+jsonNum(id(doc)), nil, 401)
	anon.json("POST", "/api/public/documents/"+token+"/respond", map[string]any{"action": "accept"}, 400) // an invoice cannot be accepted

	c.json("DELETE", path, nil, 204)
	anon.json("GET", "/api/public/documents/"+token, nil, 404)
}

func TestClientAcceptsAQuoteAndTheRuleDraftsAnInvoice(t *testing.T) {
	c, _ := newFlow(t)
	issuer, customer := setupParties(c)
	q := c.json("POST", "/api/documents", map[string]any{"kind": "quote", "issuerId": issuer, "customerId": customer, "currencyId": 2, "issuedOn": "2026-10-02",
		"lines": []any{map[string]any{"name": "Plan", "quantity": 1, "unitCents": 5000}}}, 201)
	qid := jsonNum(id(q))
	token := c.json("POST", "/api/documents/"+qid+"/share", nil, 200)["link"].(map[string]any)["token"].(string)
	c.json("PUT", "/api/automation", map[string]any{"quoteAcceptedMakesInvoice": true, "remindBefore": []int{3}, "remindAfter": []int{3}}, 200)

	anon := c.anonymous()
	anon.json("POST", "/api/public/documents/"+token+"/respond", map[string]any{"action": "maybe"}, 400)
	got := anon.json("POST", "/api/public/documents/"+token+"/respond", map[string]any{"action": "accept", "message": "Go ahead"}, 200)
	if got["status"] != "accepted" {
		t.Fatalf("status: %v", got["status"])
	}
	anon.json("POST", "/api/public/documents/"+token+"/respond", map[string]any{"action": "decline"}, 409) // already answered

	inv := c.json("GET", "/api/documents?kind=invoice", nil, 200)
	if inv["total"] != float64(1) {
		t.Fatalf("the rule should have drafted one invoice: %v", inv)
	}

	// The history shows who did it and where from.
	act := c.json("GET", "/api/activity?entity=quote", nil, 200)
	var sawPublic bool
	for _, it := range act["items"].([]any) {
		e := it.(map[string]any)
		if e["source"] == "public" && e["action"] == "accepted" && strings.Contains(e["detail"].(string), "Go ahead") {
			sawPublic = true
		}
	}
	if !sawPublic {
		t.Fatalf("the client's acceptance is missing from the history: %v", act["items"])
	}
}

func TestActivityRecordsUIAndAPISourcesAndExports(t *testing.T) {
	c, _ := newFlow(t)
	issuer, customer := setupParties(c)
	doc := c.invoice(issuer, customer, nil)
	key := c.json("POST", "/api/keys", map[string]string{"label": "ci"}, 201)["secret"].(string)
	api := &client{t: t, srv: c.srv, c: &http.Client{}, key: key}
	api.json("PUT", "/api/documents/"+jsonNum(id(doc)), map[string]any{"kind": "invoice", "issuerId": issuer, "customerId": customer, "currencyId": 2, "issuedOn": "2026-10-01",
		"status": "void", "lines": []any{map[string]any{"name": "Work", "quantity": 1, "unitCents": 10000}}}, 200)

	act := c.json("GET", "/api/activity?entity=invoice", nil, 200)
	seen := map[string]string{}
	for _, it := range act["items"].([]any) {
		e := it.(map[string]any)
		seen[e["action"].(string)] = e["source"].(string) + "/" + e["actor"].(string)
	}
	if seen["created"] != "ui/o@x.co" {
		t.Fatalf("created: %v", seen)
	}
	if !strings.HasPrefix(seen["voided"], "api/API key #") {
		t.Fatalf("voided: %v", seen)
	}
	code, raw := c.do("GET", "/api/activity.csv?source=api", nil)
	if code != 200 || !strings.Contains(string(raw), "voided") || strings.Contains(string(raw), ",created,") {
		t.Fatalf("csv: %d\n%s", code, raw)
	}
	// An API key cannot download the whole history.
	if code, _ := api.do("GET", "/api/activity.csv", nil); code != 403 {
		t.Fatalf("api key export: %d", code)
	}
}

func TestWebhookEndpointsDeliverAndReplay(t *testing.T) {
	c, s := newFlow(t)
	var got []map[string]any
	var sigs []string
	recv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		var m map[string]any
		json.NewDecoder(r.Body).Decode(&m)
		got = append(got, m)
		sigs = append(sigs, r.Header.Get("Mavri-Signature"))
	}))
	defer recv.Close()
	c.json("POST", "/api/webhooks", map[string]any{"url": "ftp://nope"}, 400)
	created := c.json("POST", "/api/webhooks", map[string]any{"url": recv.URL, "events": []string{"invoice.created"}}, 201)
	if !strings.HasPrefix(created["secret"].(string), "whsec_") {
		t.Fatalf("secret: %v", created)
	}
	ep := created["endpoint"].(map[string]any)
	// The secret is never shown again.
	code, raw := c.do("GET", "/api/webhooks", nil)
	if code != 200 || strings.Contains(string(raw), "whsec_") {
		t.Fatalf("list leaks the secret: %s", raw)
	}
	issuer, customer := setupParties(c)
	c.invoice(issuer, customer, nil)
	s.Hub.DeliverDue(t.Context(), &http.Client{})
	if len(got) != 1 || got[0]["type"] != "invoice.created" || !strings.HasPrefix(sigs[0], "t=") {
		t.Fatalf("delivery: %v %v", got, sigs)
	}
	ds := c.list("/api/webhooks/deliveries?endpointId=" + jsonNum(id(ep)))
	if len(ds) != 1 || ds[0].(map[string]any)["status"] != "delivered" {
		t.Fatalf("log: %v", ds)
	}
	c.json("POST", "/api/webhooks/deliveries/"+jsonNum(id(ds[0].(map[string]any)))+"/replay", nil, 202)
	c.json("POST", "/api/webhooks/"+jsonNum(id(ep))+"/test", nil, 202)
	s.Hub.DeliverDue(t.Context(), &http.Client{})
	if len(got) != 3 || got[2]["type"] != "ping" {
		t.Fatalf("after replay and test: %d %v", len(got), got)
	}
	c.json("PUT", "/api/webhooks/"+jsonNum(id(ep)), map[string]any{"url": recv.URL, "events": []string{"invoice.created"}, "active": false}, 204)
	c.invoice(issuer, customer, nil)
	s.Hub.DeliverDue(t.Context(), &http.Client{})
	if len(got) != 3 {
		t.Fatal("a paused endpoint received an event")
	}
	c.json("DELETE", "/api/webhooks/"+jsonNum(id(ep)), nil, 204)
}

func TestEmailFromTheInvoice(t *testing.T) {
	c, s := newFlow(t)
	var raws []string
	s.Mail.Send = func(_ mailer.Config, _ string, to []string, raw []byte) error {
		raws = append(raws, to[0]+"\n"+string(raw))
		return nil
	}
	issuer, customer := setupParties(c)
	c.json("PUT", "/api/parties/"+jsonNum(customer), map[string]any{"kind": "customer", "name": "Acme", "email": "ap@acme.example"}, 200)
	doc := c.invoice(issuer, customer, nil)
	path := "/api/documents/" + jsonNum(id(doc))

	// Not configured: a clear, actionable error rather than a silent failure.
	code, raw := c.do("POST", path+"/email", map[string]any{"to": "ap@acme.example"})
	if code != 409 || !strings.Contains(string(raw), "email_not_configured") {
		t.Fatalf("unconfigured: %d %s", code, raw)
	}
	c.json("PUT", "/api/mail/config", map[string]any{"enabled": true, "host": "smtp.test", "port": 587, "security": "starttls", "from": "bill@n.example", "password": "pw"}, 200)
	if cfg := c.json("GET", "/api/mail/config", nil, 200); cfg["password"] != nil && cfg["password"] != "" || cfg["passwordSet"] != true {
		t.Fatalf("config leaks the password: %v", cfg)
	}
	pre := c.json("POST", path+"/email/preview", map[string]any{}, 200)
	if pre["to"] != "ap@acme.example" || !strings.Contains(pre["body"].(string), "{{link}}") || pre["configured"] != true {
		t.Fatalf("preview: %v", pre)
	}
	if l := c.json("GET", path+"/share", nil, 200); l["link"] != nil {
		t.Fatalf("previewing created a link: %v", l)
	}
	c.json("POST", path+"/email", map[string]any{"to": "ap@acme.example", "subject": pre["subject"], "body": pre["body"]}, 200)
	if len(raws) != 1 || !strings.HasPrefix(raws[0], "ap@acme.example\n") || strings.Contains(raws[0], "{{link}}") || !strings.Contains(raws[0], "/d/") {
		t.Fatalf("sent: %v", raws)
	}
	log := c.list(path + "/mail")
	if len(log) != 1 || log[0].(map[string]any)["status"] != "sent" {
		t.Fatalf("mail log: %v", log)
	}
	c.json("POST", path+"/email", map[string]any{"to": "bad address"}, 400)
	// An API key may not send mail: that needs a person.
	key := c.json("POST", "/api/keys", map[string]string{"label": "k"}, 201)["secret"].(string)
	api := &client{t: t, srv: c.srv, c: &http.Client{}, key: key}
	if code, _ := api.do("POST", path+"/email", map[string]any{}); code != 403 {
		t.Fatalf("api key sent mail: %d", code)
	}
}

func TestRecurringAndRemindersEndpoints(t *testing.T) {
	c, s := newFlow(t)
	issuer, customer := setupParties(c)
	doc := c.invoice(issuer, customer, nil)
	rec := c.json("POST", "/api/recurring", map[string]any{"documentId": id(doc), "every": "month", "interval": 1, "startOn": "2026-01-15"}, 201)
	pv := c.json("GET", "/api/recurring/"+jsonNum(id(rec))+"/preview?n=3", nil, 200)
	if len(pv["upcoming"].([]any)) != 3 {
		t.Fatalf("preview: %v", pv)
	}
	c.json("POST", "/api/recurring", map[string]any{"documentId": id(doc), "every": "fortnight", "startOn": "2026-01-15"}, 400)
	dp := c.json("POST", "/api/recurring/preview?n=2", map[string]any{"documentId": id(doc), "every": "week", "startOn": "2026-11-01"}, 200)
	if up := dp["upcoming"].([]any); len(up) != 2 || up[1].(map[string]any)["issuedOn"] != "2026-11-08" {
		t.Fatalf("draft preview: %v", dp)
	}
	if n := len(c.list("/api/recurring")); n != 1 {
		t.Fatalf("a preview must not create a schedule: %d", n)
	}
	n, err := s.Auto.RunRecurring(t.Context())
	if err != nil || n == 0 {
		t.Fatalf("run: %d %v", n, err)
	}
	if l := c.list("/api/recurring"); l[0].(map[string]any)["issuedCount"].(float64) == 0 {
		t.Fatalf("list: %v", l)
	}
	c.json("PUT", "/api/recurring/"+jsonNum(id(rec)), map[string]any{"active": false}, 204)
	c.json("DELETE", "/api/recurring/"+jsonNum(id(rec)), nil, 204)
	c.json("DELETE", "/api/recurring/"+jsonNum(id(rec)), nil, 404)
	c.json("PUT", "/api/automation", map[string]any{"remindersEnabled": true, "remindAfter": []int{0}}, 400)
	if ov := c.list("/api/overdue"); len(ov) == 0 {
		t.Fatal("the October invoices are long overdue")
	}
}

func TestCSVOverHTTP(t *testing.T) {
	c, _ := newFlow(t)
	setupParties(c)
	code, raw := c.do("GET", "/api/export/customers.csv", nil)
	if code != 200 || !strings.HasPrefix(string(raw), "\xef\xbb\xbf") || !strings.Contains(string(raw), "Acme") {
		t.Fatalf("export: %d %q", code, raw)
	}
	if code, _ := c.do("GET", "/api/export/passwords.csv", nil); code != 404 {
		t.Fatalf("unknown export: %d", code)
	}
	file := "name,email\nBeta Ltd,b@beta.example\n,missing@name.example\n"
	code, raw = upload(t, c, "/api/import/customers?dryRun=1", "file", "c.csv", file, nil)
	var rep map[string]any
	json.Unmarshal(raw, &rep)
	if code != 200 || rep["valid"] != float64(1) || rep["created"] != float64(0) || len(rep["errors"].([]any)) != 1 {
		t.Fatalf("dry run: %d %s", code, raw)
	}
	code, raw = upload(t, c, "/api/import/customers", "file", "c.csv", file, nil)
	json.Unmarshal(raw, &rep)
	if code != 200 || rep["created"] != float64(1) {
		t.Fatalf("import: %d %s", code, raw)
	}
	if n := len(c.list("/api/parties?kind=customer")); n != 2 {
		t.Fatalf("customers: %d", n)
	}
	if code, _ := upload(t, c, "/api/import/customers", "file", "c.csv", "email\nx@y.z\n", nil); code != 400 {
		t.Fatalf("a file without a name column: %d", code)
	}
	if code, _ := upload(t, c, "/api/import/payments", "file", "c.csv", "name\nx\n", nil); code != 400 {
		t.Fatalf("an unsupported kind: %d", code)
	}
}

func TestBackupsOverHTTP(t *testing.T) {
	c, _ := newFlow(t)
	issuer, customer := setupParties(c)
	c.invoice(issuer, customer, nil)
	c.json("PUT", "/api/backups/config", map[string]any{"enabled": true, "everyHours": 24, "keep": 3, "encrypt": true, "passphrase": "a long passphrase"}, 200)
	run := c.json("POST", "/api/backups/run", nil, 200)
	name := run["name"].(string)
	if !strings.HasSuffix(name, ".enc") {
		t.Fatalf("name: %s", name)
	}
	st := c.json("GET", "/api/backups", nil, 200)
	if st["lastSuccess"] == nil || len(st["files"].([]any)) != 1 || len(st["excluded"].([]any)) == 0 {
		t.Fatalf("status: %v", st)
	}
	if cfg := st["config"].(map[string]any); cfg["passphrase"] != nil && cfg["passphrase"] != "" {
		t.Fatalf("passphrase leaked: %v", cfg)
	}
	// The recovery check opens the saved copy without restoring it.
	ver := c.json("POST", "/api/backups/verify", map[string]any{"source": "local", "name": name}, 200)
	if ver["counts"].(map[string]any)["documents"] != float64(1) {
		t.Fatalf("verify: %v", ver)
	}
	// A downloaded copy needs its passphrase; the wrong one is refused with a clear code.
	_, file := c.do("GET", "/api/backups/files/"+name, nil)
	if code, raw := upload(t, c, "/api/backups/verify", "file", name, string(file), map[string]string{"passphrase": "nope"}); code != 400 || !strings.Contains(string(raw), "passphrase") {
		t.Fatalf("wrong passphrase: %d %s", code, raw)
	}
	if code, _ := upload(t, c, "/api/backups/verify", "file", name, string(file), map[string]string{"passphrase": "a long passphrase"}); code != 200 {
		t.Fatalf("right passphrase: %d", code)
	}
	// Restoring needs an explicit confirmation, then brings back what was deleted.
	c.json("DELETE", "/api/documents/1", nil, 204)
	if c.json("GET", "/api/documents", nil, 200)["total"] != float64(0) {
		t.Fatal("setup: the document should be gone")
	}
	c.json("POST", "/api/backups/restore", map[string]any{"source": "local", "name": name}, 400)
	c.json("POST", "/api/backups/restore?confirm=replace", map[string]any{"source": "local", "name": name}, 204)
	if c.json("GET", "/api/documents", nil, 200)["total"] != float64(1) {
		t.Fatal("the invoice did not come back")
	}
	c.json("GET", "/api/backups/files/..%2f..%2fetc%2fpasswd", nil, 404)
	// Mail and backup setup survive a restore.
	if cfg := c.json("GET", "/api/backups", nil, 200)["config"].(map[string]any); cfg["encrypt"] != true {
		t.Fatalf("backup settings were lost by the restore: %v", cfg)
	}
}

func TestHealthAndOpenAPI(t *testing.T) {
	c, _ := newFlow(t)
	h := c.json("GET", "/api/admin/health", nil, 200)
	for _, k := range []string{"version", "schema", "databaseBytes", "databaseCheck", "backup", "webhooks", "email", "counts", "recentErrors"} {
		if _, ok := h[k]; !ok {
			t.Errorf("health is missing %q", k)
		}
	}
	if h["databaseCheck"] != "ok" {
		t.Fatalf("database check: %v", h["databaseCheck"])
	}
	code, raw := c.anonymous().do("GET", "/api/openapi.yaml", nil)
	if code != 200 || !strings.Contains(string(raw), "openapi: 3") {
		t.Fatalf("openapi: %d", code)
	}
	key := c.json("POST", "/api/keys", map[string]string{"label": "k"}, 201)["secret"].(string)
	api := &client{t: t, srv: c.srv, c: &http.Client{}, key: key}
	if code, _ := api.do("GET", "/api/admin/health", nil); code != 403 {
		t.Fatalf("health for an API key: %d", code)
	}
}

// stripeEvent builds a signed Stripe webhook request body and header.
func stripeEvent(secret, id, typ string, obj map[string]any, at time.Time) (string, string) {
	body, _ := json.Marshal(map[string]any{"id": id, "type": typ, "data": map[string]any{"object": obj}})
	m := hmac.New(sha256.New, []byte(secret))
	ts := strconv.FormatInt(at.Unix(), 10)
	m.Write([]byte(ts + "."))
	m.Write(body)
	return string(body), "t=" + ts + ",v1=" + hex.EncodeToString(m.Sum(nil))
}

func TestClientPaysOnlineAndStripeConfirms(t *testing.T) {
	c, s := newFlow(t)
	var got url.Values
	var auth string
	stripe := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path != "/v1/checkout/sessions" {
			http.NotFound(w, r)
			return
		}
		r.ParseForm()
		got, auth = r.PostForm, r.Header.Get("Authorization")
		w.Write([]byte(`{"id":"cs_test_1","url":"https://checkout.stripe.test/pay/cs_test_1"}`))
	}))
	defer stripe.Close()
	s.Pay.APIBase = stripe.URL

	issuer, customer := setupParties(c)
	inv := c.invoice(issuer, customer, nil) // 100.00 EUR
	docID := id(inv)
	token := c.json("POST", "/api/documents/"+jsonNum(docID)+"/share", nil, 200)["link"].(map[string]any)["token"].(string)
	anon := c.anonymous()

	// Off until set up; the keys must look right; secrets are never returned.
	if o := anon.json("GET", "/api/public/documents/"+token+"/options", nil, 200); o["pay"] != false {
		t.Fatalf("pay should be off: %v", o)
	}
	c.json("PUT", "/api/payments/config", map[string]any{"enabled": true}, 400)
	c.json("PUT", "/api/payments/config", map[string]any{"secretKey": "pk_live_nope", "webhookSecret": "whsec_x"}, 400)
	cfg := c.json("PUT", "/api/payments/config", map[string]any{"enabled": true, "secretKey": "sk_test_abc", "webhookSecret": "whsec_test"}, 200)
	if cfg["config"].(map[string]any)["secretKey"] != nil && cfg["config"].(map[string]any)["secretKey"] != "" {
		t.Fatalf("the key leaked: %v", cfg)
	}
	if !strings.HasSuffix(cfg["webhookUrl"].(string), "/api/hooks/stripe") {
		t.Fatalf("webhook url: %v", cfg["webhookUrl"])
	}
	o := anon.json("GET", "/api/public/documents/"+token+"/options", nil, 200)
	if o["pay"] != true || o["payAmount"] != float64(10000) {
		t.Fatalf("options: %v", o)
	}

	// The client starts a payment: Stripe is asked for exactly the balance.
	pay := anon.json("POST", "/api/public/documents/"+token+"/pay", nil, 200)
	if pay["url"] != "https://checkout.stripe.test/pay/cs_test_1" {
		t.Fatalf("pay: %v", pay)
	}
	if auth != "Bearer sk_test_abc" || got.Get("line_items[0][price_data][unit_amount]") != "10000" || got.Get("line_items[0][price_data][currency]") != "eur" ||
		got.Get("metadata[mavri_document]") != jsonNum(docID) || !strings.HasSuffix(got.Get("success_url"), "/d/"+token+"?paid=1") {
		t.Fatalf("what Stripe was asked: %v (auth %q)", got, auth)
	}

	hook := func(secret, evID, typ string, obj map[string]any, at time.Time) int {
		body, sig := stripeEvent(secret, evID, typ, obj, at)
		req, _ := http.NewRequest("POST", c.srv.URL+"/api/hooks/stripe", strings.NewReader(body))
		req.Header.Set("Stripe-Signature", sig)
		res, err := http.DefaultClient.Do(req)
		if err != nil {
			t.Fatal(err)
		}
		res.Body.Close()
		return res.StatusCode
	}
	paidObj := func(amount int, cur string) map[string]any {
		return map[string]any{"id": "cs_test_1", "payment_status": "paid", "amount_total": amount, "currency": cur, "client_reference_id": jsonNum(docID),
			"metadata": map[string]any{"mavri_document": jsonNum(docID)}}
	}
	now := time.Now()
	state := func() map[string]any { return c.json("GET", "/api/documents/"+jsonNum(docID), nil, 200) }

	// Forged or stale events are refused and change nothing.
	if code := hook("whsec_wrong", "evt_1", "checkout.session.completed", paidObj(10000, "eur"), now); code != 400 {
		t.Fatalf("forged signature: %d", code)
	}
	if code := hook("whsec_test", "evt_1", "checkout.session.completed", paidObj(10000, "eur"), now.Add(-time.Hour)); code != 400 {
		t.Fatalf("stale timestamp: %d", code)
	}
	if state()["status"] != "unpaid" {
		t.Fatal("a refused event changed the invoice")
	}
	// A different currency is never applied.
	if code := hook("whsec_test", "evt_cur", "checkout.session.completed", paidObj(10000, "usd"), now); code != 200 {
		t.Fatalf("currency mismatch answers: %d", code)
	}
	if state()["status"] != "unpaid" {
		t.Fatal("a payment in the wrong currency was applied")
	}
	// A partial payment, then the rest; each event only once.
	if code := hook("whsec_test", "evt_part", "checkout.session.completed", paidObj(4000, "eur"), now); code != 200 {
		t.Fatalf("partial: %d", code)
	}
	if st := state(); st["status"] != "partial" || st["paidCents"] != float64(4000) {
		t.Fatalf("after the partial payment: %v", st)
	}
	hook("whsec_test", "evt_part", "checkout.session.completed", paidObj(4000, "eur"), now) // Stripe retries
	if st := state(); st["paidCents"] != float64(4000) {
		t.Fatalf("a retried event paid twice: %v", st["paidCents"])
	}
	if code := hook("whsec_test", "evt_rest", "checkout.session.completed", paidObj(6000, "eur"), now); code != 200 {
		t.Fatalf("rest: %d", code)
	}
	st := state()
	pays := st["payments"].([]any)
	if st["status"] != "paid" || len(pays) != 2 || pays[1].(map[string]any)["method"] != "card (Stripe)" {
		t.Fatalf("after paying in full: %v", st)
	}
	// Nothing is left to pay.
	if o := anon.json("GET", "/api/public/documents/"+token+"/options", nil, 200); o["pay"] != false {
		t.Fatalf("a paid invoice offers payment: %v", o)
	}
	anon.json("POST", "/api/public/documents/"+token+"/pay", nil, 409)

	// A failed payment is recorded and can be sent to webhooks as payment.failed.
	other := c.invoice(issuer, customer, nil)
	failObj := map[string]any{"id": "pi_1", "metadata": map[string]any{"mavri_document": jsonNum(id(other))}, "last_payment_error": map[string]any{"message": "Your card was declined."}}
	if code := hook("whsec_test", "evt_fail", "payment_intent.payment_failed", failObj, now); code != 200 {
		t.Fatalf("failure: %d", code)
	}
	act := c.json("GET", "/api/activity?entity=invoice&entityId="+jsonNum(id(other)), nil, 200)
	seen := false
	for _, it := range act["items"].([]any) {
		e := it.(map[string]any)
		if e["action"] == "payment failed" && strings.Contains(e["detail"].(string), "declined") && e["source"] == "webhook" {
			seen = true
		}
	}
	if !seen {
		t.Fatalf("the failure is missing from the history: %v", act["items"])
	}
	// The sign-in required parts stay private.
	if code, _ := anon.do("GET", "/api/payments/config", nil); code != 401 {
		t.Fatalf("payments config without sign-in: %d", code)
	}
}

func TestStripeErrorsAreReportedAndNoOneElseCanPay(t *testing.T) {
	c, s := newFlow(t)
	stripe := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(401)
		w.Write([]byte(`{"error":{"message":"Invalid API Key provided: sk_test_***"}}`))
	}))
	defer stripe.Close()
	s.Pay.APIBase = stripe.URL
	issuer, customer := setupParties(c)
	inv := c.invoice(issuer, customer, nil)
	token := c.json("POST", "/api/documents/"+jsonNum(id(inv))+"/share", nil, 200)["link"].(map[string]any)["token"].(string)
	c.json("PUT", "/api/payments/config", map[string]any{"enabled": true, "secretKey": "sk_test_abc", "webhookSecret": "whsec_test"}, 200)
	anon := c.anonymous()
	code, raw := anon.do("POST", "/api/public/documents/"+token+"/pay", nil)
	if code != 502 || !strings.Contains(string(raw), "Invalid API Key") {
		t.Fatalf("a Stripe failure should be explained: %d %s", code, raw)
	}
	// A quote cannot be paid.
	q := c.json("POST", "/api/documents", map[string]any{"kind": "quote", "issuerId": issuer, "customerId": customer, "currencyId": 2, "issuedOn": "2026-10-02",
		"lines": []any{map[string]any{"name": "Plan", "quantity": 1, "unitCents": 5000}}}, 201)
	qt := c.json("POST", "/api/documents/"+jsonNum(id(q))+"/share", nil, 200)["link"].(map[string]any)["token"].(string)
	anon.json("POST", "/api/public/documents/"+qt+"/pay", nil, 409)
	// The webhook endpoint refuses everything when payments were never set up.
	c2, _ := newFlow(t)
	if code, _ := c2.do("POST", "/api/hooks/stripe", "{}", "Stripe-Signature", "t=1,v1=00"); code != 404 {
		t.Fatalf("webhook without setup: %d", code)
	}
}

func TestClientDownloadsTheEInvoice(t *testing.T) {
	c, _ := newFlow(t)
	issuer, customer := setupParties(c)
	inv := c.invoice(issuer, customer, nil)
	token := c.json("POST", "/api/documents/"+jsonNum(id(inv))+"/share", nil, 200)["link"].(map[string]any)["token"].(string)
	anon := c.anonymous()
	o := anon.json("GET", "/api/public/documents/"+token+"/options", nil, 200)
	if len(o["einvoice"].([]any)) != 2 {
		t.Fatalf("options: %v", o)
	}
	code, raw := anon.do("GET", "/api/public/documents/"+token+"/einvoice?format=ubl", nil)
	if code != 200 || !strings.Contains(string(raw), "<cbc:ID>") {
		t.Fatalf("ubl: %d %s", code, raw)
	}
	if code, _ := anon.do("GET", "/api/public/documents/"+token+"/einvoice?format=nonsense", nil); code != 403 {
		t.Fatalf("unknown format: %d", code)
	}
	if code, _ := anon.do("GET", "/api/public/documents/aaaaaaaaaaaaaaaaaaaaaaaaaaaa/einvoice", nil); code != 404 {
		t.Fatalf("bad token: %d", code)
	}
}

func TestBulkActionsReportEachDocument(t *testing.T) {
	c, s := newFlow(t)
	var mailed []string
	s.Mail.Send = func(_ mailer.Config, _ string, to []string, _ []byte) error {
		mailed = append(mailed, to[0])
		return nil
	}
	issuer, customer := setupParties(c)
	c.json("PUT", "/api/parties/"+jsonNum(customer), map[string]any{"kind": "customer", "name": "Acme", "email": "ap@acme.example"}, 200)
	noMail := c.json("POST", "/api/parties", map[string]any{"kind": "customer", "name": "No Email Ltd"}, 201)
	a := c.invoice(issuer, customer, nil)
	b := c.invoice(issuer, customer, nil)
	n := c.invoice(issuer, id(noMail), nil)
	ids := []float64{id(a), id(b), id(n), 9999}

	// Email needs mail set up: one clear answer instead of many failures.
	c.json("POST", "/api/documents/bulk", map[string]any{"ids": ids, "action": "email"}, 409)
	c.json("PUT", "/api/mail/config", map[string]any{"enabled": true, "host": "smtp.test", "port": 587, "security": "starttls", "from": "bill@n.example"}, 200)
	c.json("PUT", "/api/automation", map[string]any{"publicUrl": "https://inv.example", "remindBefore": []int{3}, "remindAfter": []int{3}}, 200)

	res := c.json("POST", "/api/documents/bulk", map[string]any{"ids": ids, "action": "email"}, 200)
	if res["ok"] != float64(2) || res["failed"] != float64(2) || len(mailed) != 2 {
		t.Fatalf("email: %v (mailed %v)", res, mailed)
	}
	byID := map[float64]map[string]any{}
	for _, r := range res["results"].([]any) {
		m := r.(map[string]any)
		byID[m["id"].(float64)] = m
	}
	if byID[id(n)]["ok"] != false || !strings.Contains(byID[id(n)]["message"].(string), "no email") || byID[9999]["message"] != "not found" {
		t.Fatalf("per-document outcomes: %v", byID)
	}
	if r := c.json("POST", "/api/documents/bulk", map[string]any{"ids": []float64{id(a)}, "action": "remind"}, 200); r["ok"] != float64(1) {
		t.Fatalf("remind: %v", r)
	}
	// Mark paid, then the second pass finds nothing owed.
	if r := c.json("POST", "/api/documents/bulk", map[string]any{"ids": []float64{id(a), id(b)}, "action": "paid"}, 200); r["ok"] != float64(2) {
		t.Fatalf("paid: %v", r)
	}
	if st := c.json("GET", "/api/documents/"+jsonNum(id(a)), nil, 200); st["status"] != "paid" || st["paidCents"] != float64(10000) {
		t.Fatalf("after marking paid: %v", st)
	}
	if r := c.json("POST", "/api/documents/bulk", map[string]any{"ids": []float64{id(a)}, "action": "paid"}, 200); r["ok"] != float64(0) {
		t.Fatalf("paying twice: %v", r)
	}
	if r := c.json("POST", "/api/documents/bulk", map[string]any{"ids": []float64{id(n)}, "action": "void"}, 200); r["ok"] != float64(1) {
		t.Fatalf("void: %v", r)
	}
	c.json("POST", "/api/documents/bulk", map[string]any{"ids": []float64{}, "action": "void"}, 400)
	c.json("POST", "/api/documents/bulk", map[string]any{"ids": []float64{1}, "action": "delete"}, 400)
	// A selection can be exported on its own.
	code, raw := c.do("GET", "/api/export/invoices.csv?ids="+jsonNum(id(a)), nil)
	if code != 200 || strings.Count(string(raw), "\n") != 2 {
		t.Fatalf("export of one invoice: %d\n%s", code, raw)
	}
}

func TestCollectionsOverHTTP(t *testing.T) {
	c, _ := newFlow(t)
	issuer, customer := setupParties(c)
	doc := c.invoice(issuer, customer, map[string]any{"dueOn": "2020-01-31"}) // long overdue
	did := jsonNum(id(doc))

	list := c.json("GET", "/api/attention", nil, 200)
	items := list["items"].([]any)
	if len(items) != 1 || items[0].(map[string]any)["reason"] != "overdue" {
		t.Fatalf("an overdue invoice is on the list: %v", list)
	}
	c.anonymous().json("GET", "/api/attention", nil, 401)

	// A person records a promise: the invoice stays listed, as promised, and the history shows it.
	c.json("POST", "/api/documents/"+did+"/follow-ups", map[string]any{"kind": "promise"}, 400)
	c.json("POST", "/api/documents/"+did+"/follow-ups", map[string]any{"kind": "promise", "dueOn": "2999-01-01", "note": "By phone"}, 201)
	if r := c.json("GET", "/api/attention", nil, 200)["items"].([]any)[0].(map[string]any)["reason"]; r != "promised" {
		t.Fatalf("reason after a promise: %v", r)
	}
	if rows := c.list("/api/documents/" + did + "/follow-ups"); len(rows) != 1 {
		t.Fatalf("follow-ups: %v", rows)
	}

	// The client disputes it from the secure link; reminders stop and the invoice jumps to the top.
	token := c.json("POST", "/api/documents/"+did+"/share", nil, 200)["link"].(map[string]any)["token"].(string)
	anon := c.anonymous()
	anon.json("POST", "/api/public/documents/"+token+"/respond", map[string]any{"action": "dispute"}, 400) // needs a message
	anon.json("POST", "/api/public/documents/"+token+"/respond", map[string]any{"action": "dispute", "message": "We never ordered this"}, 200)
	first := c.json("GET", "/api/attention", nil, 200)["items"].([]any)[0].(map[string]any)
	if first["reason"] != "disputed" || first["detail"] != "We never ordered this" {
		t.Fatalf("dispute: %v", first)
	}
	c.json("POST", "/api/follow-ups/"+jsonNum(first["followUpId"].(float64))+"/resolve", nil, 200)
	c.json("POST", "/api/follow-ups/9999/resolve", nil, 404)
}

func TestPaymentOptionsOverHTTP(t *testing.T) {
	c, _ := newFlow(t)
	issuer, customer := setupParties(c)
	bank := c.json("POST", "/api/banks", map[string]any{"label": "Main", "bankName": "Example Bank", "holder": "Northwind", "accountNumber": "DE89 3704 0044 0532 0130 00", "swift": "COBADEFF"}, 201)
	doc := c.invoice(issuer, customer, map[string]any{"bankId": id(bank)}) // currency 2 is EUR in the seed data
	did := jsonNum(id(doc))
	opts := c.list("/api/documents/" + did + "/payment-options")
	var kinds []string
	for _, o := range opts {
		kinds = append(kinds, o.(map[string]any)["kind"].(string))
	}
	if len(kinds) == 0 || kinds[len(kinds)-1] != "bank" {
		t.Fatalf("a bank transfer is always offered: %v", kinds)
	}
	token := c.json("POST", "/api/documents/"+did+"/share", nil, 200)["link"].(map[string]any)["token"].(string)
	if got := c.anonymous().list("/api/public/documents/" + token + "/payment-options"); len(got) != len(opts) {
		t.Fatalf("the client sees the same options: %v vs %v", got, opts)
	}
	c.anonymous().json("GET", "/api/public/documents/nope-nope-nope-nope/payment-options", nil, 404)
}
