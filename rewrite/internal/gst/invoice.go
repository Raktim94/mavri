package gst

import (
	"fmt"
	"strings"
	"time"
)

// FinancialYear returns the Indian financial year (1 April to 31 March) that
// contains d, in the form "2026-27". Rule 46 numbers must be unique within it.
func FinancialYear(d time.Time) string {
	y := d.Year()
	if d.Month() < time.April {
		y--
	}
	end := (y + 1) % 100
	return fmt.Sprintf("%04d-%02d", y, end)
}

// ValidInvoiceNumber checks the Rule 46 serial-number shape: at most sixteen
// characters from letters, digits, hyphen and slash. Uniqueness within the
// financial year is enforced by the database, not here.
func ValidInvoiceNumber(s string) bool { return invNumRe.MatchString(s) }

// Rule46Doc is the data a tax invoice needs. Fields are what the document
// will print; checks decide what is missing, not what is legally required for
// every transaction (that depends on facts only the taxpayer knows).
type Rule46Doc struct {
	SupplierName, SupplierAddress, SupplierGSTIN string
	InvoiceNumber                                string
	IssueDate                                    time.Time
	RecipientName, RecipientAddress              string
	RecipientGSTIN                               string // required when the recipient is registered
	RecipientRegistered                          bool
	PlaceOfSupplyState                           string
	ReverseChargeIndicated                       bool // the document must say whether tax is payable on reverse charge
	ReverseChargeAnswered                        bool
	Lines                                        []Rule46Line
}

// Rule46Line is one supply line.
type Rule46Line struct {
	Description, Unit, HSNOrSAC string
	Quantity, TaxableValue      string
	TaxRatesShown               bool // rates and amounts of tax shown (not needed on a bill of supply)
}

// Problem is one missing or invalid field, with a translation key.
type Problem struct {
	Key   string // e.g. "gst.rule46.supplierGSTIN"
	Field string
}

// CheckRule46 lists missing or invalid mandatory fields for a tax invoice.
// It is a completeness aid, not a legal opinion.
func CheckRule46(d Rule46Doc) []Problem {
	var out []Problem
	add := func(key, field string) { out = append(out, Problem{Key: key, Field: field}) }
	blank := func(s string) bool { return strings.TrimSpace(s) == "" }

	if blank(d.SupplierName) {
		add("gst.rule46.supplierName", "supplierName")
	}
	if blank(d.SupplierAddress) {
		add("gst.rule46.supplierAddress", "supplierAddress")
	}
	if g := ParseGSTIN(d.SupplierGSTIN); !g.FormatOK || !g.StateKnown {
		add("gst.rule46.supplierGSTIN", "supplierGSTIN")
	}
	if !ValidInvoiceNumber(d.InvoiceNumber) {
		add("gst.rule46.invoiceNumber", "invoiceNumber")
	}
	if d.IssueDate.IsZero() {
		add("gst.rule46.issueDate", "issueDate")
	}
	if blank(d.RecipientName) {
		add("gst.rule46.recipientName", "recipientName")
	}
	if blank(d.RecipientAddress) {
		add("gst.rule46.recipientAddress", "recipientAddress")
	}
	if d.RecipientRegistered {
		if g := ParseGSTIN(d.RecipientGSTIN); !g.FormatOK || !g.StateKnown {
			add("gst.rule46.recipientGSTIN", "recipientGSTIN")
		}
	}
	if st, ok := LookupState(d.PlaceOfSupplyState); !ok || st.Status != StateCurrent {
		add("gst.rule46.placeOfSupply", "placeOfSupply")
	}
	if !d.ReverseChargeAnswered {
		add("gst.rule46.reverseCharge", "reverseCharge")
	}
	if len(d.Lines) == 0 {
		add("gst.rule46.lines", "lines")
	}
	for _, l := range d.Lines {
		if blank(l.Description) {
			add("gst.rule46.lineDescription", "lines.description")
		}
		if blank(l.HSNOrSAC) {
			add("gst.rule46.lineHSN", "lines.hsnOrSac")
		}
		if blank(l.Quantity) || blank(l.Unit) {
			add("gst.rule46.lineQuantityUnit", "lines.quantityUnit")
		}
		if blank(l.TaxableValue) {
			add("gst.rule46.lineTaxableValue", "lines.taxableValue")
		}
	}
	return out
}
