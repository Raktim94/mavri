package einvoice

import (
	"encoding/xml"
	"strings"
	"testing"

	"github.com/Raktim94/mavri/server/internal/model"
)

func sample() model.Document {
	return model.Document{
		Kind: "invoice", FullNumber: "INV-7", IssuedOn: "2026-10-01", DueOn: "2026-10-31",
		Currency: model.Currency{Code: "EUR", Symbol: "€", Decimals: 2},
		Issuer: model.Party{Name: "Nord GmbH", Address: "Hafenstr. 1\n20457 Hamburg", Country: "DE", TaxID: "DE123456789",
			EScheme: "9930", EAddress: "DE123456789", Email: "a@nord.example", Phone: "+49 40 1"},
		Customer: model.Party{Name: "Kunde AG", Address: "Marktplatz 2\n10115 Berlin", Country: "DE", EScheme: "0204",
			EAddress: "991-12345-67", BuyerReference: "04011000-12345-34"},
		Bank: model.BankAccount{AccountNumber: "DE89370400440532013000", Holder: "Nord GmbH", Swift: "COBADEFFXXX"},
		Lines: []model.Line{{Name: "Beratung & Support", Unit: "hour", Quantity: 2, UnitCents: 10000, TaxRate: 19, TaxMode: "add"},
			{Name: "Lizenz", Quantity: 1, UnitCents: 5000, TaxRate: 7, TaxMode: "add"}},
		ShippingCents: 1000,
		Discount:      model.Adjustment{Mode: "percent", Percent: 10},
		PaidCents:     0,
	}
}

func TestGenerateWellFormedAndConsistent(t *testing.T) {
	for _, profile := range []string{UBL, XRechnung} {
		out, err := Generate(sample(), profile)
		if err != nil {
			t.Fatalf("%s: %v", profile, err)
		}
		var any struct{ XMLName xml.Name }
		if err := xml.Unmarshal(out, &any); err != nil || any.XMLName.Local != "Invoice" {
			t.Fatalf("%s: not well-formed UBL: %v", profile, err)
		}
		s := string(out)
		for _, want := range []string{"<cbc:ID>INV-7</cbc:ID>", `unitCode="HUR"`, `unitCode="C62"`, "Beratung &amp; Support",
			"<cbc:StreetName>Hafenstr. 1</cbc:StreetName>", "<cbc:PostalZone>20457</cbc:PostalZone>", "<cbc:CityName>Hamburg</cbc:CityName>",
			`schemeID="9930"`, "<cbc:ChargeIndicator>false</cbc:ChargeIndicator>", "<cbc:ChargeIndicator>true</cbc:ChargeIndicator>"} {
			if !strings.Contains(s, want) {
				t.Errorf("%s: missing %q", profile, want)
			}
		}
		if (profile == XRechnung) != strings.Contains(s, "xrechnung_3.0") {
			t.Errorf("%s: wrong customization id", profile)
		}
	}
}

func TestAmounts(t *testing.T) {
	// lines: 200.00 at 19% and 50.00 at 7%; 10% discount; 10.00 shipping.
	out, _ := Generate(sample(), UBL)
	s := string(out)
	// net 250 - 25 discount + 10 shipping = 235.00; tax 19%: 180*0.19=34.20, 7%: 45*0.07=3.15 -> 37.35; total 272.35
	for _, want := range []string{`<cbc:LineExtensionAmount currencyID="EUR">250.00</cbc:LineExtensionAmount>`,
		`<cbc:TaxExclusiveAmount currencyID="EUR">235.00</cbc:TaxExclusiveAmount>`,
		`<cbc:TaxAmount currencyID="EUR">37.35</cbc:TaxAmount>`,
		`<cbc:TaxInclusiveAmount currencyID="EUR">272.35</cbc:TaxInclusiveAmount>`,
		`<cbc:PayableAmount currencyID="EUR">272.35</cbc:PayableAmount>`} {
		if !strings.Contains(s, want) {
			t.Errorf("missing %s\n%s", want, s)
		}
	}
}

func TestPrepaidReducesPayable(t *testing.T) {
	d := sample()
	d.PaidCents = 10000
	out, _ := Generate(d, UBL)
	if !strings.Contains(string(out), `<cbc:PayableAmount currencyID="EUR">172.35</cbc:PayableAmount>`) {
		t.Fatalf("payable: %s", out)
	}
}

func TestProblems(t *testing.T) {
	d := sample()
	d.Issuer.EAddress, d.Customer.BuyerReference, d.Issuer.Phone, d.DueOn = "", "", "", ""
	_, err := Generate(d, XRechnung)
	p, ok := err.(Problems)
	if !ok || len(p) != 4 {
		t.Fatalf("problems: %v", err)
	}
	if _, err := Generate(d, UBL); err == nil || len(err.(Problems)) != 1 {
		t.Fatalf("ubl should only need the e-address: %v", err)
	}
	q := sample()
	q.Kind = "quote"
	if _, err := Generate(q, UBL); err == nil {
		t.Fatal("quote exported")
	}
	w := sample()
	w.TaxMode = "withheld"
	if _, err := Generate(w, UBL); err == nil {
		t.Fatal("withheld tax exported")
	}
	if _, err := Generate(sample(), "nope"); err == nil {
		t.Fatal("unknown profile")
	}
}

func TestExemptCustomerUsesCategoryE(t *testing.T) {
	d := sample()
	d.Customer.TaxExempt = true
	out, _ := Generate(d, UBL)
	s := string(out)
	if !strings.Contains(s, "<cbc:ID>E</cbc:ID>") || !strings.Contains(s, "TaxExemptionReason") || strings.Contains(s, "<cbc:ID>S</cbc:ID>") {
		t.Fatalf("exempt: %s", s)
	}
}

func TestAddressSplit(t *testing.T) {
	for _, c := range []struct{ in, street, city, postal string }{
		{"Main St 1", "Main St 1", "", ""}, {"Main St 1\nSpringfield", "Main St 1", "Springfield", ""},
		{"Main St 1\n12345 Spring Field", "Main St 1", "Spring Field", "12345"}, {"", "", "", ""},
	} {
		if a, b, c2 := address(c.in); a != c.street || b != c.city || c2 != c.postal {
			t.Errorf("%q -> %q %q %q", c.in, a, b, c2)
		}
	}
}
