package csvio

import (
	"context"
	"strings"
	"testing"

	"github.com/Raktim94/mavri/server/internal/db"
	"github.com/Raktim94/mavri/server/internal/model"
	"github.com/Raktim94/mavri/server/internal/store"
)

func invoiceEnv(t *testing.T) (*store.Store, context.Context) {
	t.Helper()
	d, err := db.Open(":memory:")
	if err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() { d.Close() })
	ctx := context.Background()
	st := &store.Store{DB: d}
	store.Parties.Insert(ctx, d, &model.Party{Kind: "issuer", Name: "Me"})
	store.Parties.Insert(ctx, d, &model.Party{Kind: "customer", Name: "Acme", Email: "a@acme.co"})
	store.Parties.Insert(ctx, d, &model.Party{Kind: "customer", Name: "Twin", Email: "one@twin.co"})
	store.Parties.Insert(ctx, d, &model.Party{Kind: "customer", Name: "Twin", Email: "two@twin.co"})
	return st, ctx
}

const invoiceHeader = "Invoice number,Customer,Customer email,Date,Due date,Currency,Description,Qty,Unit price,Tax %,Total,Paid\n"

func TestInvoiceImportDryRunThenCommit(t *testing.T) {
	st, ctx := invoiceEnv(t)
	file := invoiceHeader +
		"INV-1,Acme,,2026-09-01,2026-09-30,USD,Design,2,100,10,,\n" + // two lines, one invoice
		"INV-1,Acme,,2026-09-01,2026-09-30,USD,Hosting,1,50,0,,\n" +
		"INV-2,Acme,,01/10/2026,,USD,Retainer,1,\"1,000.00\",,1000,1000\n" + // day-first date, a total that checks out, fully paid
		"INV-3,Nobody,,2026-10-02,,USD,X,1,5,0,,\n" + // unknown customer
		"INV-4,Twin,,2026-10-02,,USD,X,1,5,0,,\n" + // ambiguous customer
		"INV-5,Twin,two@twin.co,2026-10-02,,USD,X,1,5,0,,\n" + // the email resolves it
		"INV-6,Acme,,2026-10-02,,ZZZ,X,1,5,0,,\n" + // unknown currency
		"INV-7,Acme,,2026-10-02,,USD,X,1,5,0,999,\n" // the file's total does not match
	rep, err := ImportInvoices(ctx, st, strings.NewReader(file), true)
	if err != nil {
		t.Fatal(err)
	}
	if !rep.DryRun || rep.Created != 0 || rep.Valid != 3 || rep.Total != 8 {
		t.Fatalf("dry run: %+v", rep)
	}
	if len(rep.Errors) != 4 {
		t.Fatalf("four invoices have problems: %+v", rep.Errors)
	}
	joined := ""
	for _, e := range rep.Errors {
		joined += e.Message + "\n"
	}
	for _, want := range []string{"not in Mavri yet", "matches 2 records", "not one of your currencies", "lines add up to"} {
		if !strings.Contains(joined, want) {
			t.Errorf("missing explanation %q in:\n%s", want, joined)
		}
	}
	if n, _ := countDocs(st); n != 0 {
		t.Fatalf("a dry run wrote %d documents", n)
	}

	rep, err = ImportInvoices(ctx, st, strings.NewReader(file), false)
	if err != nil || rep.Created != 3 {
		t.Fatalf("import: %+v %v", rep, err)
	}
	docs, _, _ := st.ListDocuments(ctx, store.Filter{Kind: "invoice"})
	byNumber := map[string]model.Summary{}
	for _, d := range docs {
		byNumber[d.FullNumber] = d
	}
	if d := byNumber["INV-1"]; d.TotalCents != 27000 { // 2 x 100 plus 10% tax, plus 50
		t.Fatalf("INV-1 total: %d", d.TotalCents)
	}
	if d := byNumber["INV-2"]; d.Status != "paid" || d.TotalCents != 100000 || d.IssuedOn != "2026-10-01" {
		t.Fatalf("INV-2: %+v", d)
	}

	// importing the same file again creates nothing and says why
	rep, err = ImportInvoices(ctx, st, strings.NewReader(file), false)
	if err != nil || rep.Created != 0 || rep.Skipped != 3 {
		t.Fatalf("re-import: %+v %v", rep, err)
	}
}

func TestInvoiceImportNeedsTheRightColumns(t *testing.T) {
	st, ctx := invoiceEnv(t)
	_, err := ImportInvoices(ctx, st, strings.NewReader("Customer,Date\nAcme,2026-01-01\n"), true)
	if err == nil || !strings.Contains(err.Error(), "number") {
		t.Fatalf("want a message naming the missing column, got %v", err)
	}
}

func TestInvoiceImportNeedsABusinessWhenThereAreSeveral(t *testing.T) {
	st, ctx := invoiceEnv(t)
	store.Parties.Insert(ctx, st.DB, &model.Party{Kind: "issuer", Name: "Second"})
	rep, err := ImportInvoices(ctx, st, strings.NewReader(invoiceHeader+"INV-9,Acme,,2026-09-01,,USD,X,1,5,0,,\n"), true)
	if err != nil || rep.Valid != 0 || len(rep.Errors) != 1 || !strings.Contains(rep.Errors[0].Message, "issuer column") {
		t.Fatalf("%+v %v", rep, err)
	}
}

func countDocs(st *store.Store) (int, error) {
	var n int
	err := st.DB.QueryRow(`SELECT COUNT(*) FROM documents`).Scan(&n)
	return n, err
}
