// Package money does invoice arithmetic exactly, using rational numbers.
//
// All amounts here are in minor units (cents) unless stated otherwise. The
// functions follow the same steps as the renderer's invoice maths
// (src/renderer/shared/utils/invoiceFunctions.ts) but never lose precision
// to binary floating point. Results are exact rationals; rounding to whole
// minor units is explicit (Round) and uses round-half-up, matching
// JavaScript's Math.round for the values that matter.
//
// Differential tests against the real TypeScript functions live in
// money_test.go and report where the old float results and these exact
// results differ.
package money

import (
	"fmt"
	"math/big"
)

// Rat is an exact rational amount or rate.
type Rat = big.Rat

// ParseDecimal parses a plain decimal string such as "12.5" or "-0.333".
// Empty input is zero. It rejects exponents, hex and anything non-decimal.
func ParseDecimal(s string) (*Rat, error) {
	if s == "" {
		return new(Rat), nil
	}
	for i, c := range s {
		ok := c >= '0' && c <= '9' || c == '.' || (i == 0 && (c == '-' || c == '+'))
		if !ok {
			return nil, fmt.Errorf("money: invalid decimal %q", s)
		}
	}
	r, ok := new(Rat).SetString(s)
	if !ok {
		return nil, fmt.Errorf("money: invalid decimal %q", s)
	}
	return r, nil
}

// MustDecimal is ParseDecimal for trusted constants; it panics on bad input.
func MustDecimal(s string) *Rat {
	r, err := ParseDecimal(s)
	if err != nil {
		panic(err)
	}
	return r
}

// Round rounds to the nearest whole unit, halves toward positive infinity
// (JavaScript Math.round semantics: -2.5 becomes -2, 2.5 becomes 3).
func Round(x *Rat) *big.Int {
	half := big.NewRat(1, 2)
	t := new(Rat).Add(x, half)
	// floor(t) = quotient of numerator/denominator rounded toward -inf.
	q, m := new(big.Int).DivMod(t.Num(), t.Denom(), new(big.Int))
	_ = m // DivMod uses Euclidean division; denominator > 0 so q is the floor.
	return q
}

// Tax kinds. "deducted" exists only at invoice level.
const (
	TaxExclusive = "exclusive"
	TaxInclusive = "inclusive"
	TaxDeducted  = "deducted"
)

// Amount kinds for discounts and surcharges.
const (
	Fixed      = "fixed"
	Percentage = "percentage"
)

// CalcTax returns the tax contained in or added to amount. An empty or
// unknown taxType means no tax.
func CalcTax(amount, rate *Rat, taxType string) *Rat {
	hundred := big.NewRat(100, 1)
	switch taxType {
	case TaxExclusive:
		return new(Rat).Quo(new(Rat).Mul(amount, rate), hundred)
	case TaxInclusive:
		den := new(Rat).Add(hundred, rate)
		if den.Sign() == 0 {
			return new(Rat) // a -100% rate is meaningless; avoid dividing by zero
		}
		return new(Rat).Quo(new(Rat).Mul(amount, rate), den)
	case TaxDeducted:
		return new(Rat).Neg(new(Rat).Quo(new(Rat).Mul(amount, rate), hundred))
	}
	return new(Rat)
}

// Adjustment is a discount or surcharge: a fixed amount in cents or a percent.
type Adjustment struct {
	Type    string // "", Fixed or Percentage
	Amount  *Rat   // cents, used when Type == Fixed
	Percent *Rat   // used when Type == Percentage
}

// Calc applies the adjustment to base. No type means zero.
func (a Adjustment) Calc(base *Rat) *Rat {
	switch a.Type {
	case "":
		return new(Rat)
	case Fixed:
		if a.Amount == nil {
			return new(Rat)
		}
		return new(Rat).Set(a.Amount)
	default:
		if a.Percent == nil {
			return new(Rat)
		}
		return new(Rat).Quo(new(Rat).Mul(base, a.Percent), big.NewRat(100, 1))
	}
}

// Line is one invoice line. UnitPrice and Quantity are exact decimals;
// TaxType is "", TaxExclusive or TaxInclusive.
type Line struct {
	UnitPrice *Rat // cents
	Quantity  *Rat
	TaxRate   *Rat
	TaxType   string
}

// Invoice holds everything the total depends on.
type Invoice struct {
	TaxRate    *Rat
	TaxType    string // "", TaxExclusive, TaxInclusive or TaxDeducted
	Lines      []Line
	Discount   Adjustment
	Surcharge  Adjustment
	Shipping   *Rat // cents
	IncludeTax bool
}

func (l Line) gross() *Rat { return new(Rat).Mul(l.UnitPrice, l.Quantity) }

// Subtotal is the sum of unit price x quantity over all lines.
func (inv Invoice) Subtotal() *Rat {
	sum := new(Rat)
	for _, l := range inv.Lines {
		sum.Add(sum, l.gross())
	}
	return sum
}

// LineResult is a line's share of the invoice-level discount and its tax.
type LineResult struct {
	Discount *big.Int // whole cents, rounded half-up
	Tax      *Rat
	Total    *Rat
}

// Lines computes each line's discount share, tax and total. The invoice
// discount is spread in proportion to line value and each share is rounded
// to whole cents.
func (inv Invoice) LineResults() []LineResult {
	sub := inv.Subtotal()
	totalDiscount := inv.Discount.Calc(sub)
	out := make([]LineResult, len(inv.Lines))
	for i, l := range inv.Lines {
		gross := l.gross()
		disc := new(big.Int)
		if sub.Sign() > 0 && totalDiscount.Sign() > 0 {
			share := new(Rat).Mul(new(Rat).Quo(gross, sub), totalDiscount)
			disc = Round(share)
		}
		taxable := new(Rat).Sub(gross, new(Rat).SetInt(disc))
		tax := CalcTax(taxable, l.TaxRate, l.TaxType)
		total := new(Rat).Sub(gross, new(Rat).SetInt(disc))
		if l.TaxType != TaxInclusive {
			total.Add(total, tax)
		}
		out[i] = LineResult{Discount: disc, Tax: tax, Total: total}
	}
	return out
}

// Total is the invoice total in cents as an exact rational. Round it with
// Round when a whole-cent amount is needed.
func (inv Invoice) Total() *Rat {
	sub := inv.Subtotal()
	afterDiscount := new(Rat).Sub(sub, inv.Discount.Calc(sub))
	surcharge := inv.Surcharge.Calc(afterDiscount)

	tax := new(Rat)
	if inv.IncludeTax {
		tax.Add(tax, CalcTax(afterDiscount, inv.TaxRate, inv.TaxType))
		for i, res := range inv.LineResults() {
			if inv.Lines[i].TaxType != TaxInclusive {
				tax.Add(tax, res.Tax)
			}
		}
	}
	total := new(Rat).Add(afterDiscount, inv.Shipping)
	total.Add(total, surcharge)
	if inv.TaxType != TaxInclusive {
		total.Add(total, tax)
	}
	return total
}
