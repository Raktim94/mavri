// Package money does document arithmetic in whole minor units (cents).
//
// Rules, in order:
//  1. A line's gross amount is quantity × unit price, rounded to a whole unit.
//  2. A line with tax mode "add" gets tax on top; "included" has the tax
//     inside its price, which is split out. Both round per line.
//  3. Discount and surcharge are taken from the sum of line amounts without
//     tax (percent of that sum, or a fixed amount).
//  4. The document-level tax applies to that adjusted base: "add" puts it on
//     top, "included" only reports the part already inside, "withheld"
//     subtracts it (tax deducted at source).
//  5. Shipping is added last and is not taxed.
//
// All rounding is half away from zero.
package money

import (
	"math"
	"strings"

	"github.com/Raktim94/mavri/server/internal/model"
)

// Round rounds half away from zero.
func Round(f float64) int64 { return int64(math.Round(f)) }

func percentOf(base int64, pct float64) int64 { return Round(float64(base) * pct / 100) }

func adjust(a model.Adjustment, base int64) int64 {
	switch a.Mode {
	case "percent":
		return percentOf(base, a.Percent)
	case "fixed":
		return a.Cents
	}
	return 0
}

// Gross is a line's quantity × unit price.
func Gross(l model.Line) int64 { return Round(l.Quantity * float64(l.UnitCents)) }

// LineTax returns the net amount and the tax of one line. For an "included"
// line the net is the gross minus the tax found inside it.
func LineTax(l model.Line) (net, tax int64) {
	g := Gross(l)
	switch {
	case l.TaxMode == "included" && l.TaxRate > 0:
		t := Round(float64(g) - float64(g)/(1+l.TaxRate/100))
		return g - t, t
	case l.TaxMode == "add" && l.TaxRate > 0:
		return g, percentOf(g, l.TaxRate)
	}
	return g, 0
}

// Compute totals the lines and adjustments of a document.
func Compute(d *model.Document) model.Totals {
	var t model.Totals
	var lineTax int64
	for _, l := range d.Lines {
		net, tax := LineTax(l)
		t.SubtotalCents += net
		lineTax += tax
	}
	t.DiscountCents = adjust(d.Discount, t.SubtotalCents)
	t.SurchargeCents = adjust(d.Surcharge, t.SubtotalCents)
	base := t.SubtotalCents - t.DiscountCents + t.SurchargeCents
	var docTax int64
	if d.TaxRate > 0 {
		switch d.TaxMode {
		case "add":
			docTax = percentOf(base, d.TaxRate)
		case "withheld":
			docTax = -percentOf(base, d.TaxRate)
		case "included":
			docTax = 0
		}
	}
	t.ShippingCents = d.ShippingCents
	t.TaxCents = lineTax + docTax
	t.TotalCents = base + lineTax + docTax + d.ShippingCents
	if d.TaxMode == "included" && d.TaxRate > 0 {
		// The base already contains the tax; report the part inside it.
		t.TaxCents = lineTax + Round(float64(base)-float64(base)/(1+d.TaxRate/100))
	}
	return t
}

// Paid sums the payments of a document.
func Paid(d *model.Document) int64 {
	var s int64
	for _, p := range d.Payments {
		s += p.AmountCents
	}
	return s
}

// InvoiceStatus is the status an invoice has given its payments, unless it is void.
func InvoiceStatus(current string, total, paid int64) string {
	switch {
	case current == model.StatusVoid:
		return model.StatusVoid
	case total > 0 && paid >= total:
		return model.StatusPaid
	case paid > 0:
		return model.StatusPartial
	}
	return model.StatusUnpaid
}

// Format writes an amount using the currency's pattern, for example "{symbol}{amount}".
func Format(cents int64, c model.Currency) string {
	neg := cents < 0
	if neg {
		cents = -cents
	}
	scale := int64(math.Pow10(c.Decimals))
	whole, frac := cents/scale, cents%scale
	digits := groupThousands(itoa(whole))
	if c.Decimals > 0 {
		f := itoa(frac)
		digits += "." + strings.Repeat("0", c.Decimals-len(f)) + f
	}
	pattern := c.Pattern
	if pattern == "" {
		pattern = "{symbol}{amount}"
	}
	out := strings.NewReplacer("{symbol}", c.Symbol, "{amount}", digits, "{code}", c.Code).Replace(pattern)
	if neg {
		return "-" + out
	}
	return out
}

func itoa(n int64) string {
	if n == 0 {
		return "0"
	}
	var b []byte
	for n > 0 {
		b = append([]byte{byte('0' + n%10)}, b...)
		n /= 10
	}
	return string(b)
}

func groupThousands(s string) string {
	for i := len(s) - 3; i > 0; i -= 3 {
		s = s[:i] + "," + s[i:]
	}
	return s
}

// Major converts minor units to a decimal string such as "12.50" for exchange formats.
func Major(cents int64, decimals int) string {
	neg := cents < 0
	if neg {
		cents = -cents
	}
	scale := int64(math.Pow10(decimals))
	s := itoa(cents / scale)
	if decimals > 0 {
		f := itoa(cents % scale)
		s += "." + strings.Repeat("0", decimals-len(f)) + f
	}
	if neg {
		return "-" + s
	}
	return s
}

// ToMinor converts a major-unit amount to minor units for a currency with this many decimals.
func ToMinor(major float64, decimals int) int64 { return Round(major * math.Pow10(decimals)) }
