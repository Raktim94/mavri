package mcp

import (
	"bufio"
	"bytes"
	"context"
	"database/sql"
	"encoding/json"
	"fmt"
	"io"
	"path/filepath"
	"strings"
	"testing"

	"github.com/Raktim94/nodedr-invoice/rewrite/internal/entity"
	"github.com/Raktim94/nodedr-invoice/rewrite/internal/invoices"
	"github.com/Raktim94/nodedr-invoice/rewrite/internal/orders"
	"github.com/Raktim94/nodedr-invoice/rewrite/internal/secrets"
	"github.com/Raktim94/nodedr-invoice/rewrite/internal/store/sqlitestore"
)

// testDB is the database of the session being tested (tests here do not run in parallel).
var testDB *sql.DB

type session struct {
	t   *testing.T
	in  *io.PipeWriter
	out *bufio.Reader
	id  int
}

func newSession(t *testing.T) *session {
	dir := t.TempDir()
	db, err := sqlitestore.Open(filepath.Join(dir, "t.db"))
	if err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() { db.Close() })
	testDB = db.DB()
	repo := entity.Repo{DB: db.DB()}
	inv := &invoices.Service{Repo: repo}
	srv := New("nodedr-invoice", "1.0.0", Tools(Deps{Repo: repo, Invoices: inv,
		Orders: &orders.Service{Repo: repo, Invoices: inv, Box: &secrets.Box{Dir: dir}}}))
	inR, inW := io.Pipe()
	outR, outW := io.Pipe()
	done := make(chan struct{})
	go func() { srv.Serve(context.Background(), inR, outW); outW.Close(); close(done) }()
	t.Cleanup(func() { inW.Close(); <-done })
	return &session{t: t, in: inW, out: bufio.NewReader(outR)}
}

func (s *session) send(method string, params any) map[string]any {
	s.t.Helper()
	s.id++
	msg, _ := json.Marshal(map[string]any{"jsonrpc": "2.0", "id": s.id, "method": method, "params": params})
	if _, err := s.in.Write(append(msg, '\n')); err != nil {
		s.t.Fatal(err)
	}
	line, err := s.out.ReadBytes('\n')
	if err != nil {
		s.t.Fatalf("no reply to %s: %v", method, err)
	}
	var m map[string]any
	if err := json.Unmarshal(line, &m); err != nil {
		s.t.Fatalf("bad reply %q: %v", line, err)
	}
	if m["id"] != float64(s.id) {
		s.t.Fatalf("reply for another request: %v", m)
	}
	return m
}

// call runs a tool and returns the text and whether it was flagged as an error.
func (s *session) call(name string, args any) (string, bool) {
	s.t.Helper()
	m := s.send("tools/call", map[string]any{"name": name, "arguments": args})
	res, ok := m["result"].(map[string]any)
	if !ok {
		s.t.Fatalf("%s: %v", name, m)
	}
	text := res["content"].([]any)[0].(map[string]any)["text"].(string)
	isErr, _ := res["isError"].(bool)
	return text, isErr
}

func (s *session) data(name string, args any) map[string]any {
	s.t.Helper()
	text, isErr := s.call(name, args)
	if isErr {
		s.t.Fatalf("%s failed: %s", name, text)
	}
	var m map[string]any
	if err := json.Unmarshal([]byte(text), &m); err != nil {
		s.t.Fatalf("%s: not an object: %s", name, text)
	}
	return m
}

func TestHandshakeAndToolList(t *testing.T) {
	s := newSession(t)
	init := s.send("initialize", map[string]any{"protocolVersion": "2025-03-26", "capabilities": map[string]any{}, "clientInfo": map[string]any{"name": "t", "version": "1"}})
	r := init["result"].(map[string]any)
	if r["protocolVersion"] != "2025-03-26" || r["serverInfo"].(map[string]any)["name"] != "nodedr-invoice" {
		t.Errorf("initialize: %v", r)
	}
	if v := s.send("initialize", map[string]any{"protocolVersion": "1999-01-01"})["result"].(map[string]any)["protocolVersion"]; v != "2025-06-18" {
		t.Errorf("unknown version should get the newest: %v", v)
	}
	if s.send("ping", nil)["result"] == nil {
		t.Error("ping")
	}
	tools := s.send("tools/list", nil)["result"].(map[string]any)["tools"].([]any)
	var names []string
	for _, tool := range tools {
		m := tool.(map[string]any)
		names = append(names, m["name"].(string))
		if schema := m["inputSchema"].(map[string]any); schema["type"] != "object" {
			t.Errorf("%s has no object schema", m["name"])
		}
	}
	want := "list_clients get_client create_client update_client delete_client list_items create_item update_item delete_item " +
		"list_us_sales_tax_rates list_invoices get_invoice create_invoice update_invoice_status record_payment delete_invoice " +
		"list_ecommerce_integrations create_ecommerce_integration deactivate_ecommerce_integration create_invoice_from_order"
	if strings.Join(names, " ") != want {
		t.Errorf("tools:\n got %v\nwant %s", names, want)
	}
	if m := s.send("nope", nil); m["error"].(map[string]any)["code"] != float64(-32601) {
		t.Errorf("unknown method: %v", m)
	}
	if text, isErr := s.call("nope", map[string]any{}); !isErr || text != "MCP error -32602: Tool nope not found" {
		t.Errorf("unknown tool: %q %v", text, isErr)
	}
}

func TestArgumentsAreValidated(t *testing.T) {
	s := newSession(t)
	for name, args := range map[string]map[string]any{
		"create_client":  {"name": "Acme", "shortName": "ABC"}, // shortName too long
		"get_client":     {},                                   // id missing
		"list_invoices":  {"status": "bogus"},
		"create_invoice": {"businessId": 1, "clientId": 1, "currencyId": 1, "items": []any{}},
		"delete_client":  {"id": "1"},
	} {
		text, isErr := s.call(name, args)
		if !isErr || !strings.HasPrefix(text, "MCP error -32602: Input validation error: Invalid arguments for tool "+name+": ") {
			t.Errorf("%s: %q err=%v", name, text, isErr)
		}
	}
}

func TestClientAndItemTools(t *testing.T) {
	s := newSession(t)
	c := s.data("create_client", map[string]any{"name": "Acme", "shortName": "AC", "email": "a@acme.test"})
	if c["name"] != "Acme" || c["taxExempt"] != false || c["id"] == nil {
		t.Fatalf("create: %v", c)
	}
	text, _ := s.call("list_clients", map[string]any{})
	if !strings.Contains(text, "Acme") || !strings.Contains(text, "\n  ") {
		t.Errorf("list should be pretty JSON: %s", text)
	}
	s.data("update_client", map[string]any{"id": c["id"], "name": "Acme", "shortName": "AC", "isArchived": true})
	if text, _ := s.call("list_clients", map[string]any{}); strings.Contains(text, "Acme") {
		t.Errorf("archived clients are hidden by default: %s", text)
	}
	if text, _ := s.call("list_clients", map[string]any{"includeArchived": true}); !strings.Contains(text, "Acme") {
		t.Errorf("includeArchived: %s", text)
	}
	if text, isErr := s.call("get_client", map[string]any{"id": 999}); !isErr || !strings.Contains(text, `"message":"error.clientNotFound"`) {
		t.Errorf("get missing: %s", text)
	}
	if got := s.data("delete_client", map[string]any{"id": c["id"]}); got["success"] != true {
		t.Errorf("delete: %v", got)
	}
	item := s.data("create_item", map[string]any{"name": "Widget", "amount": "1999"})
	if item["amount"] != "1999" || item["unitName"] != nil {
		t.Errorf("item: %v", item)
	}
	if text, _ := s.call("list_us_sales_tax_rates", map[string]any{}); !strings.Contains(text, "Alabama") {
		t.Errorf("tax rates: %.80s", text)
	}
}

func TestInvoiceTools(t *testing.T) {
	s := newSession(t)
	biz, _ := s.callRaw("INSERT INTO businesses (name, shortName) VALUES ('Me','ME')")
	_ = biz
	client := s.data("create_client", map[string]any{"name": "Acme", "shortName": "AC"})
	item := s.data("create_item", map[string]any{"name": "Widget", "amount": "1999"})
	args := map[string]any{"businessId": 1, "clientId": client["id"], "currencyId": 1, "usSalesTaxState": "ca", "discountPercent": 10,
		"items": []any{map[string]any{"itemId": item["id"], "quantity": "2"}}}
	inv := s.data("create_invoice", args)
	if inv["invoiceNumber"] != "1" || inv["taxName"] != "California Sales Tax" || inv["taxType"] != "exclusive" || inv["status"] != "unpaid" {
		t.Errorf("created: number=%v tax=%v/%v status=%v", inv["invoiceNumber"], inv["taxName"], inv["taxType"], inv["status"])
	}
	line := inv["invoiceItems"].([]any)[0].(map[string]any)
	if line["invoiceItemSnapshot"].(map[string]any)["unitPriceCents"] != "1999" {
		t.Errorf("snapshot: %v", line)
	}
	id := inv["id"]
	if text, isErr := s.call("create_invoice", map[string]any{"businessId": 1, "clientId": 99, "currencyId": 1, "items": []any{map[string]any{"itemId": 1}}}); !isErr || !strings.Contains(text, "error.clientNotFound") {
		t.Errorf("missing client: %s", text)
	}
	if text, isErr := s.call("create_invoice", map[string]any{"businessId": 1, "clientId": client["id"], "currencyId": 1, "items": []any{map[string]any{"itemId": 77}}}); !isErr || !strings.Contains(text, "error.itemNotFound: 77") {
		t.Errorf("missing item: %s", text)
	}
	// Tax-exempt clients pay no tax whatever is asked.
	exempt := s.data("create_client", map[string]any{"name": "Charity", "shortName": "CH", "taxExempt": true})
	ex := s.data("create_invoice", map[string]any{"businessId": 1, "clientId": exempt["id"], "currencyId": 1, "taxRate": 20, "taxName": "VAT",
		"items": []any{map[string]any{"itemId": item["id"]}}})
	if ex["taxRate"] != float64(0) || ex["taxName"] != nil {
		t.Errorf("exempt: %v %v", ex["taxRate"], ex["taxName"])
	}

	paid := s.data("record_payment", map[string]any{"invoiceId": id, "amountCents": "500", "paymentMethod": "card"})
	if pays := paid["invoicePayments"].([]any); len(pays) != 1 {
		t.Fatalf("payments: %v", pays)
	}
	again := s.data("record_payment", map[string]any{"invoiceId": id, "amountCents": "250", "paymentMethod": "cash", "notes": "rest"})
	if pays := again["invoicePayments"].([]any); len(pays) != 2 {
		t.Errorf("second payment should add, not replace: %v", pays)
	}
	closed := s.data("update_invoice_status", map[string]any{"id": id, "status": "closed"})
	if closed["status"] != "closed" || closed["closedAt"] == nil || len(closed["invoicePayments"].([]any)) != 2 || len(closed["invoiceItems"].([]any)) != 1 {
		t.Errorf("status change must keep payments and items: %v", closed)
	}
	page := s.data("list_invoices", map[string]any{"status": "closed"})
	if page["total"] != float64(1) || page["items"].([]any)[0].(map[string]any)["totalPaidCents"] != float64(750) {
		t.Errorf("list: %v", page)
	}
	if got := s.data("get_invoice", map[string]any{"id": id}); got["id"] != id {
		t.Errorf("get: %v", got["id"])
	}
	if text, isErr := s.call("get_invoice", map[string]any{"id": 999}); !isErr || !strings.Contains(text, "error.invoiceNotFound") {
		t.Errorf("get missing: %s", text)
	}
	s.data("delete_invoice", map[string]any{"id": id})
	if page := s.data("list_invoices", map[string]any{"invoiceType": "invoice"}); page["total"] != float64(1) {
		t.Errorf("after delete (the exempt one remains): %v", page["total"])
	}
}

func TestEcommerceTools(t *testing.T) {
	s := newSession(t)
	s.callRaw("INSERT INTO businesses (name, shortName) VALUES ('Me','ME')")
	made := s.data("create_ecommerce_integration", map[string]any{"name": " Shop ", "platform": "generic", "businessId": 1, "currencyId": 1, "defaultTaxRate": 5})
	if !strings.HasPrefix(made["webhookSecret"].(string), "whsec_") || made["integration"].(map[string]any)["name"] != "Shop" || made["warning"] == nil {
		t.Fatalf("create: %v", made)
	}
	text, _ := s.call("list_ecommerce_integrations", map[string]any{})
	if strings.Contains(text, "whsec_") || strings.Contains(text, "webhookSecretEncrypted") || !strings.Contains(text, `"webhookUrl": "/api/webhooks/ecommerce/generic/1"`) {
		t.Errorf("list must never show secrets: %s", text)
	}
	order := map[string]any{"integrationId": 1, "externalOrderId": "M-1", "customerName": "Zo", "customerEmail": "zo@x.test",
		"lineItems": []any{map[string]any{"name": "Widget", "quantity": 2, "unitPriceMajor": 12.5}}, "shippingMajor": 5}
	first := s.data("create_invoice_from_order", order)
	if first["invoiceId"] == nil || first["invoiceNumber"] == nil {
		t.Fatalf("order: %v", first)
	}
	if dup := s.data("create_invoice_from_order", order); dup["deduplicated"] != true || dup["invoiceId"] != first["invoiceId"] {
		t.Errorf("redelivery: %v", dup)
	}
	s.data("deactivate_ecommerce_integration", map[string]any{"id": 1})
	order["externalOrderId"] = "M-2"
	if text, isErr := s.call("create_invoice_from_order", order); !isErr || !strings.Contains(text, "error.notFound") {
		t.Errorf("deactivated: %s", text)
	}
	if text, isErr := s.call("create_ecommerce_integration", map[string]any{"name": "x", "platform": "generic", "businessId": 99, "currencyId": 1}); !isErr || !strings.Contains(text, "error.invalidConstraintForeign") {
		t.Errorf("bad business: %s", text)
	}
}

func TestMalformedInputDoesNotKillTheServer(t *testing.T) {
	s := newSession(t)
	if _, err := s.in.Write([]byte("{\"jsonrpc\":\"2.0\",\"method\":\"notifications/initialized\"}\n")); err != nil {
		t.Fatal(err)
	}
	// A notification gets no reply; the next request is still answered.
	if s.send("ping", nil)["result"] == nil {
		t.Error("server stopped answering")
	}
	var buf bytes.Buffer
	srv := New("x", "1", nil)
	if err := srv.Serve(context.Background(), strings.NewReader("{not json"), &buf); err == nil {
		t.Error("unparsable input should end the session with an error")
	}
	if !strings.Contains(buf.String(), "-32700") {
		t.Errorf("parse error reply: %q", buf.String())
	}
	_ = fmt.Sprint
}

// callRaw runs SQL straight on the test database (fixtures the tools cannot create).
func (s *session) callRaw(q string) (int64, error) {
	s.t.Helper()
	res, err := testDB.Exec(q)
	if err != nil {
		s.t.Fatal(err)
	}
	return res.LastInsertId()
}
