package gst

import (
	"errors"
	"math/big"
	"testing"
	"time"

	"github.com/Raktim94/nodedr-invoice/rewrite/internal/money"
)

// Rates below are TEST FIXTURES chosen to exercise the arithmetic. They are
// not statements about what rate applies to any real product or service.
func d(s string) time.Time  { t, _ := time.Parse("2006-01-02", s); return t }
func r(s string) *money.Rat { return money.MustDecimal(s) }
func i(n int64) *big.Int    { return big.NewInt(n) }

func rules() RuleBook {
	return RuleBook{Rules: []Rule{
		{ID: "t18", CodePrefix: "9983", Class: Taxable, Rate: r("18"), From: d("2020-01-01")},
		{ID: "t5", CodePrefix: "1001", Class: Taxable, Rate: r("5"), From: d("2020-01-01")},
		{ID: "ex", CodePrefix: "0101", Class: Exempt, From: d("2020-01-01")},
		{ID: "cess", CodePrefix: "2402", Class: Taxable, Rate: r("28"), CessRate: r("12"), From: d("2020-01-01")},
		{ID: "old12", CodePrefix: "8888", Class: Taxable, Rate: r("12"), From: d("2020-01-01"), To: d("2026-10-01")},
		{ID: "new18", CodePrefix: "8888", Class: Taxable, Rate: r("18"), From: d("2026-10-01")},
		{ID: "broad", CodePrefix: "99", Class: Taxable, Rate: r("1"), From: d("2020-01-01")},
	}}
}

func base(line LineInput) Input {
	return Input{Date: d("2026-10-11"), SupplierState: "19", SupplierKind: RegularSupplier, PlaceOfSupply: "19",
		SupplyKind: DomesticSupply, Rules: rules(), Lines: []LineInput{line}}
}

func eq(t *testing.T, name string, got, want *big.Int) {
	t.Helper()
	if got.Cmp(want) != 0 {
		t.Errorf("%s: got %s want %s", name, got, want)
	}
}

func TestIntraStateSplitsEvenly(t *testing.T) {
	res, err := Calculate(base(LineInput{Code: "998313", Gross: r("10000")}))
	if err != nil {
		t.Fatal(err)
	}
	eq(t, "CGST", res.CGST, i(900))
	eq(t, "SGST", res.SGST, i(900))
	eq(t, "IGST", res.IGST, i(0))
	eq(t, "total", res.InvoiceTotal, i(11800))
	if !res.IntraState || res.StateTaxName != "SGST" || res.DocType != TaxInvoice || res.Notes[0].Key != "gst.intraState" {
		t.Fatalf("unexpected result %+v", res)
	}
}

func TestInterStateUsesIGST(t *testing.T) {
	in := base(LineInput{Code: "998313", Gross: r("10000")})
	in.PlaceOfSupply = "27"
	res, _ := Calculate(in)
	eq(t, "IGST", res.IGST, i(1800))
	eq(t, "CGST", res.CGST, i(0))
	if res.IntraState || res.Notes[0].Key != "gst.interState" {
		t.Fatal("should be inter-state")
	}
}

func TestRoundingDifferenceIsVisibleNotHidden(t *testing.T) {
	// 1010 paise at 5%: intra = 25.25 -> 25 each (50); inter = 50.5 -> 51.
	intra, _ := Calculate(base(LineInput{Code: "1001", Gross: r("1010")}))
	eq(t, "intra tax", intra.TaxTotal, i(50))
	in := base(LineInput{Code: "1001", Gross: r("1010")})
	in.PlaceOfSupply = "27"
	inter, _ := Calculate(in)
	eq(t, "inter tax", inter.TaxTotal, i(51))
}

func TestDiscountReducesTaxableValue(t *testing.T) {
	res, _ := Calculate(base(LineInput{Code: "998313", Gross: r("10000"), Discount: r("1000")}))
	eq(t, "taxable", res.TaxableTotal, i(9000))
	eq(t, "tax", res.TaxTotal, i(1620))
}

func TestExemptCollectsNoTaxAndSuggestsReview(t *testing.T) {
	res, _ := Calculate(base(LineInput{Code: "010121", Gross: r("5000")}))
	eq(t, "tax", res.TaxTotal, i(0))
	eq(t, "total", res.InvoiceTotal, i(5000))
	if !res.NeedsReview || res.DocType != TaxInvoice {
		t.Fatal("all-exempt tax invoice must be flagged for review, not silently converted")
	}
}

func TestCessIsSeparate(t *testing.T) {
	in := base(LineInput{Code: "2402", Gross: r("10000")})
	in.PlaceOfSupply = "27"
	res, _ := Calculate(in)
	eq(t, "IGST", res.IGST, i(2800))
	eq(t, "cess", res.Cess, i(1200))
	eq(t, "total", res.InvoiceTotal, i(14000))
}

func TestCompositionAndUnregisteredCollectNoTax(t *testing.T) {
	for _, kind := range []SupplierKind{CompositionSupplier, Unregistered} {
		in := base(LineInput{Code: "998313", Gross: r("10000")})
		in.SupplierKind = kind
		in.Rules = RuleBook{} // rules are not even consulted
		res, err := Calculate(in)
		if err != nil {
			t.Fatal(err)
		}
		eq(t, "tax", res.TaxTotal, i(0))
		eq(t, "total", res.InvoiceTotal, i(10000))
		if res.DocType != BillOfSupply || res.Notes[0].Key != "gst.noTaxCollected."+string(kind) {
			t.Fatalf("%s: %+v", kind, res)
		}
	}
}

func TestReverseChargeShowsTaxButDoesNotCollectIt(t *testing.T) {
	in := base(LineInput{Code: "998313", Gross: r("10000")})
	in.ReverseCharge = true
	res, _ := Calculate(in)
	eq(t, "tax shown", res.TaxTotal, i(1800))
	eq(t, "collected", res.TaxCollected, i(0))
	eq(t, "payable by recipient", res.PayableByRecipient, i(1800))
	eq(t, "invoice total", res.InvoiceTotal, i(10000))
}

func TestUnionTerritoryWithoutLegislatureUsesUTGST(t *testing.T) {
	in := base(LineInput{Code: "998313", Gross: r("10000")})
	in.SupplierState, in.PlaceOfSupply = "04", "04"
	res, _ := Calculate(in)
	if res.StateTaxName != "UTGST" {
		t.Fatalf("got %s", res.StateTaxName)
	}
	in.SupplierState, in.PlaceOfSupply = "07", "07" // Delhi levies SGST
	if res, _ = Calculate(in); res.StateTaxName != "SGST" {
		t.Fatalf("Delhi got %s", res.StateTaxName)
	}
}

func TestExportAndSEZAreIGSTEvenInSameState(t *testing.T) {
	for _, k := range []SupplyKind{ExportSupply, SEZSupply} {
		in := base(LineInput{Code: "998313", Gross: r("10000")})
		in.SupplyKind = k
		res, _ := Calculate(in)
		eq(t, "IGST", res.IGST, i(1800))
		if res.IntraState || res.Notes[0].Key != "gst.interState.selectedSupplyKind" {
			t.Fatalf("%s: %+v", k, res.Notes)
		}
	}
}

func TestEffectiveDatingAndSpecificity(t *testing.T) {
	before := base(LineInput{Code: "888801", Gross: r("10000")})
	before.Date = d("2026-09-30")
	after := before
	after.Date = d("2026-10-01")
	a, _ := Calculate(before)
	b, _ := Calculate(after)
	eq(t, "tax before change", a.TaxTotal, i(1200))
	eq(t, "tax on change date", b.TaxTotal, i(1800))
	// "9983" must beat the broader "99" prefix.
	got, _ := rules().Resolve("998313", d("2026-10-11"))
	if got.ID != "t18" {
		t.Fatalf("longest prefix should win, got %s", got.ID)
	}
}

func TestMissingAndAmbiguousRulesAreErrorsNotDefaults(t *testing.T) {
	if _, err := Calculate(base(LineInput{Code: "5555", Gross: r("100")})); !errors.Is(err, ErrNoRule) {
		t.Fatalf("got %v", err)
	}
	book := RuleBook{Rules: []Rule{
		{ID: "a", CodePrefix: "12", Class: Taxable, Rate: r("5")}, {ID: "b", CodePrefix: "12", Class: Taxable, Rate: r("6")}}}
	if _, err := book.Resolve("1234", d("2026-10-11")); !errors.Is(err, ErrAmbiguousRule) {
		t.Fatalf("got %v", err)
	}
	if _, err := rules().Resolve("888801", d("2019-01-01")); !errors.Is(err, ErrNoRule) {
		t.Fatal("rule before its effective date must not apply")
	}
}

func TestInputValidation(t *testing.T) {
	in := base(LineInput{Code: "998313", Gross: r("100")})
	in.PlaceOfSupply = "99"
	if _, err := Calculate(in); !errors.Is(err, ErrUnknownState) {
		t.Fatalf("got %v", err)
	}
	in.PlaceOfSupply = "25" // legacy code is not accepted for new documents
	if _, err := Calculate(in); !errors.Is(err, ErrUnknownState) {
		t.Fatalf("legacy: %v", err)
	}
	in = base(LineInput{Code: "998313", Gross: r("100"), Discount: r("200")})
	if _, err := Calculate(in); !errors.Is(err, ErrNegativeValue) {
		t.Fatalf("got %v", err)
	}
	if _, err := Calculate(Input{SupplierState: "19", PlaceOfSupply: "19"}); !errors.Is(err, ErrNoLines) {
		t.Fatalf("got %v", err)
	}
}

func TestMultiLineTotalsAddUp(t *testing.T) {
	in := base(LineInput{})
	in.Lines = []LineInput{{Code: "998313", Gross: r("10000")}, {Code: "1001", Gross: r("2000")}, {Code: "010121", Gross: r("500")}}
	res, _ := Calculate(in)
	eq(t, "taxable", res.TaxableTotal, i(12500))
	eq(t, "tax", res.TaxTotal, i(1800+100))
	eq(t, "total", res.InvoiceTotal, i(12500+1900))
	sum := new(big.Int)
	for _, l := range res.Lines {
		sum.Add(sum, l.CGST).Add(sum, l.SGST).Add(sum, l.IGST).Add(sum, l.Cess)
	}
	eq(t, "line sum equals total", sum, res.TaxTotal)
}

func TestGSTIN(t *testing.T) {
	ok := ParseGSTIN(" 27aapfu0939f1zv ")
	if !ok.FormatOK || !ok.StateKnown || !ok.ChecksumOK || ok.StateCode != "27" || ok.PAN != "AAPFU0939F" {
		t.Fatalf("%+v", ok)
	}
	bad := ParseGSTIN("27AAPFU0939F1ZX")
	if !bad.FormatOK || bad.ChecksumOK {
		t.Fatalf("checksum mismatch should be reported separately: %+v", bad)
	}
	for _, s := range []string{"", "27AAPFU0939F1Z", "27AAPFU0939F1ZVV", "27AAPFU09O9F1ZV", "27AAPFU0939F1AV"} {
		if g := ParseGSTIN(s); g.FormatOK {
			t.Errorf("%q should fail format", s)
		}
	}
	if g := ParseGSTIN("99AAPFU0939F1Z1"); g.StateKnown {
		t.Error("state 99 is not accepted")
	}
}

func TestFinancialYearAndInvoiceNumber(t *testing.T) {
	cases := map[string]string{"2026-03-31": "2025-26", "2026-04-01": "2026-27", "2027-01-15": "2026-27", "2099-06-01": "2099-00"}
	for in, want := range cases {
		if got := FinancialYear(d(in)); got != want {
			t.Errorf("%s: got %s want %s", in, got, want)
		}
	}
	for s, want := range map[string]bool{"INV/2026-27/0001": true, "A-1": true, "1234567890123456": true, "12345678901234567": false,
		"": false, "INV 1": false, "INV#1": false, "इन्व1": false} {
		if got := ValidInvoiceNumber(s); got != want {
			t.Errorf("%q: got %v want %v", s, got, want)
		}
	}
}

func TestRule46Completeness(t *testing.T) {
	doc := Rule46Doc{
		SupplierName: "Acme", SupplierAddress: "1 Road", SupplierGSTIN: "27AAPFU0939F1ZV", InvoiceNumber: "INV/1",
		IssueDate: d("2026-10-11"), RecipientName: "Buyer", RecipientAddress: "2 Street", RecipientRegistered: true,
		RecipientGSTIN: "27AAPFU0939F1ZV", PlaceOfSupplyState: "27", ReverseChargeAnswered: true,
		Lines: []Rule46Line{{Description: "Service", Unit: "NOS", HSNOrSAC: "998313", Quantity: "1", TaxableValue: "100.00"}},
	}
	if p := CheckRule46(doc); len(p) != 0 {
		t.Fatalf("complete document flagged: %+v", p)
	}
	doc.SupplierGSTIN, doc.InvoiceNumber, doc.RecipientGSTIN, doc.ReverseChargeAnswered = "bad", "has space", "", false
	doc.Lines[0].HSNOrSAC = ""
	got := map[string]bool{}
	for _, p := range CheckRule46(doc) {
		got[p.Key] = true
	}
	for _, k := range []string{"gst.rule46.supplierGSTIN", "gst.rule46.invoiceNumber", "gst.rule46.recipientGSTIN", "gst.rule46.reverseCharge", "gst.rule46.lineHSN"} {
		if !got[k] {
			t.Errorf("missing problem %s", k)
		}
	}
}

func TestPlaceOfSupplyReview(t *testing.T) {
	if n := ReviewPlaceOfSupply(POSInput{}); len(n) != 1 || n[0].Key != "gst.review.placeOfSupplyMissing" {
		t.Fatalf("%+v", n)
	}
	n := ReviewPlaceOfSupply(POSInput{SupplyType: Goods, SupplierState: "19", PlaceOfSupply: "19", RecipientGSTIN: "27AAPFU0939F1ZV", DeliveryState: "29"})
	keys := map[string]bool{}
	for _, x := range n {
		keys[x.Key] = true
	}
	if !keys["gst.review.recipientStateDiffers"] || !keys["gst.review.deliveryStateDiffers"] || keys["gst.review.supplyTypeUnknown"] {
		t.Fatalf("%+v", n)
	}
	if n = ReviewPlaceOfSupply(POSInput{SupplyType: Services, PlaceOfSupply: "19"}); len(n) != 0 {
		t.Fatalf("clean input flagged: %+v", n)
	}
}

func TestStateTable(t *testing.T) {
	if st, ok := LookupState("26"); !ok || st.Status != StateCurrent {
		t.Fatal("26 must be current")
	}
	for _, c := range []string{"25", "28"} {
		if st, ok := LookupState(c); !ok || st.Status != StateLegacy {
			t.Fatalf("%s must be legacy", c)
		}
	}
	for _, s := range States() {
		if s.Status != StateCurrent {
			t.Fatal("States() must exclude legacy codes")
		}
	}
	if _, ok := LookupState("96"); ok {
		t.Fatal("96 is deliberately unlisted until verified")
	}
}
