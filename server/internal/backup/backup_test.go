package backup

import (
	"context"
	"encoding/json"
	"testing"

	"github.com/Raktim94/mavri/server/internal/db"
	"github.com/Raktim94/mavri/server/internal/model"
	"github.com/Raktim94/mavri/server/internal/store"
)

func seed(t *testing.T) *store.Store {
	t.Helper()
	d, err := db.Open(":memory:")
	if err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() { d.Close() })
	ctx := context.Background()
	s := &store.Store{DB: d}
	issuer := model.Party{Kind: "issuer", Name: "Me", Logo: []byte{0, 1, 2, 255}, LogoType: "image/png"}
	customer := model.Party{Kind: "customer", Name: "You"}
	store.Parties.Insert(ctx, d, &issuer)
	store.Parties.Insert(ctx, d, &customer)
	for i := 0; i < 2; i++ {
		_, err := s.CreateDocument(ctx, model.Document{Kind: "invoice", IssuerID: issuer.ID, CustomerID: customer.ID, CurrencyID: 1, IssuedOn: "2026-10-01",
			Lines:    []model.Line{{Name: "Work", Quantity: 1.5, UnitCents: 1000, TaxRate: 10, TaxMode: "add"}},
			Payments: []model.Payment{{AmountCents: 100, PaidOn: "2026-10-02"}}}, store.SaveOptions{})
		if err != nil {
			t.Fatal(err)
		}
	}
	return s
}

func TestRoundTrip(t *testing.T) {
	src, ctx := seed(t), context.Background()
	f, err := Export(ctx, src.DB)
	if err != nil {
		t.Fatal(err)
	}
	raw, _ := json.Marshal(f)
	parsed, err := Parse(raw)
	if err != nil {
		t.Fatal(err)
	}
	dst, _ := db.Open(":memory:")
	defer dst.Close()
	// Something that the restore must replace.
	dst.ExecContext(ctx, `INSERT INTO parties (kind, name, created_at, updated_at) VALUES ('issuer', 'old', '', '')`)
	if err := Restore(ctx, dst, parsed); err != nil {
		t.Fatal(err)
	}
	again, _ := Export(ctx, dst)
	a, _ := json.Marshal(f.Tables)
	b, _ := json.Marshal(again.Tables)
	if string(a) != string(b) {
		t.Fatalf("restored data differs:\n%s\n%s", a, b)
	}
	ds := &store.Store{DB: dst}
	d, err := ds.GetDocument(ctx, dst, 1)
	if err != nil || d.Totals.TotalCents != 1650 || d.PaidCents != 100 || len(d.Issuer.Logo) != 4 {
		t.Fatalf("document after restore: %+v %v", d.Totals, err)
	}
	if ps, _ := store.Parties.Select(ctx, dst, "WHERE name = 'old'"); len(ps) != 0 {
		t.Fatal("old rows survived the restore")
	}
	if p, _ := store.Parties.Get(ctx, dst, 1); len(p.Logo) != 4 || p.Logo[3] != 255 {
		t.Fatalf("logo bytes: %v", p.Logo)
	}
}

func TestRejectsBadFiles(t *testing.T) {
	ctx := context.Background()
	for name, raw := range map[string]string{
		"not json":      `hello`,
		"wrong app":     `{"app":"other","version":1}`,
		"wrong version": `{"app":"mavri","version":9}`,
		"unknown table": `{"app":"mavri","version":1,"tables":{"users":[]}}`,
	} {
		if _, err := Parse([]byte(raw)); err == nil {
			t.Errorf("%s accepted", name)
		}
	}
	d, _ := db.Open(":memory:")
	defer d.Close()
	d.ExecContext(ctx, `INSERT INTO parties (kind, name, created_at, updated_at) VALUES ('issuer', 'keep', '', '')`)
	bad, _ := Parse([]byte(`{"app":"mavri","version":1,"tables":{"parties":[{"id":1,"nope":1}]}}`))
	if err := Restore(ctx, d, bad); err == nil {
		t.Fatal("unknown column accepted")
	}
	dangling, _ := Parse([]byte(`{"app":"mavri","version":1,"tables":{"payments":[{"id":1,"document_id":5,"amount_cents":1,"paid_on":"2026-01-01"}]}}`))
	if err := Restore(ctx, d, dangling); err == nil {
		t.Fatal("dangling foreign key accepted")
	}
	// A failed restore leaves the data as it was.
	if ps, _ := store.Parties.Select(ctx, d, "WHERE name = 'keep'"); len(ps) != 1 {
		t.Fatal("failed restore changed the data")
	}
}
