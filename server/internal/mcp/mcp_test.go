package mcp

import (
	"bytes"
	"context"
	"encoding/json"
	"strings"
	"testing"

	"github.com/Raktim94/mavri/server/internal/activity"
	"github.com/Raktim94/mavri/server/internal/automation"
	"github.com/Raktim94/mavri/server/internal/db"
	"github.com/Raktim94/mavri/server/internal/mailer"
	"github.com/Raktim94/mavri/server/internal/share"
	"github.com/Raktim94/mavri/server/internal/shop"
	"github.com/Raktim94/mavri/server/internal/store"
)

func newServer(t *testing.T) *Server {
	s, _ := newServerEnv(t)
	return s
}

// sentMail collects what the email tool would have sent.
var sentMail []string

func newServerEnv(t *testing.T) (*Server, *Env) {
	t.Helper()
	d, err := db.Open(":memory:")
	if err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() { d.Close() })
	box, _ := shop.NewBox(t.TempDir(), "")
	st := &store.Store{DB: d}
	hub := &activity.Hub{DB: d, Box: box}
	links := &share.Links{DB: d}
	sentMail = nil
	ml := &mailer.Service{DB: d, Box: box, Store: st, Links: links, Hub: hub,
		Send: func(_ mailer.Config, _ string, to []string, _ []byte) error {
			sentMail = append(sentMail, to[0])
			return nil
		}}
	auto := &automation.Service{DB: d, Store: st, Mail: ml, Hub: hub}
	auto.BaseURL = func(ctx context.Context) string { c, _ := auto.Load(ctx); return c.PublicURL }
	env := &Env{Store: st, Shops: &shop.Service{Store: st, Box: box}, Hub: hub, Auto: auto, Mail: ml, Links: links}
	return NewServer("mavri", "test", Tools(env)), env
}

func call(t *testing.T, s *Server, tool string, args map[string]any) (text string, isError bool) {
	t.Helper()
	params, _ := json.Marshal(map[string]any{"name": tool, "arguments": args})
	req, _ := json.Marshal(map[string]any{"jsonrpc": "2.0", "id": 1, "method": "tools/call", "params": json.RawMessage(params)})
	resp := s.Handle(context.Background(), req)
	if resp == nil || resp.Error != nil {
		t.Fatalf("%s: %+v", tool, resp)
	}
	res := resp.Result.(map[string]any)
	content := res["content"].([]map[string]string)
	return content[0]["text"], res["isError"].(bool)
}

func ok(t *testing.T, s *Server, tool string, args map[string]any) map[string]any {
	t.Helper()
	text, isErr := call(t, s, tool, args)
	if isErr {
		t.Fatalf("%s failed: %s", tool, text)
	}
	var out map[string]any
	_ = json.Unmarshal([]byte(text), &out)
	return out
}

func TestProtocol(t *testing.T) {
	s := newServer(t)
	in := strings.Join([]string{
		`{"jsonrpc":"2.0","id":1,"method":"initialize","params":{}}`,
		`{"jsonrpc":"2.0","method":"notifications/initialized"}`,
		`{"jsonrpc":"2.0","id":2,"method":"ping"}`,
		`{"jsonrpc":"2.0","id":3,"method":"tools/list"}`,
		`{"jsonrpc":"2.0","id":4,"method":"nope"}`,
		`garbage`,
	}, "\n")
	var out bytes.Buffer
	if err := s.Serve(context.Background(), strings.NewReader(in), &out); err != nil {
		t.Fatal(err)
	}
	lines := strings.Split(strings.TrimSpace(out.String()), "\n")
	if len(lines) != 5 { // the notification gets no reply
		t.Fatalf("expected 5 replies, got %d:\n%s", len(lines), out.String())
	}
	if !strings.Contains(lines[0], ProtocolVersion) || !strings.Contains(lines[0], `"name":"mavri"`) {
		t.Errorf("initialize: %s", lines[0])
	}
	if !strings.Contains(lines[2], "create_document") || !strings.Contains(lines[2], "inputSchema") {
		t.Errorf("tools/list: %s", lines[2])
	}
	if !strings.Contains(lines[3], "-32601") || !strings.Contains(lines[4], "-32700") {
		t.Errorf("errors: %s / %s", lines[3], lines[4])
	}
}

func TestInvoiceLifecycleThroughTools(t *testing.T) {
	s := newServer(t)
	issuer := ok(t, s, "create_issuer", map[string]any{"name": "Northwind"})
	doc := ok(t, s, "create_document", map[string]any{
		"kind": "invoice", "issuerId": issuer["id"], "currency": "usd",
		"customer": map[string]any{"name": "Acme", "email": "a@acme.example"},
		"lines":    []any{map[string]any{"name": "Work", "quantity": 2, "unitPrice": 150.5, "taxRate": 10}},
		"shipping": 5,
	})
	totals := doc["totals"].(map[string]any)
	// 2 x 150.50 = 301.00 + 10% = 331.10 + 5.00 shipping = 336.10
	if totals["totalCents"] != float64(33610) || doc["status"] != "unpaid" {
		t.Fatalf("totals: %v", totals)
	}
	// The same email finds the customer instead of creating another.
	ok(t, s, "create_document", map[string]any{"kind": "quote", "issuerId": issuer["id"], "customer": map[string]any{"name": "Acme again", "email": "A@ACME.example"},
		"lines": []any{map[string]any{"name": "Plan", "unitPrice": 1}}})
	text, _ := call(t, s, "list_customers", map[string]any{})
	if strings.Count(text, `"kind": "customer"`) != 1 {
		t.Fatalf("customer duplicated: %s", text)
	}
	id := doc["id"]
	paid := ok(t, s, "record_payment", map[string]any{"documentId": id, "amount": 100, "confirm": true})
	if paid["status"] != "partial" || paid["paidCents"] != float64(10000) {
		t.Fatalf("partial: %v", paid)
	}
	paid = ok(t, s, "record_payment", map[string]any{"documentId": id, "amount": 236.1, "confirm": true})
	if paid["status"] != "paid" {
		t.Fatalf("paid: %v", paid["status"])
	}
	if void := ok(t, s, "set_document_status", map[string]any{"id": id, "status": "void", "confirm": true}); void["status"] != "void" {
		t.Fatalf("void: %v", void["status"])
	}
	list := ok(t, s, "list_documents", map[string]any{"kind": "invoice", "query": "acme"})
	if list["total"] != float64(1) {
		t.Fatalf("list: %v", list)
	}
	if dup := ok(t, s, "duplicate_document", map[string]any{"id": id}); dup["fullNumber"] != "2" {
		t.Fatalf("duplicate: %v", dup["fullNumber"])
	}
	if got := ok(t, s, "get_document", map[string]any{"id": id}); got["fullNumber"] != "1" {
		t.Fatal("get_document")
	}
	if rep := ok(t, s, "year_report", map[string]any{"year": "2026"}); rep["year"] != "2026" {
		t.Fatal("year_report")
	}
	ok(t, s, "delete_document", map[string]any{"id": id, "confirm": true})
	if text, isErr := call(t, s, "get_document", map[string]any{"id": id}); !isErr || !strings.Contains(text, "not found") {
		t.Fatalf("deleted document: %s", text)
	}
}

func TestValidationAndErrors(t *testing.T) {
	s := newServer(t)
	for name, tc := range map[string]struct {
		tool string
		args map[string]any
		want string
	}{
		"missing required": {"get_document", map[string]any{}, "id is required"},
		"wrong type":       {"get_document", map[string]any{"id": "7"}, "id must be a number"},
		"fraction":         {"get_document", map[string]any{"id": 1.5}, "whole number"},
		"unknown argument": {"get_document", map[string]any{"id": 1, "x": 1}, "not a known argument"},
		"bad enum":         {"list_documents", map[string]any{"kind": "memo"}, "must be one of"},
		"nested":           {"create_document", map[string]any{"kind": "invoice", "issuerId": 1, "lines": []any{map[string]any{"name": "x"}}}, "lines[0].unitPrice is required"},
		"unknown tool":     {"nope", nil, ""},
	} {
		if name == "unknown tool" {
			req := `{"jsonrpc":"2.0","id":1,"method":"tools/call","params":{"name":"nope"}}`
			if resp := s.Handle(context.Background(), []byte(req)); resp.Error == nil {
				t.Errorf("%s: expected an error", name)
			}
			continue
		}
		text, isErr := call(t, s, tc.tool, tc.args)
		if !isErr || !strings.Contains(text, tc.want) {
			t.Errorf("%s: got %q (error=%v), want %q", name, text, isErr, tc.want)
		}
	}
	if text, isErr := call(t, s, "create_document", map[string]any{"kind": "invoice", "issuerId": 99, "customer": map[string]any{"name": "x"}, "lines": []any{map[string]any{"name": "w", "unitPrice": 1}}}); !isErr {
		t.Fatalf("missing issuer accepted: %s", text)
	}
}

func TestStoresThroughTools(t *testing.T) {
	s := newServer(t)
	issuer := ok(t, s, "create_issuer", map[string]any{"name": "Me"})
	made := ok(t, s, "create_shop", map[string]any{"name": "Shop", "platform": "generic", "issuerId": issuer["id"], "defaultTax": 10})
	shopID := made["shop"].(map[string]any)["id"]
	if made["secret"] == "" {
		t.Fatal("secret not returned")
	}
	order := map[string]any{"shopId": shopID, "orderId": "O-1", "items": []any{map[string]any{"name": "Hat", "quantity": 2, "unitPrice": 12.5}}, "paid": true}
	first := ok(t, s, "create_invoice_from_order", order)
	again := ok(t, s, "create_invoice_from_order", order)
	if first["duplicate"] != false || again["duplicate"] != true || first["documentId"] != again["documentId"] {
		t.Fatalf("idempotency: %v %v", first, again)
	}
	ok(t, s, "pause_shop", map[string]any{"id": shopID})
	order["orderId"] = "O-2"
	if text, isErr := call(t, s, "create_invoice_from_order", order); !isErr || !strings.Contains(text, "paused") {
		t.Fatalf("paused shop: %s", text)
	}
	if text, isErr := call(t, s, "export_einvoice", map[string]any{"id": first["documentId"]}); !isErr || !strings.Contains(text, "not ready") {
		t.Fatalf("incomplete export: %s", text)
	}
}

// Actions with consequences outside Mavri, or that cannot be undone, change nothing until the user approves.
func TestRiskyActionsNeedExplicitApproval(t *testing.T) {
	s, env := newServerEnv(t)
	ctx := context.Background()
	issuer := ok(t, s, "create_issuer", map[string]any{"name": "Northwind"})
	doc := ok(t, s, "create_document", map[string]any{"kind": "invoice", "issuerId": issuer["id"], "customer": map[string]any{"name": "Acme", "email": "ap@acme.example"},
		"lines": []any{map[string]any{"name": "Work", "unitPrice": 100}}})
	id := doc["id"]
	cfg := mailer.Defaults()
	cfg.Enabled, cfg.Host, cfg.From = true, "smtp.test", "me@x.co"
	env.Mail.Save(ctx, cfg)
	env.Auto.Save(ctx, automation.Config{PublicURL: "https://inv.example", RemindBefore: []int{3}, RemindAfter: []int{3}})

	for tool, args := range map[string]map[string]any{
		"record_payment":      {"documentId": id, "amount": 100},
		"set_document_status": {"id": id, "status": "void"},
		"delete_document":     {"id": id},
		"send_document":       {"id": id},
		"share_document":      {"id": id},
	} {
		got := ok(t, s, tool, args)
		if got["status"] != "approval_required" || got["changed"] != false || got["preview"] == nil {
			t.Fatalf("%s did not ask for approval: %v", tool, got)
		}
	}
	// Nothing happened: still unpaid, still there, no mail, no link.
	cur := ok(t, s, "get_document", map[string]any{"id": id})
	if cur["status"] != "unpaid" || cur["paidCents"] != float64(0) {
		t.Fatalf("the document changed without approval: %v", cur)
	}
	if len(sentMail) != 0 {
		t.Fatal("an email went out without approval")
	}
	if _, found, _ := env.Links.Active(ctx, int64(id.(float64))); found {
		t.Fatal("a link was created without approval")
	}
	// A preview of the email shows exactly what would be sent.
	pre := ok(t, s, "send_document", map[string]any{"id": id})["preview"].(map[string]any)
	if pre["to"] != "ap@acme.example" || !strings.Contains(pre["body"].(string), "{{link}}") {
		t.Fatalf("preview: %v", pre)
	}
	if _, found, _ := env.Links.Active(ctx, int64(id.(float64))); found {
		t.Fatal("previewing an email created a link")
	}
	// Approved: it happens, and is recorded as coming from MCP.
	mcpCtx := activity.WithSource(ctx, activity.SourceMCP, "MCP client")
	params, _ := json.Marshal(map[string]any{"name": "send_document", "arguments": map[string]any{"id": id, "confirm": true}})
	req, _ := json.Marshal(map[string]any{"jsonrpc": "2.0", "id": 1, "method": "tools/call", "params": json.RawMessage(params)})
	if resp := s.Handle(mcpCtx, req); resp == nil || resp.Error != nil {
		t.Fatalf("send: %+v", resp)
	}
	if len(sentMail) != 1 || sentMail[0] != "ap@acme.example" {
		t.Fatalf("sent: %v", sentMail)
	}
	items, _, _ := env.Hub.List(ctx, activity.Filter{Source: "mcp"})
	if len(items) == 0 {
		t.Fatal("the approved action is missing from the history")
	}
}

func TestOverdueSummaryGroupsByCustomer(t *testing.T) {
	s := newServer(t)
	issuer := ok(t, s, "create_issuer", map[string]any{"name": "Northwind"})
	for i := 0; i < 2; i++ {
		ok(t, s, "create_document", map[string]any{"kind": "invoice", "issuerId": issuer["id"], "issuedOn": "2020-01-01", "dueOn": "2020-01-15",
			"customer": map[string]any{"name": "Slow Payer", "email": "slow@x.co"}, "lines": []any{map[string]any{"name": "Work", "unitPrice": 50}}})
	}
	ok(t, s, "create_document", map[string]any{"kind": "invoice", "issuerId": issuer["id"], "issuedOn": "2020-01-01", "dueOn": "2099-01-01",
		"customer": map[string]any{"name": "Fine", "email": "fine@x.co"}, "lines": []any{map[string]any{"name": "Work", "unitPrice": 50}}})
	got := ok(t, s, "overdue_summary", map[string]any{})
	custs := got["customers"].([]any)
	if got["overdueInvoices"] != float64(2) || len(custs) != 1 {
		t.Fatalf("summary: %v", got)
	}
	c := custs[0].(map[string]any)
	if c["customer"] != "Slow Payer" || c["invoices"] != float64(2) || c["owedByCurrency"].(map[string]any)["USD"] != float64(100) {
		t.Fatalf("customer row: %v", c)
	}
}
