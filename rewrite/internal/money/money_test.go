package money

import (
	"encoding/json"
	"io"
	"math"
	"math/big"
	"os"
	"testing"
)

func TestRoundMatchesMathRound(t *testing.T) {
	cases := map[string]int64{"2.5": 3, "2.4": 2, "-2.5": -2, "-2.6": -3, "0.5": 1, "-0.5": 0, "0": 0, "1234.4999": 1234, "7": 7}
	for in, want := range cases {
		if got := Round(MustDecimal(in)); got.Int64() != want {
			t.Errorf("Round(%s)=%s want %d", in, got, want)
		}
	}
}

func TestParseDecimal(t *testing.T) {
	for _, bad := range []string{"1e3", "0x10", "1,5", "abc", "1.2.3", " 1", "--1"} {
		if _, err := ParseDecimal(bad); err == nil {
			t.Errorf("%q should be rejected", bad)
		}
	}
	if r, err := ParseDecimal(""); err != nil || r.Sign() != 0 {
		t.Error("empty is zero")
	}
}

func TestSimpleInvoice(t *testing.T) {
	inv := Invoice{
		TaxRate: MustDecimal("18"), TaxType: TaxExclusive, IncludeTax: true,
		Lines:    []Line{{UnitPrice: MustDecimal("10000"), Quantity: MustDecimal("2"), TaxRate: MustDecimal("0")}},
		Discount: Adjustment{}, Surcharge: Adjustment{}, Shipping: new(Rat),
	}
	if got := inv.Total(); got.Cmp(big.NewRat(23600, 1)) != 0 { // 20000 + 18%
		t.Fatalf("got %s", got.FloatString(4))
	}
}

// ---- differential test against the real TypeScript implementation ----

type tsCase struct {
	In struct {
		TaxRate json.Number `json:"taxRate"`
		TaxType string
		Items   []struct {
			UnitPriceCents json.Number `json:"unitPriceCents"`
			Quantity       json.Number `json:"quantity"`
			TaxRate        json.Number `json:"taxRate"`
			TaxType        string      `json:"taxType"`
		} `json:"items"`
		DiscountType     string      `json:"discountType"`
		DiscountAmount   json.Number `json:"discountAmount"`
		DiscountPercent  json.Number `json:"discountPercent"`
		ShippingFee      json.Number `json:"shippingFee"`
		SurchargeType    string      `json:"surchargeType"`
		SurchargeAmount  json.Number `json:"surchargeAmount"`
		SurchargePercent json.Number `json:"surchargePercent"`
		IncludeTax       bool        `json:"includeTax"`
	} `json:"in"`
	JS struct {
		Total float64                                  `json:"total"`
		Items []struct{ Tax, Discount, Total float64 } `json:"items"`
	} `json:"js"`
}

func (c tsCase) invoice(t *testing.T) Invoice {
	d := func(n json.Number) *Rat {
		r, err := ParseDecimal(n.String())
		if err != nil {
			t.Fatal(err)
		}
		return r
	}
	in := c.In
	inv := Invoice{
		TaxRate: d(in.TaxRate), TaxType: in.TaxType, IncludeTax: in.IncludeTax, Shipping: d(in.ShippingFee),
		Discount:  Adjustment{Type: in.DiscountType, Amount: d(in.DiscountAmount), Percent: d(in.DiscountPercent)},
		Surcharge: Adjustment{Type: in.SurchargeType, Amount: d(in.SurchargeAmount), Percent: d(in.SurchargePercent)},
	}
	for _, it := range in.Items {
		inv.Lines = append(inv.Lines, Line{UnitPrice: d(it.UnitPriceCents), Quantity: d(it.Quantity), TaxRate: d(it.TaxRate), TaxType: it.TaxType})
	}
	return inv
}

// TestAgainstTypeScript compares the exact Go arithmetic with the real
// reference calculations on synthetic invoices.
//
// Known, accepted divergence: the TypeScript code spreads the invoice
// discount over lines with Math.round((line/subtotal)*discount) in binary
// floating point. When the exact share is precisely n.5 cents, float error can
// make it n.4999... and JavaScript rounds DOWN, while exact half-up rounds UP.
// The test requires every difference to be of that kind and nothing else.
func TestAgainstTypeScript(t *testing.T) {
	raw, err := os.ReadFile("testdata/cases.json")
	if err != nil {
		t.Fatal(err)
	}
	var cases []tsCase
	dec := json.NewDecoder(bytesReader(raw))
	dec.UseNumber()
	if err := dec.Decode(&cases); err != nil {
		t.Fatal(err)
	}
	var lines, halfDiffs, invoicesWithHalfDiff, totalDiffs int
	for _, c := range cases {
		inv := c.invoice(t)
		sub := inv.Subtotal()
		td := inv.Discount.Calc(sub)
		hasHalf := false
		for j, res := range inv.LineResults() {
			lines++
			js := c.JS.Items[j]
			if res.Discount.Int64() == int64(js.Discount) {
				continue
			}
			gross := inv.Lines[j].gross()
			share := new(Rat).Mul(new(Rat).Quo(gross, sub), td)
			floor := new(big.Int).Div(share.Num(), share.Denom())
			frac := new(Rat).Sub(share, new(Rat).SetInt(floor))
			if frac.Cmp(big.NewRat(1, 2)) != 0 || int64(js.Discount) != floor.Int64() || res.Discount.Int64() != floor.Int64()+1 {
				t.Fatalf("unexplained line-discount difference: exact share %s, Go %s, TS %v", share.FloatString(6), res.Discount, js.Discount)
			}
			halfDiffs++
			hasHalf = true
		}
		ex, _ := inv.Total().Float64()
		if math.Abs(ex-c.JS.Total) > 1e-9*math.Max(1, math.Abs(c.JS.Total)) {
			totalDiffs++
			if !hasHalf {
				t.Fatalf("invoice total differs (Go %.6f, TS %.6f) without a half-cent line discount", ex, c.JS.Total)
			}
		}
		if hasHalf {
			invoicesWithHalfDiff++
		}
	}
	t.Logf("cases=%d lines=%d; half-cent discount differences=%d (in %d invoices, %d with a different total); everything else identical",
		len(cases), lines, halfDiffs, invoicesWithHalfDiff, totalDiffs)
}

func bytesReader(b []byte) *bytesRd { return &bytesRd{b: b} }

type bytesRd struct {
	b []byte
	i int
}

func (r *bytesRd) Read(p []byte) (int, error) {
	if r.i >= len(r.b) {
		return 0, io.EOF
	}
	n := copy(p, r.b[r.i:])
	r.i += n
	return n, nil
}
