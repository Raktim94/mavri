package einvoice

import (
	"errors"
	"math"

	"github.com/Raktim94/nodedr-invoice/rewrite/internal/jsnum"
)

type line struct {
	lineAmount, unitAmount, taxAmount, taxRate float64
	taxCategoryID                              string
	grossAmount, discountAmount                float64
}

type vatGroup struct{ rate, taxable, tax float64 }

type calc struct {
	lines                                                               []line
	subtotalNet, discountTotal, shippingTotal, surchargeTotal, taxTotal float64
	payableTotal                                                        float64
	vatGroups                                                           []vatGroup
}

var errNoSnapshot = errors.New("invoice item without a price snapshot")

func items(inv Row) []Row {
	l, _ := inv["invoiceItems"].([]Row)
	return l
}

func child(r Row, k string) Row {
	c, _ := r[k].(Row)
	return c
}

func num(r Row, k string) float64 { return jsnum.Num(r[k]) }

func itemAmount(item Row) (float64, error) {
	snap := child(item, "invoiceItemSnapshot")
	if snap == nil {
		return 0, errNoSnapshot
	}
	return jsnum.Num(snap["unitPriceCents"]) * jsnum.Num(item["quantity"]), nil
}

func totalPaid(inv Row) float64 {
	pays, _ := inv["invoicePayments"].([]Row)
	var sum float64
	for _, p := range pays {
		sum += jsnum.Num(p["amountCents"])
	}
	return sum
}

func discount(subtotalNet float64, inv Row) float64 {
	if !jsnum.Truthy(inv["discountType"]) {
		return 0
	}
	if inv["discountType"] == "fixed" {
		return num(inv, "discountAmountCents")
	}
	return (subtotalNet * num(inv, "discountPercent")) / 100
}

func surcharge(subtotalNet float64, inv Row) float64 {
	if !jsnum.Truthy(inv["surchargeType"]) {
		return 0
	}
	if inv["surchargeType"] == "fixed" {
		return num(inv, "surchargeAmountCents")
	}
	return (subtotalNet * num(inv, "surchargePercent")) / 100
}

// itemRate is the line's own tax rate when it carries a tax type, else the invoice's.
func itemRate(item, inv Row) float64 {
	if item["taxType"] != nil {
		return jsnum.Num(item["taxRate"])
	}
	return num(inv, "taxRate")
}

func calcLine(item Row, totalDiscount, totalGross, invoiceRate float64, invoiceTaxType any) (line, error) {
	quantity := jsnum.Num(item["quantity"])
	gross, err := itemAmount(item)
	if err != nil {
		return line{}, err
	}
	portion := 0.0
	if totalGross != 0 && !math.IsNaN(totalGross) {
		portion = jsnum.Round((gross / totalGross) * totalDiscount)
	}
	rate := invoiceRate
	if item["taxType"] != nil {
		rate = jsnum.Num(item["taxRate"])
	}
	taxType := ""
	if jsnum.Truthy(invoiceTaxType) {
		taxType, _ = invoiceTaxType.(string)
	} else if jsnum.Truthy(item["taxType"]) {
		if item["taxType"] == "exclusive" {
			taxType = "exclusive"
		} else {
			taxType = "inclusive"
		}
	}
	var net, tax float64
	switch taxType {
	case "exclusive":
		net = gross - portion
		tax = (net * rate) / 100
	case "inclusive":
		net = (gross - portion) / (1 + rate/100)
		tax = gross - portion - net
	case "deducted":
		net = gross - portion
		tax = -(net * rate) / 100
	default:
		net = gross - portion
		tax = 0
	}
	l := line{lineAmount: net, taxAmount: tax, taxRate: rate, grossAmount: gross, discountAmount: portion, taxCategoryID: "Z"}
	if quantity != 0 && !math.IsNaN(quantity) {
		l.unitAmount = net / quantity
	}
	if rate > 0 {
		l.taxCategoryID = "S"
	}
	return l, nil
}

func aggregateVat(lines []line) []vatGroup {
	var groups []vatGroup
	for _, l := range lines {
		found := false
		for i := range groups {
			if groups[i].rate == l.taxRate || (math.IsNaN(groups[i].rate) && math.IsNaN(l.taxRate)) {
				groups[i].taxable += l.lineAmount
				groups[i].tax += l.taxAmount
				found = true
				break
			}
		}
		if !found {
			groups = append(groups, vatGroup{rate: l.taxRate, taxable: l.lineAmount, tax: l.taxAmount})
		}
	}
	return groups
}

func totals(inv Row) (*calc, error) {
	var totalGross float64
	for _, it := range items(inv) {
		a, err := itemAmount(it)
		if err != nil {
			return nil, err
		}
		totalGross += a
	}
	disc := discount(totalGross, inv)
	sur := surcharge(totalGross-disc, inv)
	c := &calc{discountTotal: disc, surchargeTotal: sur}
	for _, it := range items(inv) {
		l, err := calcLine(it, disc, totalGross, num(inv, "taxRate"), inv["taxType"])
		if err != nil {
			return nil, err
		}
		c.lines = append(c.lines, l)
	}
	for _, l := range c.lines {
		c.subtotalNet += l.lineAmount
	}
	for _, l := range c.lines {
		c.taxTotal += l.taxAmount
	}
	c.shippingTotal = 0
	if jsnum.Truthy(inv["shippingFeeCents"]) {
		c.shippingTotal = num(inv, "shippingFeeCents")
	}
	c.vatGroups = aggregateVat(c.lines)
	c.payableTotal = c.subtotalNet + c.taxTotal + c.shippingTotal + sur
	return c, nil
}
