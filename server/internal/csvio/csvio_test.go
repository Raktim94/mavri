package csvio

import (
	"bytes"
	"context"
	"database/sql"
	"strings"
	"testing"

	"github.com/Raktim94/mavri/server/internal/db"
	"github.com/Raktim94/mavri/server/internal/model"
	"github.com/Raktim94/mavri/server/internal/store"
)

func TestParsePrice(t *testing.T) {
	for in, want := range map[string]int64{"12.5": 1250, "1,234.50": 123450, "1.234,50": 123450, "12,50": 1250, "€ 12": 1200, "1,234": 123400, "0": 0, "$99.99": 9999} {
		got, err := ParsePrice(in)
		if err != nil || got != want {
			t.Errorf("%q: %d %v, want %d", in, got, err, want)
		}
	}
	for _, in := range []string{"", "abc", "-5", "1e999999"} {
		if _, err := ParsePrice(in); err == nil {
			t.Errorf("%q accepted", in)
		}
	}
}

func TestCustomerImportDryRunThenCommit(t *testing.T) {
	d, _ := db.Open(":memory:")
	defer d.Close()
	ctx := context.Background()
	store.Parties.Insert(ctx, d, &model.Party{Kind: "customer", Name: "Existing", Email: "e@x.co"})
	file := "\ufeffCompany,E-mail,Phone,Country\n" +
		"Acme,acme@x.co,123,us\n" +
		",nobody@x.co,1,US\n" + // no name
		"Bad Mail,not-an-email,1,US\n" +
		"Existing,e@x.co,1,US\n" + // already there
		"Acme,acme@x.co,1,US\n" + // repeated in the file
		"Zed,zed@x.co,9,GBR\n" // country must be two letters
	rep, err := Import(ctx, d, "customers", strings.NewReader(file), true)
	if err != nil {
		t.Fatal(err)
	}
	if rep.Total != 6 || rep.Valid != 1 || rep.Created != 0 || rep.Skipped != 2 || len(rep.Errors) != 5 || !rep.DryRun {
		t.Fatalf("dry run: %+v", rep)
	}
	if n := count(t, d, "customer"); n != 1 {
		t.Fatalf("a dry run wrote rows: %d customers", n)
	}
	if rep.Errors[0].Line != 3 || len(rep.Errors[0].Raw) != 4 {
		t.Fatalf("error rows must carry their line and original cells: %+v", rep.Errors[0])
	}
	rep, err = Import(ctx, d, "customers", strings.NewReader(file), false)
	if err != nil || rep.Created != 1 {
		t.Fatalf("commit: %+v %v", rep, err)
	}
	if n := count(t, d, "customer"); n != 2 {
		t.Fatalf("customers: %d", n)
	}
	ps, _ := store.Parties.Select(ctx, d, "WHERE name = 'Acme'")
	if len(ps) != 1 || ps[0].Country != "US" {
		t.Fatalf("acme: %+v", ps)
	}
}

func count(t *testing.T, d *sql.DB, kind string) int {
	t.Helper()
	var n int
	if err := d.QueryRow(`SELECT COUNT(*) FROM parties WHERE kind = ?`, kind).Scan(&n); err != nil {
		t.Fatal(err)
	}
	return n
}

func TestProductImportCreatesCategoriesAndUnits(t *testing.T) {
	d, _ := db.Open(":memory:")
	defer d.Close()
	ctx := context.Background()
	file := "name,description,price,category,unit\n" +
		"Logo design,Fixed price,\"1,200.00\",Design,project\n" +
		"Hosting,Per month,9.5,Services,month\n" +
		"Broken,,abc,,\n" +
		"Hosting,duplicate in file,1,,\n"
	rep, err := Import(ctx, d, "products", strings.NewReader(file), false)
	if err != nil {
		t.Fatal(err)
	}
	if rep.Created != 2 || len(rep.Errors) != 2 || rep.Skipped != 1 {
		t.Fatalf("report: %+v", rep)
	}
	ps, _ := store.Products.Select(ctx, d, "ORDER BY name")
	if len(ps) != 2 || ps[1].Name != "Logo design" && ps[0].Name != "Logo design" {
		t.Fatalf("products: %+v", ps)
	}
	for _, p := range ps {
		if p.Name == "Logo design" && (p.PriceCents != 120000 || p.CategoryID == nil || p.UnitID == nil) {
			t.Fatalf("logo design: %+v", p)
		}
	}
	gs, _ := store.Groups.Select(ctx, d, "")
	if len(gs) != 4 {
		t.Fatalf("groups created: %d", len(gs))
	}
}

func TestImportRejectsBadFiles(t *testing.T) {
	d, _ := db.Open(":memory:")
	defer d.Close()
	ctx := context.Background()
	for name, in := range map[string]string{
		"empty":       "",
		"no name col": "email,phone\na@b.co,1\n",
		"not utf8":    "name\n\xff\xfe\n",
	} {
		if _, err := Import(ctx, d, "customers", strings.NewReader(in), true); err == nil {
			t.Errorf("%s was accepted", name)
		}
	}
	if _, err := Import(ctx, d, "invoices", strings.NewReader("name\nx\n"), true); err != ErrUnknownKind {
		t.Fatalf("invoices cannot be imported: %v", err)
	}
	big := "name\n" + strings.Repeat("x\n", MaxRows+1)
	if _, err := Import(ctx, d, "customers", strings.NewReader(big), true); err == nil {
		t.Fatal("an oversized file was accepted")
	}
}

func TestExportNeutralisesFormulasAndCoversEveryKind(t *testing.T) {
	d, _ := db.Open(":memory:")
	defer d.Close()
	ctx := context.Background()
	st := &store.Store{DB: d}
	issuer := model.Party{Kind: "issuer", Name: "Me"}
	cust := model.Party{Kind: "customer", Name: "=cmd|' /C calc'!A0", Email: "c@x.co"}
	store.Parties.Insert(ctx, d, &issuer)
	store.Parties.Insert(ctx, d, &cust)
	store.Products.Insert(ctx, d, &model.Product{Name: "Thing", PriceCents: 1250})
	doc, err := st.CreateDocument(ctx, model.Document{Kind: "invoice", IssuerID: issuer.ID, CustomerID: cust.ID, CurrencyID: 1, IssuedOn: "2026-10-01",
		Lines:    []model.Line{{Name: "x", Quantity: 1, UnitCents: 10000}},
		Payments: []model.Payment{{AmountCents: 2500, PaidOn: "2026-10-05", Method: "bank"}}}, store.SaveOptions{})
	if err != nil {
		t.Fatal(err)
	}
	for _, kind := range Kinds {
		var buf bytes.Buffer
		if err := Export(ctx, d, st, kind, &buf); err != nil {
			t.Fatalf("%s: %v", kind, err)
		}
		out := buf.String()
		if strings.Contains(out, "\n=cmd") || strings.Contains(out, ",=cmd") {
			t.Fatalf("%s: formula not neutralised:\n%s", kind, out)
		}
		if len(strings.Split(strings.TrimSpace(out), "\n")) < 2 {
			t.Fatalf("%s has no data rows:\n%s", kind, out)
		}
	}
	var buf bytes.Buffer
	Export(ctx, d, st, "invoices", &buf)
	if !strings.Contains(buf.String(), doc.FullNumber+",invoice,") || !strings.Contains(buf.String(), "100.00,25.00,75.00") {
		t.Fatalf("invoices csv:\n%s", buf.String())
	}
	if err := Export(ctx, d, st, "nonsense", &buf); err != ErrUnknownKind {
		t.Fatalf("unknown kind: %v", err)
	}
}
