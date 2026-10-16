package store

import (
	"context"
	"errors"
	"testing"
	"time"

	"github.com/Raktim94/mavri/server/internal/db"
	"github.com/Raktim94/mavri/server/internal/model"
)

type fixture struct {
	s                *Store
	issuer, customer model.Party
	usd              model.Currency
}

func newFixture(t *testing.T) fixture {
	t.Helper()
	d, err := db.Open(":memory:")
	if err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() { d.Close() })
	ctx := context.Background()
	s := &Store{DB: d, Now: func() time.Time { return time.Date(2026, 10, 12, 9, 0, 0, 0, time.UTC) }}
	f := fixture{s: s}
	f.issuer = model.Party{Kind: "issuer", Name: "Northwind"}
	f.customer = model.Party{Kind: "customer", Name: "Acme"}
	for _, p := range []*model.Party{&f.issuer, &f.customer} {
		if err := Parties.Insert(ctx, d, p); err != nil {
			t.Fatal(err)
		}
	}
	cs, _ := Currencies.Select(ctx, d, "WHERE code = 'USD'")
	f.usd = cs[0]
	return f
}

func (f fixture) doc(kind string) model.Document {
	return model.Document{Kind: kind, IssuerID: f.issuer.ID, CustomerID: f.customer.ID, CurrencyID: f.usd.ID, IssuedOn: "2026-10-01",
		Lines: []model.Line{{Name: "Work", Quantity: 3, UnitCents: 10000, TaxRate: 10, TaxMode: "add"}}}
}

func TestCreateComputesTotalsAndNumbers(t *testing.T) {
	f, ctx := newFixture(t), context.Background()
	a, err := f.s.CreateDocument(ctx, f.doc("invoice"), SaveOptions{})
	if err != nil {
		t.Fatal(err)
	}
	if a.Number != "1" || a.Totals.TotalCents != 33000 || a.Status != "unpaid" || a.Customer.Name != "Acme" || a.Currency.Code != "USD" {
		t.Fatalf("unexpected: %+v", a)
	}
	b, _ := f.s.CreateDocument(ctx, f.doc("invoice"), SaveOptions{})
	if b.Number != "2" {
		t.Fatalf("second number %q", b.Number)
	}
	// Zero padding is kept.
	z := f.doc("invoice")
	z.Number = "0099"
	f.s.CreateDocument(ctx, z, SaveOptions{})
	if n, _ := f.s.NextNumber(ctx, f.s.DB, f.issuer.ID, "invoice", "", ""); n != "0100" {
		t.Fatalf("padded next number %q", n)
	}
	// Numbers are unique per issuer, kind and affixes.
	dup := f.doc("invoice")
	dup.Number = "1"
	if _, err := f.s.CreateDocument(ctx, dup, SaveOptions{}); !errors.As(err, &Validation{}) {
		t.Fatalf("duplicate number: %v", err)
	}
	if q, _ := f.s.CreateDocument(ctx, f.doc("quote"), SaveOptions{}); q.Number != "1" || q.FullNumber != "Q-1" || q.Status != "open" {
		t.Fatalf("quote: %+v", q)
	}
}

func TestPaymentsDriveStatus(t *testing.T) {
	f, ctx := newFixture(t), context.Background()
	in := f.doc("invoice")
	in.Payments = []model.Payment{{AmountCents: 10000, PaidOn: "2026-10-02"}}
	d, err := f.s.CreateDocument(ctx, in, SaveOptions{})
	if err != nil || d.Status != "partial" || d.PaidCents != 10000 {
		t.Fatalf("partial: %+v %v", d.Status, err)
	}
	in.Payments = append(in.Payments, model.Payment{AmountCents: 23000, PaidOn: "2026-10-03"})
	d, err = f.s.UpdateDocument(ctx, d.ID, in, SaveOptions{})
	if err != nil || d.Status != "paid" {
		t.Fatalf("paid: %v %v", d.Status, err)
	}
	in.Status = "void"
	if d, _ = f.s.UpdateDocument(ctx, d.ID, in, SaveOptions{}); d.Status != "void" {
		t.Fatalf("void: %v", d.Status)
	}
	q := f.doc("quote")
	q.Payments = in.Payments
	if _, err := f.s.CreateDocument(ctx, q, SaveOptions{}); err == nil {
		t.Fatal("quote with payments accepted")
	}
}

func TestSnapshotsSurviveEditsUnlessRefreshed(t *testing.T) {
	f, ctx := newFixture(t), context.Background()
	d, _ := f.s.CreateDocument(ctx, f.doc("invoice"), SaveOptions{})
	f.customer.Name = "Acme Renamed"
	if err := Parties.Update(ctx, f.s.DB, &f.customer); err != nil {
		t.Fatal(err)
	}
	same, _ := f.s.UpdateDocument(ctx, d.ID, f.doc("invoice"), SaveOptions{})
	if same.Number != d.Number {
		t.Fatalf("an update without a number changed it: %q -> %q", d.Number, same.Number)
	}
	if same.Customer.Name != "Acme" {
		t.Fatalf("snapshot changed: %q", same.Customer.Name)
	}
	fresh, _ := f.s.UpdateDocument(ctx, d.ID, f.doc("invoice"), SaveOptions{RefreshDetails: true})
	if fresh.Customer.Name != "Acme Renamed" {
		t.Fatalf("refresh did not copy: %q", fresh.Customer.Name)
	}
}

func TestValidation(t *testing.T) {
	f, ctx := newFixture(t), context.Background()
	bad := []func(*model.Document){
		func(d *model.Document) { d.Lines = nil },
		func(d *model.Document) { d.IssuedOn = "yesterday" },
		func(d *model.Document) { d.Lines[0].Name = " " },
		func(d *model.Document) { d.Lines[0].Quantity = 0 },
		func(d *model.Document) { d.Discount = model.Adjustment{Mode: "percent", Percent: 150} },
		func(d *model.Document) { d.TaxMode = "weird" },
		func(d *model.Document) { d.CustomerID = f.issuer.ID }, // an issuer is not a customer
		func(d *model.Document) { d.CurrencyID = 9999 },
		func(d *model.Document) { d.Kind = "memo" },
	}
	for i, mutate := range bad {
		d := f.doc("invoice")
		mutate(&d)
		if _, err := f.s.CreateDocument(ctx, d, SaveOptions{}); !errors.As(err, &Validation{}) {
			t.Errorf("case %d: expected validation error, got %v", i, err)
		}
	}
}

func TestDuplicateConvertDelete(t *testing.T) {
	f, ctx := newFixture(t), context.Background()
	q, _ := f.s.CreateDocument(ctx, f.doc("quote"), SaveOptions{})
	inv, err := f.s.Convert(ctx, q.ID)
	if err != nil || inv.Kind != "invoice" || inv.ConvertedFrom == nil || *inv.ConvertedFrom != q.ID || inv.Totals.TotalCents != 33000 {
		t.Fatalf("convert: %+v %v", inv, err)
	}
	if got, _ := f.s.GetDocument(ctx, f.s.DB, q.ID); got.Status != "accepted" {
		t.Fatalf("quote status %q", got.Status)
	}
	if _, err := f.s.Convert(ctx, q.ID); err == nil {
		t.Fatal("converted twice")
	}
	if _, err := f.s.Convert(ctx, inv.ID); err == nil {
		t.Fatal("converted an invoice")
	}
	copy, err := f.s.Duplicate(ctx, inv.ID)
	if err != nil || copy.ID == inv.ID || copy.Number == inv.Number || copy.IssuedOn != "2026-10-12" || len(copy.Payments) != 0 {
		t.Fatalf("duplicate: %+v %v", copy, err)
	}
	if err := f.s.DeleteDocument(ctx, copy.ID); err != nil {
		t.Fatal(err)
	}
	if _, err := f.s.GetDocument(ctx, f.s.DB, copy.ID); !errors.Is(err, db.ErrNotFound) {
		t.Fatalf("deleted still found: %v", err)
	}
	// An issuer with documents cannot be deleted.
	if err := Parties.Delete(ctx, f.s.DB, f.issuer.ID); !errors.Is(err, db.ErrConflict) {
		t.Fatalf("delete in-use party: %v", err)
	}
}

func TestListFiltersAndReport(t *testing.T) {
	f, ctx := newFixture(t), context.Background()
	mk := func(date string, paid int64) {
		d := f.doc("invoice")
		d.IssuedOn = date
		if paid > 0 {
			d.Payments = []model.Payment{{AmountCents: paid, PaidOn: date}}
		}
		if _, err := f.s.CreateDocument(ctx, d, SaveOptions{}); err != nil {
			t.Fatal(err)
		}
	}
	mk("2026-01-10", 33000)
	mk("2026-01-20", 0)
	mk("2026-03-05", 0)
	mk("2025-12-31", 0)
	all, total, err := f.s.ListDocuments(ctx, Filter{Kind: "invoice"})
	if err != nil || total != 4 || len(all) != 4 || all[0].IssuedOn != "2026-03-05" || all[0].TotalCents != 33000 {
		t.Fatalf("list: %+v %v", all, err)
	}
	if r, n, _ := f.s.ListDocuments(ctx, Filter{Kind: "invoice", Status: "paid"}); n != 1 || r[0].PaidCents != 33000 {
		t.Fatalf("status filter: %+v", r)
	}
	if _, n, _ := f.s.ListDocuments(ctx, Filter{Query: "acme"}); n != 4 {
		t.Fatalf("search by customer: %d", n)
	}
	if _, n, _ := f.s.ListDocuments(ctx, Filter{From: "2026-01-01", To: "2026-01-31"}); n != 2 {
		t.Fatalf("date range: %d", n)
	}
	if r, n, _ := f.s.ListDocuments(ctx, Filter{Limit: 2, Offset: 3}); n != 4 || len(r) != 1 {
		t.Fatalf("paging: %d %d", n, len(r))
	}
	rep, _ := f.s.YearReport(ctx, "2026")
	if len(rep.ByMonth) != 2 || rep.ByMonth[0].Label != "2026-01" || rep.ByMonth[0].BilledCents != 66000 || rep.ByMonth[0].PaidCents != 33000 ||
		len(rep.ByCustomer) != 1 || rep.ByCustomer[0].Count != 3 || len(rep.Years) != 2 || rep.Years[0] != "2026" {
		t.Fatalf("report: %+v", rep)
	}
}

func TestSettingsAndChecks(t *testing.T) {
	f, ctx := newFixture(t), context.Background()
	got, _ := f.s.GetSettings(ctx, f.s.DB)
	if !got.Features.Quotes || got.DateFormat != "yyyy-MM-dd" {
		t.Fatalf("defaults: %+v", got)
	}
	got.InvoicePrefix, got.Features.Reports = "INV-", false
	if err := f.s.SaveSettings(ctx, got); err != nil {
		t.Fatal(err)
	}
	again, _ := f.s.GetSettings(ctx, f.s.DB)
	if again.InvoicePrefix != "INV-" || again.Features.Reports || !again.Features.Quotes {
		t.Fatalf("saved: %+v", again)
	}
	// New invoices pick the configured prefix.
	d, _ := f.s.CreateDocument(ctx, f.doc("invoice"), SaveOptions{})
	if d.FullNumber != "INV-1" {
		t.Fatalf("prefix: %q", d.FullNumber)
	}
	if CheckParty(&model.Party{Kind: "issuer", Name: " "}) == nil || CheckCurrency(&model.Currency{Code: "US", Symbol: "$", Name: "x"}) == nil ||
		CheckStyle(&model.Style{Name: "s", Accent: "red"}) == nil {
		t.Fatal("checks should reject")
	}
}

func TestCheckStyleTemplate(t *testing.T) {
	ok := model.Style{Name: "a", Accent: "#112233", Template: "blue-wave"}
	if err := CheckStyle(&ok); err != nil {
		t.Fatalf("known template rejected: %v", err)
	}
	blank := model.Style{Name: "a", Accent: "#112233"}
	if err := CheckStyle(&blank); err != nil {
		t.Fatalf("empty template (original layout) rejected: %v", err)
	}
	bad := model.Style{Name: "a", Accent: "#112233", Template: "nope"}
	if err := CheckStyle(&bad); err == nil {
		t.Fatal("unknown template accepted")
	}
	if len(Templates) != 15 {
		t.Fatalf("want 15 templates, have %d", len(Templates))
	}
}

func TestCheckPartyLanguage(t *testing.T) {
	ok := model.Party{Kind: "customer", Name: "A", Language: " FR "}
	if err := CheckParty(&ok); err != nil || ok.Language != "fr" {
		t.Fatalf("a known language is kept in lower case: %v %q", err, ok.Language)
	}
	empty := model.Party{Kind: "customer", Name: "A"}
	if err := CheckParty(&empty); err != nil {
		t.Fatalf("no language means the default: %v", err)
	}
	bad := model.Party{Kind: "customer", Name: "A", Language: "xx"}
	if err := CheckParty(&bad); err == nil {
		t.Fatal("an unknown language was accepted")
	}
}
