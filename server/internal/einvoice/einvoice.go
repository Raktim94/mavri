// Package einvoice writes a document as a UBL 2.1 invoice for the Peppol BIS
// Billing 3.0 and XRechnung 3.0 profiles (EN 16931).
//
// Amounts are rebuilt from the document's lines grouped by tax rate, the way
// the standard asks for them, so a multi-rate invoice can differ from the
// on-screen total by a cent of rounding.
package einvoice

import (
	"bytes"
	"encoding/xml"
	"fmt"
	"math"
	"sort"
	"strings"

	"github.com/Raktim94/mavri/server/internal/model"
	"github.com/Raktim94/mavri/server/internal/money"
)

// Profiles.
const (
	UBL       = "ubl"
	XRechnung = "xrechnung"
)

// Problems lists everything that stops a document from becoming a valid e-invoice.
type Problems []string

func (p Problems) Error() string { return strings.Join(p, "; ") }

const (
	peppolCustomization = "urn:cen.eu:en16931:2017#compliant#urn:fdc:peppol.eu:2017:poacc:billing:3.0"
	xrechnungCustom     = "urn:cen.eu:en16931:2017#compliant#urn:xeinkauf.de:kosit:xrechnung_3.0"
	peppolProfile       = "urn:fdc:peppol.eu:2017:poacc:billing:01:1.0"
)

// bucket is the part of a document taxed at one rate.
type bucket struct {
	rate    float64
	exempt  bool
	taxable int64 // net lines, adjusted below
	lines   int64 // net of lines only
}

type lineOut struct {
	line model.Line
	net  int64
	rate float64
	cat  string
}

// Generate renders the document or returns Problems.
func Generate(d model.Document, profile string) ([]byte, error) {
	if profile != UBL && profile != XRechnung {
		return nil, fmt.Errorf("unknown e-invoice profile %q", profile)
	}
	if problems := check(d, profile); len(problems) > 0 {
		return nil, problems
	}
	dec := d.Currency.Decimals
	amt := func(c int64) string { return money.Major(c, dec) }
	exempt := d.Customer.TaxExempt

	// Net amount and rate per line.
	var outs []lineOut
	for _, l := range d.Lines {
		ml := l
		if ml.TaxMode == "" && d.TaxRate > 0 && (d.TaxMode == "add" || d.TaxMode == "included") {
			ml.TaxMode, ml.TaxRate = d.TaxMode, d.TaxRate
			if ml.TaxMode == "add" {
				ml.TaxMode = "add"
			}
		}
		net, _ := money.LineTax(ml)
		rate := 0.0
		if ml.TaxMode != "" && !exempt {
			rate = ml.TaxRate
		}
		cat := "Z"
		switch {
		case exempt:
			cat = "E"
		case rate > 0:
			cat = "S"
		}
		if exempt && l.TaxMode == "included" {
			net = money.Gross(l)
		}
		outs = append(outs, lineOut{line: l, net: net, rate: rate, cat: cat})
	}
	buckets := map[string]*bucket{}
	var keys []string
	var lineSum int64
	for _, o := range outs {
		k := fmt.Sprintf("%s|%v", o.cat, o.rate)
		b := buckets[k]
		if b == nil {
			b = &bucket{rate: o.rate, exempt: o.cat == "E"}
			buckets[k] = b
			keys = append(keys, k)
		}
		b.taxable += o.net
		b.lines += o.net
		lineSum += o.net
	}
	sort.Strings(keys)

	t := money.Compute(&d)
	// Document-level allowance, charge and shipping, shared across buckets by weight.
	type ac struct {
		charge bool
		reason string
		amount int64
		key    string
	}
	var acs []ac
	share := func(total int64, charge bool, reason string, sign int64) {
		if total == 0 {
			return
		}
		left := total
		for i, k := range keys {
			b := buckets[k]
			part := total
			if i < len(keys)-1 {
				part = money.Round(float64(total) * float64(b.lines) / float64(max64(lineSum, 1)))
				left -= part
			} else {
				part = left
			}
			if part == 0 {
				continue
			}
			b.taxable += sign * part
			acs = append(acs, ac{charge, reason, part, k})
		}
	}
	share(t.DiscountCents, false, "Discount", -1)
	share(t.SurchargeCents, true, "Surcharge", +1)
	var shipKey string
	if t.ShippingCents > 0 {
		shipKey = "Z|0"
		b := buckets[shipKey]
		if b == nil {
			b = &bucket{}
			buckets[shipKey] = b
			keys = append(keys, shipKey)
			sort.Strings(keys)
		}
		b.taxable += t.ShippingCents
		acs = append(acs, ac{true, "Shipping", t.ShippingCents, shipKey})
	}

	var taxTotal int64
	taxOf := map[string]int64{}
	for _, k := range keys {
		b := buckets[k]
		tx := money.Round(float64(b.taxable) * b.rate / 100)
		taxOf[k] = tx
		taxTotal += tx
	}
	taxExcl := lineSum - t.DiscountCents + t.SurchargeCents + t.ShippingCents
	taxIncl := taxExcl + taxTotal
	paid := d.PaidCents
	payable := taxIncl - paid

	var x xmlWriter
	x.raw(`<?xml version="1.0" encoding="UTF-8"?>` + "\n")
	x.open(`Invoice xmlns="urn:oasis:names:specification:ubl:schema:xsd:Invoice-2" xmlns:cac="urn:oasis:names:specification:ubl:schema:xsd:CommonAggregateComponents-2" xmlns:cbc="urn:oasis:names:specification:ubl:schema:xsd:CommonBasicComponents-2"`)
	custom := peppolCustomization
	if profile == XRechnung {
		custom = xrechnungCustom
	}
	x.el("cbc:CustomizationID", custom)
	x.el("cbc:ProfileID", peppolProfile)
	x.el("cbc:ID", d.FullNumber)
	x.el("cbc:IssueDate", d.IssuedOn)
	if d.DueOn != "" {
		x.el("cbc:DueDate", d.DueOn)
	}
	x.el("cbc:InvoiceTypeCode", "380")
	if n := strings.TrimSpace(d.NoteCustomer); n != "" {
		x.el("cbc:Note", n)
	}
	x.el("cbc:DocumentCurrencyCode", d.Currency.Code)
	if ref := d.Customer.BuyerReference; ref != "" {
		x.el("cbc:BuyerReference", ref)
	}
	x.party("cac:AccountingSupplierParty", d.Issuer, true)
	x.party("cac:AccountingCustomerParty", d.Customer, false)
	if d.Bank.AccountNumber != "" {
		x.open("cac:PaymentMeans")
		x.el("cbc:PaymentMeansCode", "30")
		x.open("cac:PayeeFinancialAccount")
		x.el("cbc:ID", d.Bank.AccountNumber)
		if d.Bank.Holder != "" {
			x.el("cbc:Name", d.Bank.Holder)
		}
		if d.Bank.Swift != "" {
			x.open("cac:FinancialInstitutionBranch")
			x.el("cbc:ID", d.Bank.Swift)
			x.close("cac:FinancialInstitutionBranch")
		}
		x.close("cac:PayeeFinancialAccount")
		x.close("cac:PaymentMeans")
	}
	if n := strings.TrimSpace(d.NoteTerms); n != "" {
		x.open("cac:PaymentTerms")
		x.el("cbc:Note", n)
		x.close("cac:PaymentTerms")
	}
	catOf := func(k string) (cat string, rate float64) {
		b := buckets[k]
		cat = strings.SplitN(k, "|", 2)[0]
		return cat, b.rate
	}
	for _, a := range acs {
		cat, rate := catOf(a.key)
		x.open("cac:AllowanceCharge")
		x.el("cbc:ChargeIndicator", fmt.Sprint(a.charge))
		x.el("cbc:AllowanceChargeReason", a.reason)
		x.elAttr("cbc:Amount", "currencyID", d.Currency.Code, amt(a.amount))
		x.taxCategory(cat, rate, exempt)
		x.close("cac:AllowanceCharge")
	}
	x.open("cac:TaxTotal")
	x.elAttr("cbc:TaxAmount", "currencyID", d.Currency.Code, amt(taxTotal))
	for _, k := range keys {
		cat, rate := catOf(k)
		x.open("cac:TaxSubtotal")
		x.elAttr("cbc:TaxableAmount", "currencyID", d.Currency.Code, amt(buckets[k].taxable))
		x.elAttr("cbc:TaxAmount", "currencyID", d.Currency.Code, amt(taxOf[k]))
		x.taxCategory(cat, rate, exempt)
		x.close("cac:TaxSubtotal")
	}
	x.close("cac:TaxTotal")
	x.open("cac:LegalMonetaryTotal")
	x.elAttr("cbc:LineExtensionAmount", "currencyID", d.Currency.Code, amt(lineSum))
	x.elAttr("cbc:TaxExclusiveAmount", "currencyID", d.Currency.Code, amt(taxExcl))
	x.elAttr("cbc:TaxInclusiveAmount", "currencyID", d.Currency.Code, amt(taxIncl))
	x.elAttr("cbc:AllowanceTotalAmount", "currencyID", d.Currency.Code, amt(t.DiscountCents))
	x.elAttr("cbc:ChargeTotalAmount", "currencyID", d.Currency.Code, amt(t.SurchargeCents+t.ShippingCents))
	x.elAttr("cbc:PrepaidAmount", "currencyID", d.Currency.Code, amt(paid))
	x.elAttr("cbc:PayableAmount", "currencyID", d.Currency.Code, amt(payable))
	x.close("cac:LegalMonetaryTotal")
	for i, o := range outs {
		x.open("cac:InvoiceLine")
		x.el("cbc:ID", fmt.Sprint(i+1))
		x.elAttr("cbc:InvoicedQuantity", "unitCode", unitCode(o.line.Unit), trimFloat(o.line.Quantity))
		x.elAttr("cbc:LineExtensionAmount", "currencyID", d.Currency.Code, amt(o.net))
		x.open("cac:Item")
		x.el("cbc:Name", o.line.Name)
		x.open("cac:ClassifiedTaxCategory")
		x.el("cbc:ID", o.cat)
		x.el("cbc:Percent", trimFloat(o.rate))
		x.open("cac:TaxScheme")
		x.el("cbc:ID", "VAT")
		x.close("cac:TaxScheme")
		x.close("cac:ClassifiedTaxCategory")
		x.close("cac:Item")
		x.open("cac:Price")
		unit := o.net
		if o.line.Quantity > 0 {
			x.elAttr("cbc:PriceAmount", "currencyID", d.Currency.Code, priceString(o.net, o.line.Quantity, dec))
		} else {
			x.elAttr("cbc:PriceAmount", "currencyID", d.Currency.Code, amt(unit))
		}
		x.close("cac:Price")
		x.close("cac:InvoiceLine")
	}
	x.close("Invoice")
	return x.buf.Bytes(), nil
}

func max64(a, b int64) int64 {
	if a > b {
		return a
	}
	return b
}

// priceString is the net unit price: line net divided by quantity, shown to the currency's decimals
// (at least two more when needed so that quantity × price reproduces the line amount).
func priceString(net int64, qty float64, dec int) string {
	p := float64(net) / qty / math.Pow10(dec)
	return strings.TrimRight(strings.TrimRight(fmt.Sprintf("%.*f", dec+4, p), "0"), ".")
}

func trimFloat(f float64) string {
	return strings.TrimRight(strings.TrimRight(fmt.Sprintf("%.4f", f), "0"), ".")
}

var unitCodes = map[string]string{
	"hour": "HUR", "hours": "HUR", "h": "HUR", "hr": "HUR", "day": "DAY", "days": "DAY", "week": "WEE", "month": "MON",
	"year": "ANN", "kg": "KGM", "g": "GRM", "m": "MTR", "km": "KMT", "l": "LTR", "litre": "LTR", "liter": "LTR",
	"m2": "MTK", "m3": "MTQ", "box": "BX", "pack": "PK", "set": "SET", "pair": "PR",
}

func unitCode(unit string) string {
	if c, ok := unitCodes[strings.ToLower(strings.TrimSpace(unit))]; ok {
		return c
	}
	return "C62" // one (piece)
}

// ---- validation ------------------------------------------------------------

func check(d model.Document, profile string) Problems {
	var p Problems
	add := func(f string, a ...any) { p = append(p, fmt.Sprintf(f, a...)) }
	if d.Kind != model.KindInvoice {
		add("only invoices can be exported as e-invoices")
		return p
	}
	if d.TaxMode == "withheld" {
		add("tax withheld at source cannot be expressed in an e-invoice")
	}
	if d.Issuer.EAddress == "" || d.Issuer.EScheme == "" {
		add("add an e-invoice address (scheme and ID) to the issuer")
	}
	if d.Customer.EAddress == "" || d.Customer.EScheme == "" {
		add("add an e-invoice address (scheme and ID) to the customer")
	}
	if len(d.Issuer.Country) != 2 {
		add("add a country code to the issuer")
	}
	if len(d.Customer.Country) != 2 {
		add("add a country code to the customer")
	}
	if d.Issuer.TaxID == "" {
		add("add a tax ID to the issuer")
	}
	if profile == XRechnung {
		if d.Customer.BuyerReference == "" {
			add("add a buyer reference to the customer")
		}
		if d.DueOn == "" && strings.TrimSpace(d.NoteTerms) == "" {
			add("set a due date or payment terms")
		}
		if d.Issuer.Email == "" {
			add("add an email address to the issuer")
		}
		if d.Issuer.Phone == "" {
			add("add a phone number to the issuer")
		}
		if strings.TrimSpace(d.Customer.Address) == "" {
			add("add an address to the customer")
		}
	}
	return p
}

// ---- xml helpers -----------------------------------------------------------

type xmlWriter struct {
	buf   bytes.Buffer
	depth int
}

func (x *xmlWriter) raw(s string) { x.buf.WriteString(s) }

func (x *xmlWriter) indent() { x.buf.WriteString(strings.Repeat("  ", x.depth)) }

func (x *xmlWriter) open(tag string) {
	x.indent()
	x.buf.WriteString("<" + tag + ">\n")
	x.depth++
}

func (x *xmlWriter) close(tag string) {
	x.depth--
	x.indent()
	x.buf.WriteString("</" + tag + ">\n")
}

func esc(s string) string {
	var b bytes.Buffer
	_ = xml.EscapeText(&b, []byte(s))
	return b.String()
}

func (x *xmlWriter) el(tag, text string) {
	x.indent()
	fmt.Fprintf(&x.buf, "<%s>%s</%s>\n", tag, esc(text), tag)
}

func (x *xmlWriter) elAttr(tag, attr, val, text string) {
	x.indent()
	fmt.Fprintf(&x.buf, "<%s %s=\"%s\">%s</%s>\n", tag, attr, esc(val), esc(text), tag)
}

func (x *xmlWriter) taxCategory(cat string, rate float64, exempt bool) {
	x.open("cac:TaxCategory")
	x.el("cbc:ID", cat)
	x.el("cbc:Percent", trimFloat(rate))
	if cat == "E" {
		x.el("cbc:TaxExemptionReason", "Tax exempt")
	}
	x.open("cac:TaxScheme")
	x.el("cbc:ID", "VAT")
	x.close("cac:TaxScheme")
	x.close("cac:TaxCategory")
}

// address splits a free-text address: first line is the street, the last line
// is "postcode city" when it starts with something containing a digit.
func address(a string) (street, city, postal string) {
	var lines []string
	for _, l := range strings.Split(a, "\n") {
		if l = strings.TrimSpace(l); l != "" {
			lines = append(lines, l)
		}
	}
	switch len(lines) {
	case 0:
		return "", "", ""
	case 1:
		return lines[0], "", ""
	}
	street = lines[0]
	last := lines[len(lines)-1]
	if f := strings.Fields(last); len(f) > 1 && strings.ContainsAny(f[0], "0123456789") {
		return street, strings.Join(f[1:], " "), f[0]
	}
	return street, last, ""
}

func (x *xmlWriter) party(wrapper string, p model.Party, supplier bool) {
	x.open(wrapper)
	x.open("cac:Party")
	x.elAttr("cbc:EndpointID", "schemeID", p.EScheme, p.EAddress)
	x.open("cac:PartyName")
	x.el("cbc:Name", p.Name)
	x.close("cac:PartyName")
	street, city, postal := address(p.Address)
	x.open("cac:PostalAddress")
	if street != "" {
		x.el("cbc:StreetName", street)
	}
	if city != "" {
		x.el("cbc:CityName", city)
	}
	if postal != "" {
		x.el("cbc:PostalZone", postal)
	}
	x.open("cac:Country")
	x.el("cbc:IdentificationCode", p.Country)
	x.close("cac:Country")
	x.close("cac:PostalAddress")
	if p.TaxID != "" {
		x.open("cac:PartyTaxScheme")
		x.el("cbc:CompanyID", p.TaxID)
		x.open("cac:TaxScheme")
		x.el("cbc:ID", "VAT")
		x.close("cac:TaxScheme")
		x.close("cac:PartyTaxScheme")
	}
	x.open("cac:PartyLegalEntity")
	x.el("cbc:RegistrationName", p.Name)
	x.close("cac:PartyLegalEntity")
	if supplier && (p.Email != "" || p.Phone != "") {
		x.open("cac:Contact")
		x.el("cbc:Name", p.Name)
		if p.Phone != "" {
			x.el("cbc:Telephone", p.Phone)
		}
		if p.Email != "" {
			x.el("cbc:ElectronicMail", p.Email)
		}
		x.close("cac:Contact")
	}
	x.close("cac:Party")
	x.close(wrapper)
}
