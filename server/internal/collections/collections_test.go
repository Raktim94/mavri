package collections

import (
	"context"
	"errors"
	"testing"
	"time"

	"github.com/Raktim94/mavri/server/internal/activity"
	"github.com/Raktim94/mavri/server/internal/db"
	"github.com/Raktim94/mavri/server/internal/model"
	"github.com/Raktim94/mavri/server/internal/shop"
	"github.com/Raktim94/mavri/server/internal/store"
)

type env struct {
	s      *Service
	issuer model.Party
	cust   model.Party
}

func setup(t *testing.T, today string) env {
	t.Helper()
	d, err := db.Open(":memory:")
	if err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() { d.Close() })
	box, _ := shop.NewBox(t.TempDir(), "")
	day, _ := time.Parse("2006-01-02", today)
	st := &store.Store{DB: d, Now: func() time.Time { return day }}
	s := &Service{DB: d, Store: st, Hub: &activity.Hub{DB: d, Box: box}}
	ctx := context.Background()
	issuer := model.Party{Kind: "issuer", Name: "Me"}
	cust := model.Party{Kind: "customer", Name: "Client", Email: "c@x.co"}
	store.Parties.Insert(ctx, d, &issuer)
	store.Parties.Insert(ctx, d, &cust)
	return env{s, issuer, cust}
}

func (e env) invoice(t *testing.T, due string, paid int64) model.Document {
	t.Helper()
	doc := model.Document{Kind: "invoice", IssuerID: e.issuer.ID, CustomerID: e.cust.ID, CurrencyID: 1, IssuedOn: "2026-09-01", DueOn: due,
		Lines: []model.Line{{Name: "Work", Quantity: 1, UnitCents: 10000}}}
	if paid > 0 {
		doc.Payments = []model.Payment{{AmountCents: paid, PaidOn: "2026-09-02", Method: "bank"}}
	}
	d, err := e.s.Store.CreateDocument(context.Background(), doc, store.SaveOptions{})
	if err != nil {
		t.Fatal(err)
	}
	return d
}

func reasons(a Attention) map[string]string {
	m := map[string]string{}
	for _, it := range a.Items {
		m[it.Number] = it.Reason
	}
	return m
}

func TestAttentionSortsByUrgency(t *testing.T) {
	e := setup(t, "2026-10-12")
	ctx := context.Background()
	overdue := e.invoice(t, "2026-10-01", 0)
	soon := e.invoice(t, "2026-10-15", 0)
	far := e.invoice(t, "2026-12-30", 0)
	part := e.invoice(t, "2026-12-30", 2000)
	disputed := e.invoice(t, "2026-10-20", 0)
	paid := e.invoice(t, "2026-10-01", 10000)
	if _, err := e.s.Add(ctx, disputed.ID, Input{Kind: Dispute, Note: "Wrong quantity"}); err != nil {
		t.Fatal(err)
	}
	a, err := e.s.Attention(ctx)
	if err != nil {
		t.Fatal(err)
	}
	got := reasons(a)
	want := map[string]string{overdue.FullNumber: ReasonOverdue, soon.FullNumber: ReasonDueSoon, part.FullNumber: ReasonPartial, disputed.FullNumber: ReasonDisputed}
	for n, r := range want {
		if got[n] != r {
			t.Errorf("%s: got %q want %q", n, got[n], r)
		}
	}
	if _, ok := got[far.FullNumber]; ok {
		t.Error("an invoice due in months does not need attention")
	}
	if _, ok := got[paid.FullNumber]; ok {
		t.Error("a paid invoice does not need attention")
	}
	if a.Items[0].Reason != ReasonDisputed {
		t.Errorf("a dispute comes first, got %q", a.Items[0].Reason)
	}
}

func TestPromisesAndSnoozes(t *testing.T) {
	e := setup(t, "2026-10-12")
	ctx := context.Background()
	late := e.invoice(t, "2026-10-01", 0)
	kept := e.invoice(t, "2026-10-01", 0)
	paused := e.invoice(t, "2026-10-01", 0)
	if _, err := e.s.Add(ctx, late.ID, Input{Kind: Promise, DueOn: "2026-10-12", AmountCents: 10000}); err != nil {
		t.Fatal(err)
	}
	if _, err := e.s.Add(ctx, kept.ID, Input{Kind: Promise, DueOn: "2026-10-20"}); err != nil {
		t.Fatal(err)
	}
	if _, err := e.s.Add(ctx, paused.ID, Input{Kind: Snooze, DueOn: "2026-10-30"}); err != nil {
		t.Fatal(err)
	}
	a, _ := e.s.Attention(ctx)
	got := reasons(a)
	if got[late.FullNumber] != ReasonPromised || got[kept.FullNumber] != ReasonPromised {
		t.Fatalf("promises not yet due are listed as promised: %v", got)
	}
	if _, ok := got[paused.FullNumber]; ok || a.Snoozed != 1 {
		t.Fatalf("a paused invoice is left off the list and counted: %v snoozed=%d", got, a.Snoozed)
	}
	// Eight days later the promises have lapsed, and the pause is still on.
	e.s.Store.Now = func() time.Time { d, _ := time.Parse("2006-01-02", "2026-10-21"); return d }
	a, _ = e.s.Attention(ctx)
	got = reasons(a)
	if got[late.FullNumber] != ReasonBrokenPromise || got[kept.FullNumber] != ReasonBrokenPromise {
		t.Fatalf("a lapsed promise is flagged: %v", got)
	}
}

func TestResolveClosesADispute(t *testing.T) {
	e := setup(t, "2026-10-12")
	ctx := context.Background()
	d := e.invoice(t, "2026-10-01", 0)
	f, _ := e.s.Add(ctx, d.ID, Input{Kind: Dispute, Note: "Not ours"})
	if _, err := e.s.Resolve(ctx, f.ID); err != nil {
		t.Fatal(err)
	}
	a, _ := e.s.Attention(ctx)
	if reasons(a)[d.FullNumber] != ReasonOverdue {
		t.Fatalf("after the dispute is settled the invoice is just overdue: %v", reasons(a))
	}
	list, _ := e.s.List(ctx, d.ID)
	if len(list) != 1 || list[0].Status != "resolved" || list[0].ResolvedAt == "" {
		t.Fatalf("history is kept: %+v", list)
	}
}

func TestValidation(t *testing.T) {
	e := setup(t, "2026-10-12")
	ctx := context.Background()
	d := e.invoice(t, "2026-10-01", 0)
	cases := map[string]Input{
		"no date":      {Kind: Promise},
		"past date":    {Kind: Promise, DueOn: "2026-10-01"},
		"long pause":   {Kind: Snooze, DueOn: "2027-06-01"},
		"empty note":   {Kind: Dispute},
		"unknown kind": {Kind: "fee", Note: "x"},
		"negative":     {Kind: Promise, DueOn: "2026-10-20", AmountCents: -1},
	}
	for name, in := range cases {
		if _, err := e.s.Add(ctx, d.ID, in); !errors.Is(err, ErrInvalid) {
			t.Errorf("%s: want ErrInvalid, got %v", name, err)
		}
	}
	q, _ := e.s.Store.CreateDocument(ctx, model.Document{Kind: "quote", IssuerID: e.issuer.ID, CustomerID: e.cust.ID, CurrencyID: 1, IssuedOn: "2026-10-01",
		Lines: []model.Line{{Name: "x", Quantity: 1, UnitCents: 100}}}, store.SaveOptions{})
	if _, err := e.s.Add(ctx, q.ID, Input{Kind: Note, Note: "x"}); !errors.Is(err, ErrInvalid) {
		t.Errorf("a quote has no follow-ups: %v", err)
	}
	if _, err := e.s.Add(ctx, 9999, Input{Kind: Note, Note: "x"}); !errors.Is(err, ErrNotFound) {
		t.Errorf("unknown invoice: %v", err)
	}
}
