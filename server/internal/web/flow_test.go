package web

import (
	"bytes"
	"encoding/json"
	"io"
	"log/slog"
	"mime/multipart"
	"net/http"
	"net/http/cookiejar"
	"net/http/httptest"
	"strings"
	"testing"

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
