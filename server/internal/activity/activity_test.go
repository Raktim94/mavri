package activity

import (
	"bytes"
	"context"
	"crypto/hmac"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"io"
	"net/http"
	"net/http/httptest"
	"strings"
	"sync"
	"testing"
	"time"

	"github.com/Raktim94/mavri/server/internal/db"
	"github.com/Raktim94/mavri/server/internal/model"
	"github.com/Raktim94/mavri/server/internal/shop"
)

func newHub(t *testing.T) *Hub {
	t.Helper()
	d, err := db.Open(":memory:")
	if err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() { d.Close() })
	box, err := shop.NewBox(t.TempDir(), "")
	if err != nil {
		t.Fatal(err)
	}
	return &Hub{DB: d, Box: box}
}

func TestRecordKeepsSourceAndActor(t *testing.T) {
	h, ctx := newHub(t), context.Background()
	h.Record(WithSource(ctx, SourceAPI, "API key #3"), Event{Action: "created", Entity: "invoice", EntityID: 7, Label: "INV-1", Detail: "x"})
	h.Record(ctx, Event{Action: "backup", Entity: "backup"})
	items, total, err := h.List(ctx, Filter{})
	if err != nil || total != 2 || len(items) != 2 {
		t.Fatalf("list: %v %d %v", err, total, items)
	}
	if items[1].Source != SourceAPI || items[1].Actor != "API key #3" || items[1].Label != "INV-1" {
		t.Fatalf("entry: %+v", items[1])
	}
	if items[0].Source != SourceSystem {
		t.Fatalf("an unmarked context is the system: %+v", items[0])
	}
	if _, n, _ := h.List(ctx, Filter{Source: SourceAPI}); n != 1 {
		t.Fatalf("source filter: %d", n)
	}
	if _, n, _ := h.List(ctx, Filter{Query: "INV-1"}); n != 1 {
		t.Fatalf("query filter: %d", n)
	}
	if _, n, _ := h.List(ctx, Filter{Query: "%"}); n != 0 {
		t.Fatalf("a percent sign must match literally: %d", n)
	}
}

func TestCSVNeutralisesFormulas(t *testing.T) {
	h, ctx := newHub(t), context.Background()
	h.Record(ctx, Event{Action: "created", Entity: "customer", Label: `=HYPERLINK("http://evil")`})
	var buf bytes.Buffer
	if err := h.WriteCSV(ctx, &buf, Filter{}); err != nil {
		t.Fatal(err)
	}
	if strings.Contains(buf.String(), ",=HYPERLINK") || !strings.Contains(buf.String(), "'=HYPERLINK") {
		t.Fatalf("formula not neutralised:\n%s", buf.String())
	}
}

func TestDocEvents(t *testing.T) {
	base := model.Document{ID: 1, Kind: "invoice", FullNumber: "INV-1", Status: "unpaid", Totals: model.Totals{TotalCents: 100}}
	if ev := DocEvents(nil, base); len(ev) != 1 || ev[0].Name != "invoice.created" {
		t.Fatalf("create: %+v", ev)
	}
	paid := base
	paid.Status, paid.Payments, paid.PaidCents = "paid", []model.Payment{{AmountCents: 100, PaidOn: "2026-10-01"}}, 100
	names := map[string]bool{}
	for _, e := range DocEvents(&base, paid) {
		names[e.Name] = true
	}
	if !names["invoice.paid"] || !names["payment.recorded"] {
		t.Fatalf("paid: %v", names)
	}
	q := model.Document{ID: 2, Kind: "quote", FullNumber: "Q-1", Status: "open"}
	acc := q
	acc.Status = "accepted"
	if ev := DocEvents(&q, acc); len(ev) != 1 || ev[0].Name != "quote.accepted" {
		t.Fatalf("accept: %+v", ev)
	}
	// Saving without a change still says "updated" so the history shows the save.
	if ev := DocEvents(&base, base); len(ev) != 1 || ev[0].Name != "invoice.updated" {
		t.Fatalf("no-op save: %+v", ev)
	}
}

func TestWebhookDeliverySignsAndRetries(t *testing.T) {
	h, ctx := newHub(t), context.Background()
	now := time.Date(2026, 10, 1, 12, 0, 0, 0, time.UTC)
	h.Now = func() time.Time { return now }

	var mu sync.Mutex
	var got []*http.Request
	var bodies [][]byte
	status := http.StatusInternalServerError
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		b, _ := io.ReadAll(r.Body)
		mu.Lock()
		got, bodies = append(got, r), append(bodies, b)
		code := status
		mu.Unlock()
		w.WriteHeader(code)
	}))
	defer srv.Close()

	ep, secret, err := h.CreateEndpoint(ctx, srv.URL, "test", []string{"invoice.paid"})
	if err != nil || !strings.HasPrefix(secret, "whsec_") {
		t.Fatalf("create: %v %q", err, secret)
	}
	h.Record(ctx, Event{Action: "created", Entity: "invoice", Name: "invoice.created", Data: map[string]any{"a": 1}})
	if ds, _ := h.Deliveries(ctx, 0, "", 10); len(ds) != 0 {
		t.Fatalf("an unsubscribed event was queued: %+v", ds)
	}
	h.Record(ctx, Event{Action: "paid", Entity: "invoice", Name: "invoice.paid", Data: map[string]any{"a": 2}})
	client := &http.Client{}
	h.DeliverDue(ctx, client)

	ds, _ := h.Deliveries(ctx, ep.ID, "", 10)
	if len(ds) != 1 || ds[0].Status != "pending" || ds[0].Attempts != 1 || ds[0].ResponseCode != 500 {
		t.Fatalf("after a failed attempt: %+v", ds)
	}
	// Not due again until the backoff passes.
	h.DeliverDue(ctx, client)
	if len(got) != 1 {
		t.Fatalf("retried too early: %d requests", len(got))
	}
	mu.Lock()
	status = http.StatusOK
	mu.Unlock()
	now = now.Add(2 * time.Minute)
	h.DeliverDue(ctx, client)
	ds, _ = h.Deliveries(ctx, ep.ID, "", 10)
	if ds[0].Status != "delivered" || ds[0].Attempts != 2 {
		t.Fatalf("after the retry: %+v", ds[0])
	}

	// The receiver can verify the signature with the secret it was shown.
	r, body := got[1], bodies[1]
	sig := r.Header.Get("Mavri-Signature")
	parts := strings.Split(sig, ",")
	if len(parts) != 2 || !strings.HasPrefix(parts[0], "t=") || !strings.HasPrefix(parts[1], "v1=") {
		t.Fatalf("signature header: %q", sig)
	}
	m := hmac.New(sha256.New, []byte(secret))
	m.Write([]byte(strings.TrimPrefix(parts[0], "t=") + "."))
	m.Write(body)
	if strings.TrimPrefix(parts[1], "v1=") != hex.EncodeToString(m.Sum(nil)) {
		t.Fatal("signature does not verify")
	}
	var env map[string]any
	_ = json.Unmarshal(body, &env)
	if env["type"] != "invoice.paid" || env["id"] == "" || r.Header.Get("Mavri-Event") != "invoice.paid" {
		t.Fatalf("envelope: %v", env)
	}

	// Replay creates a fresh delivery of the same event.
	id, err := h.Replay(ctx, ds[0].ID)
	if err != nil || id == ds[0].ID {
		t.Fatalf("replay: %v %d", err, id)
	}
	h.DeliverDue(ctx, client)
	ds, _ = h.Deliveries(ctx, ep.ID, "delivered", 10)
	if len(ds) != 2 || ds[0].EventID != ds[1].EventID {
		t.Fatalf("replayed deliveries: %+v", ds)
	}
}

func TestWebhookGivesUpAfterTheLastRetry(t *testing.T) {
	h, ctx := newHub(t), context.Background()
	now := time.Date(2026, 10, 1, 12, 0, 0, 0, time.UTC)
	h.Now = func() time.Time { return now }
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) { w.WriteHeader(502) }))
	defer srv.Close()
	ep, _, _ := h.CreateEndpoint(ctx, srv.URL, "", nil)
	h.Record(ctx, Event{Name: "invoice.created", Action: "created", Entity: "invoice"})
	for i := 0; i < len(retryDelays)+2; i++ {
		h.DeliverDue(ctx, &http.Client{})
		now = now.Add(7 * time.Hour)
	}
	ds, _ := h.Deliveries(ctx, ep.ID, "", 10)
	if ds[0].Status != "failed" || ds[0].Attempts != len(retryDelays)+1 || ds[0].NextAttemptAt != "" {
		t.Fatalf("expected a failed delivery after %d attempts: %+v", len(retryDelays)+1, ds[0])
	}
	eps, _ := h.Endpoints(ctx)
	if eps[0].Failing != 1 {
		t.Fatalf("endpoint failing count: %+v", eps[0])
	}
}

func TestEndpointValidation(t *testing.T) {
	h, ctx := newHub(t), context.Background()
	for _, u := range []string{"", "ftp://x.co", "not a url", "http://"} {
		if _, _, err := h.CreateEndpoint(ctx, u, "", nil); err == nil {
			t.Fatalf("accepted %q", u)
		}
	}
	if _, _, err := h.CreateEndpoint(ctx, "https://x.co/hook", "", []string{"invoice.nonsense"}); err == nil {
		t.Fatal("accepted an unknown event")
	}
	if err := h.DeleteEndpoint(ctx, 99); err != ErrNotFound {
		t.Fatalf("delete missing: %v", err)
	}
}
