package taxpack

import (
	"strings"
	"testing"
)

func TestGSTINChecksum(t *testing.T) {
	for _, g := range []string{"27AAPFU0939F1ZV", "07AAGFF2194N1Z1", "33GSPTN0481G1ZA", "27 aapfu 0939 f1zv"} {
		if r := CheckID("IN", g); !r.Valid {
			t.Errorf("%s should be valid: %s", g, r.Message)
		}
	}
	if r := CheckID("IN", "27AAPFU0939F1ZV"); r.State != "Maharashtra" || r.Level != "checksum" {
		t.Errorf("state or level: %+v", r)
	}
	for _, g := range []string{"27AAPFU0939F1ZX", "99AAPFU0939F1ZV", "27AAPFU0939F1AV", "123", "25AAPFU0939F1ZV"} {
		if CheckID("IN", g).Valid {
			t.Errorf("%s should be invalid", g)
		}
	}
}

func TestUKVAT(t *testing.T) {
	if r := CheckID("GB", "GB980780684"); !r.Valid {
		t.Fatalf("known test number rejected: %s", r.Message)
	}
	if r := CheckID("GB", "980 7806 84"); !r.Valid {
		t.Fatalf("spaces and no prefix: %s", r.Message)
	}
	if CheckID("GB", "GB980780685").Valid {
		t.Fatal("wrong check digits accepted")
	}
	if CheckID("GB", "12345").Valid {
		t.Fatal("short number accepted")
	}
}

func TestOtherIDs(t *testing.T) {
	cases := []struct {
		country, id string
		ok          bool
	}{
		{"AE", "100123456700003", true}, {"AE", "1001234567", false},
		{"US", "12-3456789", true}, {"US", "12-345678", false},
		{"DE", "DE123456789", true}, {"DE", "DE12345", false},
		{"NL", "NL123456789B01", true}, {"NL", "NL123456789X01", false},
		{"FR", "FRAB123456789", true}, {"GR", "EL123456789", true}, {"GR", "GR123456789", true},
		{"IE", "IE1234567FA", true}, {"ES", "ESX1234567Z", true}, {"SE", "SE123456789001", true},
	}
	for _, c := range cases {
		if got := CheckID(c.country, c.id).Valid; got != c.ok {
			t.Errorf("%s %s: valid=%v want %v", c.country, c.id, got, c.ok)
		}
	}
	if r := CheckID("JP", "123"); r.Valid || r.Level != "none" {
		t.Errorf("a country without a check says so: %+v", r)
	}
	if r := CheckID("IN", ""); r.Valid || r.Message == "" {
		t.Errorf("empty: %+v", r)
	}
}

func TestRatesAreEffectiveDated(t *testing.T) {
	has := func(rs []Rate, code string) bool {
		for _, r := range rs {
			if r.Code == code {
				return true
			}
		}
		return false
	}
	if !has(indiaGST.RatesOn("2025-06-01"), "gst-28") || !has(indiaGST.RatesOn("2025-06-01"), "gst-12") || has(indiaGST.RatesOn("2025-06-01"), "gst-40") {
		t.Error("before 22 September 2025 the old slabs applied")
	}
	after := indiaGST.RatesOn("2025-10-01")
	if has(after, "gst-28") || has(after, "gst-12") || !has(after, "gst-40") || !has(after, "gst-18") {
		t.Errorf("after the change: %+v", after)
	}
	if has(indiaGST.RatesOn(""), "gst-28") {
		t.Error("no date means rates in force now")
	}
	if len(euVAT.Rates) != 27 {
		t.Errorf("one standard rate per member state, have %d", len(euVAT.Rates))
	}
	for _, p := range Packs() {
		if p.Source == "" || p.Version == "" || p.Owner == "" {
			t.Errorf("%s: every pack needs a source, a version and an owner", p.ID)
		}
		if p.ReviewedOn != "" {
			t.Errorf("%s: a pack is only marked reviewed after a person has checked it", p.ID)
		}
	}
}

func TestIndiaSameStateAndInterState(t *testing.T) {
	same := Explain(Facts{IssuerCountry: "IN", IssuerTaxID: "27AAPFU0939F1ZV", CustomerCountry: "IN", CustomerTaxID: "27AAGFF2194N1Z1", Date: "2026-10-16"})
	_ = same
	// build a valid Maharashtra customer GSTIN from the checksum so the test does not depend on a memorised number
	body := "27AAGFF2194N1Z"
	cust := body + string(gstinCheckChar(body))
	r := Explain(Facts{IssuerCountry: "IN", IssuerTaxID: "27AAPFU0939F1ZV", CustomerCountry: "IN", CustomerTaxID: cust, Date: "2026-10-16"})
	if r.Treatment != IntraState || r.Confidence != Clear || len(r.Split) != 2 || r.Split[0].Name != "CGST" {
		t.Fatalf("same state: %+v", r)
	}
	body = "07AAGFF2194N1Z"
	cust = body + string(gstinCheckChar(body))
	r = Explain(Facts{IssuerCountry: "IN", IssuerTaxID: "27AAPFU0939F1ZV", CustomerCountry: "IN", CustomerTaxID: cust})
	if r.Treatment != InterState || len(r.Split) != 1 || r.Split[0].Name != "IGST" {
		t.Fatalf("other state: %+v", r)
	}
	if !strings.Contains(strings.Join(r.Trace, " "), "Delhi") {
		t.Errorf("the trace names the customer's state: %v", r.Trace)
	}
}

func TestIndiaUnknownPlaceOfSupplyAsksInsteadOfGuessing(t *testing.T) {
	r := Explain(Facts{IssuerCountry: "IN", IssuerTaxID: "27AAPFU0939F1ZV", CustomerCountry: "IN"})
	if r.Confidence != NeedsDecision || len(r.Missing) == 0 || len(r.Split) != 0 {
		t.Fatalf("a B2C sale needs the customer's state: %+v", r)
	}
	r = Explain(Facts{IssuerCountry: "IN", CustomerCountry: "IN"})
	if r.Confidence != NeedsDecision || len(r.Missing) < 1 {
		t.Fatalf("missing issuer GSTIN: %+v", r)
	}
	r = Explain(Facts{IssuerCountry: "IN", IssuerTaxID: "27AAPFU0939F1ZV", CustomerCountry: "DE"})
	if r.Treatment != Export || r.Confidence != NeedsDecision {
		t.Fatalf("export: %+v", r)
	}
}

func TestEUCases(t *testing.T) {
	d := Explain(Facts{IssuerCountry: "DE", IssuerTaxID: "DE123456789", CustomerCountry: "DE", Date: "2026-10-16"})
	if d.Treatment != Domestic || !strings.Contains(d.Title, "19%") {
		t.Fatalf("domestic: %+v", d)
	}
	b2b := Explain(Facts{IssuerCountry: "DE", IssuerTaxID: "DE123456789", CustomerCountry: "FR", CustomerTaxID: "FRAB123456789"})
	if b2b.Treatment != ReverseChrg || len(b2b.Suggested) != 1 || b2b.Suggested[0].Percent != 0 {
		t.Fatalf("b2b: %+v", b2b)
	}
	b2c := Explain(Facts{IssuerCountry: "DE", IssuerTaxID: "DE123456789", CustomerCountry: "FR"})
	if b2c.Confidence != NeedsDecision || !strings.Contains(strings.Join(b2c.Decisions, " "), "10,000") || !strings.Contains(strings.Join(b2c.Decisions, " "), "20%") {
		t.Fatalf("b2c: %+v", b2c)
	}
	out := Explain(Facts{IssuerCountry: "DE", IssuerTaxID: "DE123456789", CustomerCountry: "CH"})
	if out.Treatment != Export {
		t.Fatalf("outside the EU: %+v", out)
	}
}

func TestUKUAEAndUS(t *testing.T) {
	uk := Explain(Facts{IssuerCountry: "GB", IssuerTaxID: "GB980780684", CustomerCountry: "GB"})
	if uk.Treatment != Domestic || uk.Confidence != Clear || len(uk.Missing) != 0 {
		t.Fatalf("uk: %+v", uk)
	}
	if r := Explain(Facts{IssuerCountry: "GB"}); len(r.Missing) == 0 {
		t.Error("a missing VAT number is reported")
	}
	ae := Explain(Facts{IssuerCountry: "AE", IssuerTaxID: "100123456700003", CustomerCountry: "AE"})
	if ae.Treatment != Domestic || !strings.Contains(ae.Title, "5%") {
		t.Fatalf("uae: %+v", ae)
	}
	us := Explain(Facts{IssuerCountry: "US", CustomerCountry: "US", CustomerTaxExempt: true})
	if us.Confidence != NeedsDecision || len(us.Suggested) != 0 || len(us.Warnings) == 0 {
		t.Fatalf("us: %+v", us)
	}
}

func TestNoPackAndNoCountry(t *testing.T) {
	if r := Explain(Facts{}); r.Confidence != NoPack || len(r.Missing) == 0 {
		t.Fatalf("no country: %+v", r)
	}
	if r := Explain(Facts{IssuerCountry: "JP"}); r.Confidence != NoPack || r.Pack != nil {
		t.Fatalf("no pack: %+v", r)
	}
}

func TestBadNumberIsAWarning(t *testing.T) {
	r := Explain(Facts{IssuerCountry: "IN", IssuerTaxID: "27AAPFU0939F1ZX", CustomerCountry: "IN"})
	if len(r.Warnings) == 0 {
		t.Fatalf("a mistyped GSTIN is flagged: %+v", r)
	}
}
