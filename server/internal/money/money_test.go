package money

import (
	"testing"

	"github.com/Raktim94/mavri/server/internal/model"
)

func line(q float64, unit int64, rate float64, mode string) model.Line {
	return model.Line{Name: "x", Quantity: q, UnitCents: unit, TaxRate: rate, TaxMode: mode}
}

func TestCompute(t *testing.T) {
	cases := []struct {
		name string
		doc  model.Document
		want model.Totals
	}{
		{"tax added per line", model.Document{Lines: []model.Line{line(3, 10000, 10, "add")}},
			model.Totals{SubtotalCents: 30000, TaxCents: 3000, TotalCents: 33000}},
		{"tax included in price", model.Document{Lines: []model.Line{line(1, 11000, 10, "included")}},
			model.Totals{SubtotalCents: 10000, TaxCents: 1000, TotalCents: 11000}},
		{"percent discount then document tax then shipping", model.Document{
			Lines: []model.Line{line(1, 20000, 0, "")}, Discount: model.Adjustment{Mode: "percent", Percent: 10},
			TaxRate: 20, TaxMode: "add", ShippingCents: 500},
			model.Totals{SubtotalCents: 20000, DiscountCents: 2000, ShippingCents: 500, TaxCents: 3600, TotalCents: 22100}},
		{"withheld tax is subtracted", model.Document{Lines: []model.Line{line(1, 10000, 0, "")}, TaxRate: 10, TaxMode: "withheld"},
			model.Totals{SubtotalCents: 10000, TaxCents: -1000, TotalCents: 9000}},
		{"fixed surcharge", model.Document{Lines: []model.Line{line(2, 500, 0, "")}, Surcharge: model.Adjustment{Mode: "fixed", Cents: 250}},
			model.Totals{SubtotalCents: 1000, SurchargeCents: 250, TotalCents: 1250}},
		{"document tax included reports the inner part", model.Document{Lines: []model.Line{line(1, 12000, 0, "")}, TaxRate: 20, TaxMode: "included"},
			model.Totals{SubtotalCents: 12000, TaxCents: 2000, TotalCents: 12000}},
		{"half cents round away from zero", model.Document{Lines: []model.Line{line(1, 5, 10, "add")}},
			model.Totals{SubtotalCents: 5, TaxCents: 1, TotalCents: 6}},
		{"fractional quantity", model.Document{Lines: []model.Line{line(1.5, 1001, 0, "")}},
			model.Totals{SubtotalCents: 1502, TotalCents: 1502}},
	}
	for _, c := range cases {
		if got := Compute(&c.doc); got != c.want {
			t.Errorf("%s: got %+v want %+v", c.name, got, c.want)
		}
	}
}

func TestInvoiceStatus(t *testing.T) {
	for _, c := range []struct {
		cur         string
		total, paid int64
		want        string
	}{
		{"unpaid", 100, 0, "unpaid"}, {"unpaid", 100, 40, "partial"}, {"partial", 100, 100, "paid"},
		{"paid", 100, 150, "paid"}, {"void", 100, 100, "void"}, {"unpaid", 0, 0, "unpaid"},
	} {
		if got := InvoiceStatus(c.cur, c.total, c.paid); got != c.want {
			t.Errorf("%+v: got %s", c, got)
		}
	}
}

func TestFormat(t *testing.T) {
	usd := model.Currency{Code: "USD", Symbol: "$", Pattern: "{symbol}{amount}", Decimals: 2}
	eur := model.Currency{Code: "EUR", Symbol: "€", Pattern: "{amount} {symbol}", Decimals: 2}
	jpy := model.Currency{Code: "JPY", Symbol: "¥", Pattern: "{symbol}{amount}", Decimals: 0}
	for _, c := range []struct {
		cents int64
		cur   model.Currency
		want  string
	}{{123456, usd, "$1,234.56"}, {5, usd, "$0.05"}, {-250, eur, "-2.50 €"}, {500, jpy, "¥500"}, {0, usd, "$0.00"}} {
		if got := Format(c.cents, c.cur); got != c.want {
			t.Errorf("Format(%d)=%q want %q", c.cents, got, c.want)
		}
	}
	if Major(1999, 2) != "19.99" || Major(-5, 2) != "-0.05" || Major(7, 0) != "7" {
		t.Error("Major")
	}
}
