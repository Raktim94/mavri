package reconcile

import (
	"context"
	"strings"
	"testing"
	"time"

	"github.com/Raktim94/mavri/server/internal/db"
	"github.com/Raktim94/mavri/server/internal/model"
	"github.com/Raktim94/mavri/server/internal/store"
)

func setup(t *testing.T) (*store.Store, context.Context, []model.Document) {
	t.Helper()
	d, err := db.Open(":memory:")
	if err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() { d.Close() })
	ctx := context.Background()
	st := &store.Store{DB: d, Now: func() time.Time { return time.Date(2026, 10, 12, 9, 0, 0, 0, time.UTC) }}
	issuer := model.Party{Kind: "issuer", Name: "Me"}
	store.Parties.Insert(ctx, d, &issuer)
	var docs []model.Document
	for _, c := range []struct {
		name, num string
		cents     int64
	}{{"Acme Traders", "INV-101", 123456}, {"Brightwave Studio", "INV-102", 50000}, {"Brightwave Studio", "INV-103", 50000}, {"Harbor Cafe", "INV-104", 7500}} {
		cu := model.Party{Kind: "customer", Name: c.name}
		store.Parties.Insert(ctx, d, &cu)
		doc, err := st.CreateDocument(ctx, model.Document{Kind: "invoice", IssuerID: issuer.ID, CustomerID: cu.ID, CurrencyID: 1, IssuedOn: "2026-10-01", Number: c.num,
			Lines: []model.Line{{Name: "Work", Quantity: 1, UnitCents: c.cents}}}, store.SaveOptions{})
		if err != nil {
			t.Fatal(err)
		}
		docs = append(docs, doc)
	}
	return st, ctx, docs
}

const stmt = `Account statement
Generated 12 Oct 2026
Date,Narration,Debit,Credit
05/10/2026,NEFT payment INV-101 Acme,,"1,234.56"
06/10/2026,UPI from Brightwave Studio,,500.00
07/10/2026,Cheque deposit,,999.00
08/10/2026,Rent,2000.00,
09/10/2026,Payment for INV-104 thanks,,100.00
10/10/2026,Transfer INV-102 and INV-103,,1000.00
`

func TestStatementLinesAreMatchedAndTheRestIsFlagged(t *testing.T) {
	st, ctx, docs := setup(t)
	rep, err := Check(ctx, st, strings.NewReader(stmt))
	if err != nil {
		t.Fatal(err)
	}
	if len(rep.Rows) != 6 {
		t.Fatalf("rows: %+v", rep.Rows)
	}
	by := map[int]Row{}
	for _, r := range rep.Rows {
		by[r.Line] = r
	}
	if r := by[4]; r.Status != Matched || r.InvoiceID != docs[0].ID || r.AmountCents != 123456 || r.Date != "2026-10-05" {
		t.Errorf("a reference with the invoice number and the exact amount: %+v", r)
	}
	if r := by[5]; r.Status != Ambiguous || len(r.Candidates) != 2 {
		t.Errorf("two invoices of the same size for one customer cannot be told apart: %+v", r)
	}
	if r := by[6]; r.Status != Unmatched {
		t.Errorf("nothing fits: %+v", r)
	}
	if r := by[7]; r.Status != NotReceived {
		t.Errorf("money out is ignored: %+v", r)
	}
	if r := by[8]; r.Status != Overpaid || r.InvoiceID != docs[3].ID {
		t.Errorf("more than is owed is not matched silently: %+v", r)
	}
	if r := by[9]; r.Status != Ambiguous {
		t.Errorf("two invoice numbers in one reference: %+v", r)
	}
	if rep.Matched != 1 || rep.Needs != 4 {
		t.Errorf("counts: %+v", rep)
	}
}

func TestApplyingRecordsOnceAndChecksAgain(t *testing.T) {
	st, ctx, docs := setup(t)
	rep, _ := Check(ctx, st, strings.NewReader(stmt))
	var m Row
	for _, r := range rep.Rows {
		if r.Status == Matched {
			m = r
		}
	}
	a := Apply{Key: m.Key, InvoiceID: m.InvoiceID, Date: m.Date, AmountCents: m.AmountCents, Note: m.Description}
	res := ApplyAll(ctx, st, []Apply{a})
	if !res[0].OK {
		t.Fatalf("apply: %+v", res)
	}
	d, _ := st.GetDocument(ctx, st.DB, docs[0].ID)
	if d.Status != "paid" || len(d.Payments) != 1 || d.Payments[0].Method != "bank (statement)" || d.Payments[0].PaidOn != "2026-10-05" {
		t.Fatalf("the payment: %+v", d)
	}
	// The same statement again recognises the line, and applying it again is refused.
	rep2, _ := Check(ctx, st, strings.NewReader(stmt))
	var dup int
	for _, r := range rep2.Rows {
		if r.Status == Duplicate {
			dup++
		}
	}
	if dup != 1 || rep2.Duplicate != 1 {
		t.Fatalf("duplicates: %+v", rep2)
	}
	if res := ApplyAll(ctx, st, []Apply{a}); res[0].OK || res[0].Message != "already recorded" {
		t.Fatalf("a second apply: %+v", res)
	}
	// More than is owed is refused.
	over := Apply{Key: "x1", InvoiceID: docs[3].ID, Date: "2026-10-09", AmountCents: 10000}
	if res := ApplyAll(ctx, st, []Apply{over}); res[0].OK {
		t.Fatalf("overpayment applied: %+v", res)
	}
}

func TestMatchingByAmountNeedsTheCustomersName(t *testing.T) {
	st, ctx, docs := setup(t)
	rep, _ := Check(ctx, st, strings.NewReader("Date,Description,Amount\n2026-10-06,Harbor Cafe lunch order,75.00\n2026-10-06,Someone else,75.00\n"))
	if r := rep.Rows[0]; r.Status != Matched || r.InvoiceID != docs[3].ID {
		t.Errorf("amount and name: %+v", r)
	}
	if r := rep.Rows[1]; r.Status != Unmatched {
		t.Errorf("an amount alone is not enough: %+v", r)
	}
}

func TestAnUnreadableFileSaysWhy(t *testing.T) {
	st, ctx, _ := setup(t)
	if _, err := Check(ctx, st, strings.NewReader("hello,world\n1,2\n")); err == nil || !strings.Contains(err.Error(), "header row") {
		t.Fatalf("%v", err)
	}
}

func TestAmounts(t *testing.T) {
	for in, want := range map[string]int64{"1,234.56": 123456, "1.234,56": 123456, "₹ 1,000": 100000, "(500.00)": -50000, "-12.5": -1250, "12,50": 1250} {
		if got, ok := parseAmount(in); !ok || got != want {
			t.Errorf("%q: %d %v, want %d", in, got, ok, want)
		}
	}
	if _, ok := parseAmount("n/a"); ok {
		t.Error("n/a")
	}
}
