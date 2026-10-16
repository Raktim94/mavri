// Package paymentqr builds the payloads for payment QR codes and the plain
// text a client can fall back on. A payment QR only tells a banking app what to
// pay; scanning one never marks an invoice paid, and it is unrelated to the
// signed QR a tax authority may require on an invoice.
package paymentqr

import (
	"fmt"
	"net/url"
	"regexp"
	"strings"

	"github.com/Raktim94/mavri/server/internal/model"
)

// Option is one way for a client to pay.
type Option struct {
	// Kind is "upi", "sepa" or "bank".
	Kind  string `json:"kind"`
	Label string `json:"label"`
	// Payload is the exact text to encode in a QR code. Empty when the option has no code.
	Payload string `json:"payload,omitempty"`
	// Lines is the same information as plain text, for people who cannot scan.
	Lines []Line `json:"lines"`
	// Reference is what the client should quote so the payment can be matched.
	Reference string `json:"reference"`
	// AmountCents is the balance the code asks for.
	AmountCents int64 `json:"amountCents"`
	// Note explains what the code is and is not.
	Note string `json:"note"`
}

// Line is a labelled value.
type Line struct {
	Label string `json:"label"`
	Value string `json:"value"`
}

const scanNote = "Scanning only opens your banking app with these details filled in. The invoice is marked paid when the money arrives and is recorded."

// For lists the ways to pay a document's remaining balance. It returns nothing
// for quotes, paid invoices and invoices without payment details.
func For(d model.Document) []Option {
	if d.Kind != model.KindInvoice || d.Status == model.StatusVoid || d.Status == model.StatusPaid {
		return nil
	}
	due := d.Totals.TotalCents - d.PaidCents
	if due <= 0 {
		return nil
	}
	b := d.Bank
	if b.Label == "" && b.AccountNumber == "" && b.UPI == "" {
		return nil
	}
	ref := d.FullNumber
	var out []Option
	if strings.TrimSpace(b.UPI) != "" && strings.EqualFold(d.Currency.Code, "INR") {
		if p, err := UPI(b.UPI, firstNonEmpty(b.Holder, d.Issuer.Name), due, ref); err == nil {
			out = append(out, Option{Kind: "upi", Label: "Pay with UPI", Payload: p, Reference: ref, AmountCents: due,
				Lines: []Line{{"UPI ID", strings.TrimSpace(b.UPI)}, {"Amount", amount(due, 2) + " INR"}, {"Reference", ref}}, Note: scanNote})
		}
	}
	if IsIBAN(b.AccountNumber) && strings.EqualFold(d.Currency.Code, "EUR") {
		if p, err := EPC(firstNonEmpty(b.Holder, d.Issuer.Name), b.AccountNumber, b.Swift, due, ref); err == nil {
			out = append(out, Option{Kind: "sepa", Label: "Pay by SEPA transfer", Payload: p, Reference: ref, AmountCents: due,
				Lines: []Line{{"Beneficiary", firstNonEmpty(b.Holder, d.Issuer.Name)}, {"IBAN", compactIBAN(b.AccountNumber)}, {"BIC", b.Swift},
					{"Amount", amount(due, 2) + " EUR"}, {"Reference", ref}}, Note: scanNote})
		}
	}
	var lines []Line
	add := func(l, v string) {
		if strings.TrimSpace(v) != "" {
			lines = append(lines, Line{l, strings.TrimSpace(v)})
		}
	}
	add("Bank", b.BankName)
	add("Account holder", b.Holder)
	add("Account number / IBAN", b.AccountNumber)
	add("SWIFT / BIC", b.Swift)
	add("Routing", b.Routing)
	add("Branch", b.Branch)
	if len(lines) > 0 {
		lines = append(lines, Line{"Reference", ref})
		out = append(out, Option{Kind: "bank", Label: "Bank transfer", Reference: ref, AmountCents: due, Lines: lines,
			Note: "Quote the reference so the payment can be matched to this invoice."})
	}
	return out
}

func firstNonEmpty(v ...string) string {
	for _, s := range v {
		if strings.TrimSpace(s) != "" {
			return strings.TrimSpace(s)
		}
	}
	return ""
}

// amount formats minor units with a fixed number of decimals, no grouping.
func amount(cents int64, decimals int) string {
	scale := int64(1)
	for i := 0; i < decimals; i++ {
		scale *= 10
	}
	neg := ""
	if cents < 0 {
		neg, cents = "-", -cents
	}
	if decimals == 0 {
		return fmt.Sprintf("%s%d", neg, cents)
	}
	return fmt.Sprintf("%s%d.%0*d", neg, cents/scale, decimals, cents%scale)
}

var vpaRE = regexp.MustCompile(`^[A-Za-z0-9._-]{2,256}@[A-Za-z][A-Za-z0-9]{1,63}$`)

// UPI returns a UPI payment link (upi://pay) for the payee, an amount in paise
// and a note. The VPA must look like name@handle.
func UPI(vpa, payee string, paise int64, note string) (string, error) {
	vpa = strings.TrimSpace(vpa)
	if !vpaRE.MatchString(vpa) {
		return "", fmt.Errorf("%q is not a UPI ID like name@bank", vpa)
	}
	if paise <= 0 {
		return "", fmt.Errorf("the amount must be above zero")
	}
	q := url.Values{}
	q.Set("pa", vpa)
	q.Set("pn", truncate(strings.TrimSpace(payee), 99))
	q.Set("am", amount(paise, 2))
	q.Set("cu", "INR")
	if n := strings.TrimSpace(note); n != "" {
		q.Set("tn", truncate(n, 80))
	}
	// url.Values.Encode sorts by key and escapes spaces as +, which UPI apps read as spaces.
	return "upi://pay?" + strings.ReplaceAll(q.Encode(), "+", "%20"), nil
}

func truncate(s string, n int) string {
	r := []rune(s)
	if len(r) > n {
		return string(r[:n])
	}
	return s
}

func compactIBAN(s string) string {
	return strings.ToUpper(strings.ReplaceAll(strings.ReplaceAll(s, " ", ""), "-", ""))
}

// IsIBAN reports whether s is a structurally valid IBAN (length by country and mod 97 check).
func IsIBAN(s string) bool {
	s = compactIBAN(s)
	if len(s) < 15 || len(s) > 34 {
		return false
	}
	for i, r := range s {
		switch {
		case i < 2 && (r < 'A' || r > 'Z'):
			return false
		case i >= 2 && !(r >= 'A' && r <= 'Z' || r >= '0' && r <= '9'):
			return false
		}
	}
	if l, ok := ibanLen[s[:2]]; ok && l != len(s) {
		return false
	}
	rearranged := s[4:] + s[:4]
	rem := 0
	for _, r := range rearranged {
		var v int
		if r >= 'A' {
			v = int(r-'A') + 10
		} else {
			v = int(r - '0')
		}
		if v >= 10 {
			rem = (rem*100 + v) % 97
		} else {
			rem = (rem*10 + v) % 97
		}
	}
	return rem == 1
}

// ibanLen holds the fixed IBAN length of the SEPA countries Mavri checks.
var ibanLen = map[string]int{"AT": 20, "BE": 16, "BG": 22, "HR": 21, "CY": 28, "CZ": 24, "DK": 18, "EE": 20, "FI": 18, "FR": 27, "DE": 22,
	"GR": 27, "HU": 28, "IE": 22, "IT": 27, "LV": 21, "LT": 20, "LU": 20, "MT": 31, "NL": 18, "PL": 28, "PT": 25, "RO": 24, "SK": 24,
	"SI": 19, "ES": 24, "SE": 24, "GB": 22, "CH": 21, "NO": 15, "IS": 26, "LI": 21, "MC": 27, "SM": 27}

// EPC returns the EPC "SEPA credit transfer" QR payload (version 002, UTF-8)
// that European banking apps read. The BIC is optional for euro transfers
// inside the EEA. The reference goes in the unstructured remittance field.
func EPC(name, iban, bic string, cents int64, reference string) (string, error) {
	if !IsIBAN(iban) {
		return "", fmt.Errorf("the account number is not a valid IBAN")
	}
	if cents <= 0 || cents > 99999999999 {
		return "", fmt.Errorf("the amount must be between 0.01 and 999999999.99")
	}
	name = truncate(strings.TrimSpace(name), 70)
	if name == "" {
		return "", fmt.Errorf("the beneficiary name is required")
	}
	bic = strings.ToUpper(strings.ReplaceAll(strings.TrimSpace(bic), " ", ""))
	if bic != "" && len(bic) != 8 && len(bic) != 11 {
		bic = "" // not a BIC: leave it out rather than send a bad one
	}
	ref := truncate(strings.NewReplacer("\n", " ", "\r", " ").Replace(strings.TrimSpace(reference)), 140)
	lines := []string{"BCD", "002", "1", "SCT", bic, name, compactIBAN(iban), "EUR" + amount(cents, 2), "", "", ref, ""}
	return strings.Join(lines, "\n"), nil
}
