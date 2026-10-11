package einvoice

import (
	"errors"
	"math"
	"sort"
	"strconv"
	"strings"

	"github.com/Raktim94/nodedr-invoice/rewrite/internal/jsnum"
)

// Profiles the generator knows.
const (
	UBL21     = "ubl21"
	XRechnung = "xrechnung"
)

func amountTag(name string, n float64, currency string) string {
	return "<cbc:" + name + ` currencyID="` + xmlEscape(currency) + `">` + jsnum.ToFixed(n, 2) + "</cbc:" + name + ">"
}

func decimals2(n float64) string { return jsnum.ToFixed(jsnum.Round(n*100)/100, 2) }
func decimals4(n float64) string { return jsnum.ToFixed(jsnum.Round(n*10000)/10000, 4) }

func cond(ok bool, s string) string {
	if ok {
		return s
	}
	return ""
}

func taxName(inv Row) string {
	if jsnum.Truthy(inv["taxName"]) {
		return strOf(inv["taxName"])
	}
	return "VAT"
}

type rateAmount struct{ rate, amount float64 }

// groupByRate sums amounts per tax rate, keeping first-seen order.
func groupByRate(inv Row) ([]rateAmount, error) {
	var totalGross float64
	for _, it := range items(inv) {
		a, err := itemAmount(it)
		if err != nil {
			return nil, err
		}
		totalGross += a
	}
	var groups []rateAmount
	for _, it := range items(inv) {
		rate := itemRate(it, inv)
		lineGross, _ := itemAmount(it)
		disc := 0.0
		if totalGross != 0 && !math.IsNaN(totalGross) {
			disc = jsnum.Round((lineGross / totalGross) * discount(totalGross, inv))
		}
		net := lineGross - disc
		found := false
		for i := range groups {
			if groups[i].rate == rate {
				groups[i].amount += net
				found = true
				break
			}
		}
		if !found {
			groups = append(groups, rateAmount{rate, net})
		}
	}
	return groups, nil
}

func subunit(inv Row) float64 {
	return jsnum.Num(child(inv, "invoiceCurrencySnapshot")["currencySubunit"])
}
func currencyCode(inv Row) string {
	return xmlEscape(child(inv, "invoiceCurrencySnapshot")["currencyCode"])
}

func allocateDiscount(inv Row, discountCents float64) ([]rateAmount, error) {
	if !(discountCents != 0 && !math.IsNaN(discountCents)) {
		return nil, nil
	}
	groups, err := groupByRate(inv)
	if err != nil {
		return nil, err
	}
	unit := subunit(inv)
	if len(groups) <= 1 {
		rate := num(inv, "taxRate")
		if len(groups) == 1 {
			rate = groups[0].rate
		}
		return []rateAmount{{rate, discountCents / unit}}, nil
	}
	var totalTaxable float64
	for _, g := range groups {
		totalTaxable += g.amount
	}
	out := make([]rateAmount, len(groups))
	for i, g := range groups {
		if i == len(groups)-1 {
			var allocated float64
			for _, prev := range groups[:i] {
				allocated += (discountCents * prev.amount) / totalTaxable
			}
			out[i] = rateAmount{g.rate, (discountCents - allocated) / unit}
			continue
		}
		out[i] = rateAmount{g.rate, discountCents * g.amount / totalTaxable / unit}
	}
	return out, nil
}

func discountXML(inv Row, discountCents float64) (string, error) {
	allocs, err := allocateDiscount(inv, discountCents)
	if err != nil || len(allocs) == 0 {
		return "", err
	}
	sort.SliceStable(allocs, func(i, j int) bool { return allocs[i].rate < allocs[j].rate })
	running := 0.0
	rounded := make([]rateAmount, len(allocs))
	for i, d := range allocs {
		if i == len(allocs)-1 {
			rounded[i] = d
			continue
		}
		amt := jsnum.Round(d.amount*100) / 100
		running += amt
		rounded[i] = rateAmount{d.rate, amt}
	}
	target := jsnum.Round(discountCents) / 100
	remainder, _ := strconv.ParseFloat(jsnum.ToFixed(target-running, 2), 64)
	rounded[len(rounded)-1].amount = remainder
	var b strings.Builder
	for _, d := range rounded {
		if !(d.amount > 0) {
			continue
		}
		id := "Z"
		if d.rate > 0 {
			id = "S"
		}
		b.WriteString(`
      <cac:AllowanceCharge>
        <cbc:ChargeIndicator>false</cbc:ChargeIndicator>
        <cbc:AllowanceChargeReason>Discount</cbc:AllowanceChargeReason>
        <cbc:Amount currencyID="` + currencyCode(inv) + `">` + decimals2(d.amount) + `</cbc:Amount>
        <cac:TaxCategory>
          <cbc:ID>` + id + `</cbc:ID> 
          <cbc:Percent>` + decimals2(d.rate) + `</cbc:Percent>
          <cac:TaxScheme>
            <cbc:ID>` + xmlEscape(taxName(inv)) + `</cbc:ID>
          </cac:TaxScheme>
        </cac:TaxCategory>
      </cac:AllowanceCharge>
    `)
	}
	return b.String(), nil
}

func allowances(inv Row, c *calc) (string, error) {
	unit := subunit(inv)
	shipping := jsnum.Num(inv["shippingFeeCents"]) / unit
	sur := c.surchargeTotal / unit
	disc, err := discountXML(inv, c.discountTotal)
	if err != nil {
		return "", err
	}
	charge := func(reason string, amount float64) string {
		return `
          <cac:AllowanceCharge>
            <cbc:ChargeIndicator>true</cbc:ChargeIndicator>
            <cbc:AllowanceChargeReason>` + reason + `</cbc:AllowanceChargeReason>
            <cbc:Amount currencyID="` + currencyCode(inv) + `">` + jsnum.Format(amount) + `</cbc:Amount>
            <cac:TaxCategory>
              <cbc:ID>Z</cbc:ID>
              <cbc:Percent>0.00</cbc:Percent>
              <cac:TaxScheme><cbc:ID>` + xmlEscape(taxName(inv)) + `</cbc:ID></cac:TaxScheme>
            </cac:TaxCategory>
          </cac:AllowanceCharge>`
	}
	surName := "Surcharge"
	if jsnum.Truthy(inv["surchargeName"]) {
		surName = strOf(inv["surchargeName"])
	}
	return "\n    " + disc + "\n    " + cond(c.surchargeTotal > 0, charge(xmlEscape(surName), sur)) +
		"\n    " + cond(c.shippingTotal > 0, charge("Shipping fee", shipping)) + "\n  ", nil
}

func header(inv Row, profile string) string {
	var notes []string
	for _, k := range []string{"thanksNotes", "customerNotes", "termsConditionNotes"} {
		if jsnum.Truthy(inv[k]) {
			notes = append(notes, strOf(inv[k]))
		}
	}
	noteText := strings.Join(notes, " | ")
	issue := formatDate(strOf(inv["issuedAt"]))
	due := "undefined"
	if jsnum.Truthy(inv["dueDate"]) {
		due = formatDate(strOf(inv["dueDate"]))
	}
	customization := "urn:cen.eu:en16931:2017#compliant#urn:fdc:peppol.eu:2017:poacc:billing:3.0"
	if profile == XRechnung {
		customization = "urn:cen.eu:en16931:2017#compliant#urn:xeinkauf.de:kosit:xrechnung_3.0"
	}
	buyerRef := "undefined"
	if v, ok := child(inv, "invoiceClientSnapshot")["clientBuyerReference"]; ok {
		buyerRef = strOf(v)
		if v == nil {
			buyerRef = "null"
		}
	}
	return `
    <cbc:CustomizationID>` + customization + `</cbc:CustomizationID>
    <cbc:ProfileID>urn:fdc:peppol.eu:2017:poacc:billing:01:1.0</cbc:ProfileID>
    <cbc:ID>` + xmlEscape(inv["invoiceNumber"]) + `</cbc:ID>
    <cbc:IssueDate>` + issue + `</cbc:IssueDate>
    <cbc:DueDate>` + due + `</cbc:DueDate>
    <cbc:InvoiceTypeCode>380</cbc:InvoiceTypeCode>
    ` + cond(noteText != "", "<cbc:Note>"+xmlEscape(noteText)+"</cbc:Note>") + `
    <cbc:DocumentCurrencyCode>` + currencyCode(inv) + `</cbc:DocumentCurrencyCode>
    <cbc:BuyerReference>` + buyerRef + `</cbc:BuyerReference>
  `
}

func has(r Row, k string) bool { return jsnum.Truthy(r[k]) }

func endpoint(r Row, idKey, schemeKey string) string {
	if !has(r, idKey) {
		return ""
	}
	scheme := ""
	if has(r, schemeKey) {
		scheme = ` schemeID="` + xmlEscape(r[schemeKey]) + `"`
	}
	return "<cbc:EndpointID" + scheme + ">" + xmlEscape(r[idKey]) + "</cbc:EndpointID>"
}

func postal(a address) string {
	return cond(a.street != "", "<cbc:StreetName>"+xmlEscape(a.street)+"</cbc:StreetName>") +
		"\n        " + cond(a.city != "", "<cbc:CityName>"+xmlEscape(a.city)+"</cbc:CityName>") +
		"\n        " + cond(a.postalZone != "", "<cbc:PostalZone>"+xmlEscape(a.postalZone)+"</cbc:PostalZone>") +
		"\n        <cac:Country><cbc:IdentificationCode>" + xmlEscape(a.countryCode) + "</cbc:IdentificationCode></cac:Country>"
}

func supplier(inv Row, profile string) string {
	b := child(inv, "invoiceBusinessSnapshot")
	addr := splitAddress(strOf(b["businessAddress"]))
	if addr.countryCode == "" && has(b, "businessCountryCode") {
		addr.countryCode = strings.ToUpper(strOf(b["businessCountryCode"]))
	}
	taxID := ""
	if has(b, "businessVatCode") {
		taxID = strOf(b["businessVatCode"])
	} else if has(b, "businessCode") {
		taxID = strOf(b["businessCode"])
	}
	tax := ""
	if has(b, "businessVatCode") || has(b, "businessCode") {
		tax = "<cac:PartyTaxScheme><cbc:CompanyID>" + xmlEscape(taxID) + "</cbc:CompanyID><cac:TaxScheme><cbc:ID>" + taxName(inv) + "</cbc:ID></cac:TaxScheme></cac:PartyTaxScheme>"
	}
	contact := ""
	if has(b, "businessPhone") || has(b, "businessEmail") {
		contact = `
      <cac:Contact>
        ` + cond(has(b, "businessName") && profile == XRechnung, "<cbc:Name>"+xmlEscape(b["businessName"])+"</cbc:Name>") + `
        ` + cond(has(b, "businessPhone"), "<cbc:Telephone>"+xmlEscape(b["businessPhone"])+"</cbc:Telephone>") + `
        ` + cond(has(b, "businessEmail"), "<cbc:ElectronicMail>"+xmlEscape(b["businessEmail"])+"</cbc:ElectronicMail>") + `
      </cac:Contact>`
	}
	return `
  <cac:AccountingSupplierParty>
    <cac:Party>
      ` + endpoint(b, "businessPeppolEndpointId", "businessPeppolEndpointSchemeId") + `
      <cac:PartyName><cbc:Name>` + xmlEscape(b["businessName"]) + `</cbc:Name></cac:PartyName>
      <cac:PostalAddress>
        ` + postal(addr) + `
      </cac:PostalAddress>
      ` + tax + `
      <cac:PartyLegalEntity>
        <cbc:RegistrationName>` + xmlEscape(b["businessName"]) + `</cbc:RegistrationName>
        ` + cond(has(b, "businessVatCode"), "<cbc:CompanyID>"+xmlEscape(b["businessVatCode"])+"</cbc:CompanyID>") + `
      </cac:PartyLegalEntity>
      ` + contact + `
    </cac:Party>
  </cac:AccountingSupplierParty>`
}

func buyer(inv Row) string {
	c := child(inv, "invoiceClientSnapshot")
	addr := splitAddress(strOf(c["clientAddress"]))
	if addr.countryCode == "" && has(c, "clientCountryCode") {
		addr.countryCode = strings.ToUpper(strOf(c["clientCountryCode"]))
	}
	tax := ""
	if has(c, "clientVatCode") {
		tax = "<cac:PartyTaxScheme><cbc:CompanyID>" + xmlEscape(c["clientVatCode"]) + "</cbc:CompanyID><cac:TaxScheme><cbc:ID>" + taxName(inv) + "</cbc:ID></cac:TaxScheme></cac:PartyTaxScheme>"
	}
	contact := ""
	if has(c, "clientPhone") || has(c, "clientEmail") {
		contact = `
      <cac:Contact>
        ` + cond(has(c, "clientPhone"), "<cbc:Telephone>"+xmlEscape(c["clientPhone"])+"</cbc:Telephone>") + `
        ` + cond(has(c, "clientEmail"), "<cbc:ElectronicMail>"+xmlEscape(c["clientEmail"])+"</cbc:ElectronicMail>") + `
      </cac:Contact>`
	}
	return `
  <cac:AccountingCustomerParty>
    <cac:Party>
      ` + endpoint(c, "clientPeppolEndpointId", "clientPeppolEndpointSchemeId") + `
      <cac:PartyName><cbc:Name>` + xmlEscape(c["clientName"]) + `</cbc:Name></cac:PartyName>
      <cac:PostalAddress>
        ` + postal(addr) + `
      </cac:PostalAddress>
      ` + tax + `
      <cac:PartyLegalEntity>
        <cbc:RegistrationName>` + xmlEscape(c["clientName"]) + `</cbc:RegistrationName>
        ` + cond(has(c, "clientVatCode"), "<cbc:CompanyID>"+xmlEscape(c["clientVatCode"])+"</cbc:CompanyID>") + `
      </cac:PartyLegalEntity>
      ` + contact + `
    </cac:Party>
  </cac:AccountingCustomerParty>`
}

func delivery(inv Row) string {
	return `
    <cac:Delivery>
      <cbc:ActualDeliveryDate>` + formatDate(strOf(inv["issuedAt"])) + `</cbc:ActualDeliveryDate>
    </cac:Delivery>
  `
}

func paymentMeans(inv Row) string {
	b := child(inv, "invoiceBankSnapshot")
	if b == nil {
		return ""
	}
	branch := ""
	if has(b, "swiftCode") || has(b, "bankName") {
		branch = `
      <cac:FinancialInstitutionBranch>
        ` + cond(has(b, "swiftCode"), "<cbc:ID>"+xmlEscape(b["swiftCode"])+"</cbc:ID>") + `
      </cac:FinancialInstitutionBranch>`
	}
	return `
  <cac:PaymentMeans>
    <cbc:PaymentMeansCode>30</cbc:PaymentMeansCode>
    <cac:PayeeFinancialAccount>
      ` + cond(has(b, "accountNumber"), "<cbc:ID>"+xmlEscape(b["accountNumber"])+"</cbc:ID>") + `
      ` + cond(has(b, "accountHolder"), "<cbc:Name>"+xmlEscape(b["accountHolder"])+"</cbc:Name>") + `
      ` + branch + `
    </cac:PayeeFinancialAccount>
  </cac:PaymentMeans>`
}

func shippingTaxTotal(inv Row, c *calc, zeroTaxItemAmount float64) string {
	shippingCents := jsnum.Num(inv["shippingFeeCents"])
	if shippingCents <= 0 && zeroTaxItemAmount <= 0 && c.surchargeTotal <= 0 {
		return ""
	}
	unit := subunit(inv)
	shipping, sur, zero := shippingCents/unit, c.surchargeTotal/unit, zeroTaxItemAmount/unit
	return `
    <cac:TaxSubtotal>
      <cbc:TaxableAmount currencyID="` + currencyCode(inv) + `">` + decimals2(shipping+zero+sur) + `</cbc:TaxableAmount>
      <cbc:TaxAmount currencyID="` + currencyCode(inv) + `">0.00</cbc:TaxAmount>
      <cac:TaxCategory>
        <cbc:ID>Z</cbc:ID>
        <cbc:Percent>0.00</cbc:Percent>
        <cac:TaxScheme>
          <cbc:ID>` + xmlEscape(taxName(inv)) + `</cbc:ID>
        </cac:TaxScheme>
      </cac:TaxCategory>
    </cac:TaxSubtotal>
  `
}

func taxTotal(inv Row, c *calc) string {
	unit := subunit(inv)
	totalTax := c.taxTotal / unit
	var positive []vatGroup
	zeroTaxable := 0.0
	zeroFound := false
	for _, g := range c.vatGroups {
		if g.rate > 0 {
			positive = append(positive, g)
		}
		if !zeroFound && g.rate == 0 {
			zeroFound, zeroTaxable = true, g.taxable
		}
	}
	shipping := shippingTaxTotal(inv, c, zeroTaxable)
	running := 0.0
	var groups strings.Builder
	for idx, g := range positive {
		taxable := g.taxable / unit
		var tax float64
		if idx == len(positive)-1 {
			tax = totalTax - running
		} else {
			tax = (taxable * g.rate) / 100
			tax = jsnum.Round(tax*100) / 100
			running += tax
		}
		final := tax
		if c.taxTotal < 0 {
			final = -tax
		}
		groups.WriteString(`
      <cac:TaxSubtotal>
        <cbc:TaxableAmount currencyID="` + currencyCode(inv) + `">` + decimals2(taxable) + `</cbc:TaxableAmount>
        <cbc:TaxAmount currencyID="` + currencyCode(inv) + `">` + decimals2(final) + `</cbc:TaxAmount>
        <cac:TaxCategory>
          <cbc:ID>S</cbc:ID> 
          <cbc:Percent>` + decimals2(g.rate) + `</cbc:Percent>
          <cac:TaxScheme>
            <cbc:ID>` + xmlEscape(taxName(inv)) + `</cbc:ID>
          </cac:TaxScheme>
        </cac:TaxCategory>
      </cac:TaxSubtotal>
      `)
	}
	return `
    <cac:TaxTotal>
      <cbc:TaxAmount currencyID="` + currencyCode(inv) + `">` + decimals2(totalTax) + `</cbc:TaxAmount>
      ` + groups.String() + `
      ` + shipping + `
    </cac:TaxTotal>
  `
}

func legalTotal(inv Row, c *calc) string {
	code := strOf(child(inv, "invoiceCurrencySnapshot")["currencyCode"])
	unit := subunit(inv)
	toUnit := func(cents float64) float64 { return cents / unit }
	paid := totalPaid(inv)
	return `
    <cac:LegalMonetaryTotal>
      ` + amountTag("LineExtensionAmount", toUnit(c.subtotalNet+c.discountTotal), code) + `
      ` + amountTag("TaxExclusiveAmount", toUnit(c.subtotalNet+c.shippingTotal+c.surchargeTotal), code) + `
      ` + amountTag("TaxInclusiveAmount", toUnit(c.subtotalNet+c.shippingTotal+c.surchargeTotal+c.taxTotal), code) + `
      ` + cond(c.discountTotal > 0, amountTag("AllowanceTotalAmount", toUnit(c.discountTotal), code)) + `
      ` + cond(c.shippingTotal > 0 || c.surchargeTotal > 0, amountTag("ChargeTotalAmount", toUnit(c.shippingTotal+c.surchargeTotal), code)) + `
      ` + cond(paid > 0, amountTag("PrepaidAmount", toUnit(paid), code)) + `
      ` + amountTag("PayableAmount", toUnit(c.payableTotal-paid), code) + `
    </cac:LegalMonetaryTotal>
  `
}

var errNoLines = errors.New("invoice without lines")

func lines(inv Row, c *calc) (string, error) {
	if len(c.lines) == 0 {
		return "", errNoLines
	}
	unit := subunit(inv)
	type outLine struct {
		line
		quantity, amount, price float64
	}
	out := make([]outLine, len(c.lines))
	for i, l := range c.lines {
		q := jsnum.Num(items(inv)[i]["quantity"])
		amount, _ := strconv.ParseFloat(decimals2((l.lineAmount+l.discountAmount)/unit), 64)
		out[i] = outLine{l, q, amount, amount / q}
	}
	var sum float64
	for _, l := range out {
		sum += l.amount
	}
	net := (c.subtotalNet + c.discountTotal) / unit
	netFixed, _ := strconv.ParseFloat(decimals2(net), 64)
	last := &out[len(out)-1]
	last.amount += netFixed - sum
	last.price = last.amount / last.quantity

	var b strings.Builder
	for i, l := range out {
		snap := child(items(inv)[i], "invoiceItemSnapshot")
		b.WriteString(`
        <cac:InvoiceLine>
          <cbc:ID>` + strconv.Itoa(i+1) + `</cbc:ID>
          <cbc:InvoicedQuantity unitCode="EA">` + decimals2(jsnum.Num(items(inv)[i]["quantity"])) + `</cbc:InvoicedQuantity>
          <cbc:LineExtensionAmount currencyID="` + currencyCode(inv) + `">` + decimals2(l.amount) + `</cbc:LineExtensionAmount>
          <cac:Item>
            <cbc:Name>` + xmlEscape(snap["itemName"]) + `</cbc:Name>
            <cac:ClassifiedTaxCategory>
              <cbc:ID>` + l.taxCategoryID + `</cbc:ID>
              <cbc:Percent>` + decimals2(l.taxRate) + `</cbc:Percent>
              <cac:TaxScheme><cbc:ID>` + xmlEscape(taxName(inv)) + `</cbc:ID></cac:TaxScheme>
            </cac:ClassifiedTaxCategory>
          </cac:Item>
          <cac:Price>
            <cbc:PriceAmount currencyID="` + currencyCode(inv) + `">` + decimals4(l.price) + `</cbc:PriceAmount>
          </cac:Price>
        </cac:InvoiceLine>
        `)
	}
	return b.String(), nil
}

// Error is a validation failure; Message is the translation key the app shows.
type Error struct{ Message string }

func (e *Error) Error() string { return e.Message }

func fail(key string) error { return &Error{key} }

func validate(inv Row, profile string) error {
	p := "peppol"
	if profile == XRechnung {
		p = "xrechnung"
	}
	cur, biz, cli := child(inv, "invoiceCurrencySnapshot"), child(inv, "invoiceBusinessSnapshot"), child(inv, "invoiceClientSnapshot")
	if cur == nil || biz == nil || cli == nil {
		return fail("error." + p + "NotSupported")
	}
	if !has(biz, "businessPeppolEndpointId") || !has(biz, "businessPeppolEndpointSchemeId") {
		return fail("error." + p + "BusinessSchema")
	}
	if !has(cli, "clientPeppolEndpointId") || !has(cli, "clientPeppolEndpointSchemeId") {
		return fail("error." + p + "ClientSchema")
	}
	if !has(cli, "clientBuyerReference") {
		return fail("error." + p + "ClientReference")
	}
	if !has(cli, "clientCountryCode") {
		return fail("error." + p + "ClientCC")
	}
	if !has(biz, "businessCountryCode") {
		return fail("error." + p + "BusinessCC")
	}
	if !has(inv, "dueDate") {
		return fail("error." + p + "DueDate")
	}
	if !has(biz, "businessCode") && !has(biz, "businessVatCode") {
		return fail("error." + p + "BusinessVATCode")
	}
	if profile == XRechnung {
		if !has(biz, "businessEmail") {
			return fail("error.xrechnungBusinessEmail")
		}
		if !has(biz, "businessPhone") {
			return fail("error.xrechnungBusinessPhone")
		}
		if !has(cli, "clientAddress") {
			return fail("error.xrechnungClientAddress")
		}
	}
	return nil
}

// Generate returns the e-invoice XML of inv for the profile ("ubl21" or "xrechnung").
func Generate(profile string, inv Row) (string, error) {
	if profile != UBL21 && profile != XRechnung {
		return "", errors.New("unknown e-invoice profile")
	}
	if err := validate(inv, profile); err != nil {
		return "", err
	}
	c, err := totals(inv)
	if err != nil {
		return "", err
	}
	allow, err := allowances(inv, c)
	if err != nil {
		return "", err
	}
	ls, err := lines(inv, c)
	if err != nil {
		return "", err
	}
	raw := `<?xml version="1.0" encoding="UTF-8"?>
      <Invoice xmlns="urn:oasis:names:specification:ubl:schema:xsd:Invoice-2"
        xmlns:cac="urn:oasis:names:specification:ubl:schema:xsd:CommonAggregateComponents-2"
        xmlns:cbc="urn:oasis:names:specification:ubl:schema:xsd:CommonBasicComponents-2">
        <cbc:UBLVersionID>2.1</cbc:UBLVersionID>
        ` + header(inv, profile) + `
        ` + supplier(inv, profile) + `
        ` + buyer(inv) + `
        ` + cond(profile == XRechnung, delivery(inv)) + `
        ` + paymentMeans(inv) + `
        ` + allow + `
        ` + taxTotal(inv, c) + `
        ` + legalTotal(inv, c) + `
        ` + ls + `
        </Invoice>`
	return formatXML(raw), nil
}
