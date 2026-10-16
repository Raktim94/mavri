package irp

import (
	"encoding/json"
	"strings"
	"testing"

	"github.com/Raktim94/mavri/server/internal/model"
	"github.com/Raktim94/mavri/server/internal/money"
)

const alnum = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ"

// gstin completes a 14-character GSTIN body with its check character.
func gstin(body string) string {
	total, factor := 0, 2
	for i := len(body) - 1; i >= 0; i-- {
		d := factor * strings.IndexByte(alnum, body[i])
		if factor == 2 {
			factor = 1
		} else {
			factor = 2
		}
		total += d/36 + d%36
	}
	return body + string(alnum[(36-total%36)%36])
}

func doc(buyerState string) model.Document {
	d := model.Document{Kind: "invoice", FullNumber: "INV-42", IssuedOn: "2026-10-16", Status: "unpaid",
		Currency: model.Currency{Code: "INR", Decimals: 2},
		Issuer:   model.Party{Name: "Northwind Studio", TaxID: "27AAPFU0939F1ZV", Address: "12 Harbour Road\nPune 411001", Email: "hi@nw.example", Phone: "+91 20 5550 0101"},
		Customer: model.Party{Name: "Acme Traders Ltd", TaxID: gstin(buyerState + "AAGFF2194N1Z"), Address: "48 Market Street\nMumbai, 400001"},
		Lines: []model.Line{
			{Name: "Brand workshop", Quantity: 2, UnitCents: 80000, TaxRate: 18, TaxMode: "add", TaxCode: "998399", Unit: "day", LineType: "service"},
			{Name: "Hosting", Quantity: 1, UnitCents: 24000, TaxRate: 5, TaxMode: "add", TaxCode: "998315", Unit: "year"},
		}}
	d.Totals = money.Compute(&d)
	return d
}

func parse(t *testing.T, b []byte) invoice {
	t.Helper()
	var out []invoice
	if err := json.Unmarshal(b, &out); err != nil || len(out) != 1 {
		t.Fatalf("not one invoice: %v\n%s", err, b)
	}
	return out[0]
}

func TestSameStateSplitsIntoCGSTAndSGST(t *testing.T) {
	d := doc("27")
	b, err := Generate(d)
	if err != nil {
		t.Fatal(err)
	}
	inv := parse(t, b)
	if inv.Version != "1.1" || inv.TranDtls.SupTyp != "B2B" || inv.DocDtls.Typ != "INV" || inv.DocDtls.No != "INV-42" || inv.DocDtls.Dt != "16/10/2026" {
		t.Fatalf("header: %+v", inv)
	}
	if inv.SellerDtls.Pin != 411001 || inv.SellerDtls.Loc != "Pune" || inv.SellerDtls.Stcd != "27" || inv.BuyerDtls.Pin != 400001 || inv.BuyerDtls.Loc != "Mumbai" {
		t.Fatalf("parties: %+v %+v", inv.SellerDtls, inv.BuyerDtls)
	}
	it := inv.ItemList[0]
	// 2 x 800 = 1600, 18% = 288: CGST 144 and SGST 144, no IGST.
	if it.AssAmt != 1600 || it.CgstAmt != 144 || it.SgstAmt != 144 || it.IgstAmt != 0 || it.GstRt != 18 || it.IsServc != "Y" || it.Unit != "OTH" || it.TotItemVal != 1888 {
		t.Fatalf("item 1: %+v", it)
	}
	if v := inv.ValDtls; v.AssVal != 1840 || v.CgstVal != 150 || v.SgstVal != 150 || v.IgstVal != 0 || v.TotInvVal != 2140 || v.RndOffAmt != 0 {
		t.Fatalf("values: %+v", v)
	}
}

func TestOtherStateIsIGST(t *testing.T) {
	b, err := Generate(doc("07"))
	if err != nil {
		t.Fatal(err)
	}
	v := parse(t, b).ValDtls
	if v.IgstVal != 300 || v.CgstVal != 0 || v.SgstVal != 0 {
		t.Fatalf("values: %+v", v)
	}
}

func TestADocumentDiscountIsRefusedRatherThanSentWrong(t *testing.T) {
	d := doc("27")
	d.Discount = model.Adjustment{Mode: "percent", Percent: 10}
	d.Totals = money.Compute(&d)
	if _, err := Generate(d); err == nil || !strings.Contains(err.Error(), "discount") {
		t.Fatalf("a document discount: %v", err)
	}
}

func TestCreditNoteNamesTheInvoiceItCorrects(t *testing.T) {
	d := doc("27")
	d.DocType, d.CorrectsNumber = "credit", "INV-7"
	b, err := Generate(d)
	if err != nil {
		t.Fatal(err)
	}
	inv := parse(t, b)
	if inv.DocDtls.Typ != "CRN" || len(inv.PrecDocDtls) != 1 || inv.PrecDocDtls[0].InvNo != "INV-7" {
		t.Fatalf("%+v", inv)
	}
}

func TestEverythingMissingIsListedAtOnce(t *testing.T) {
	d := doc("27")
	d.Issuer.TaxID = ""
	d.Customer.Address = "somewhere"
	d.Lines[0].TaxCode = ""
	d.Currency.Code = "USD"
	d.Status = "draft"
	_, err := Generate(d)
	p, ok := err.(Problems)
	if !ok {
		t.Fatalf("want problems, got %v", err)
	}
	all := strings.Join(p, "\n")
	for _, want := range []string{"issue the invoice first", "rupee", "your GSTIN", "PIN code", "HSN or SAC"} {
		if !strings.Contains(all, want) {
			t.Errorf("missing %q in\n%s", want, all)
		}
	}
	d = doc("27")
	d.Customer.TaxID = ""
	if _, err := Generate(d); err == nil || !strings.Contains(err.Error(), "business-to-business") {
		t.Fatalf("a customer without GSTIN: %v", err)
	}
	q := doc("27")
	q.Kind = "quote"
	if _, err := Generate(q); err == nil {
		t.Fatal("a quote")
	}
}
