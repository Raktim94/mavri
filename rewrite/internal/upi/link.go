// Package upi builds UPI payment links and tracks UPI payment state.
//
// Mavri is NOT a payment provider and has no direct NPCI access. A business
// enters its own merchant VPA or connects an onboarded acquirer/provider
// through the Provider interface. A QR scan or deep-link handoff only starts a
// payment; settlement is known only from a trusted provider lookup or an
// authenticated provider webhook (see Payment.ConfirmPaid).
package upi

import (
	"errors"
	"fmt"
	"net/url"
	"regexp"
	"strings"
	"unicode"
)

// Errors (translation keys).
var (
	ErrInvalidVPA    = errors.New("error.upi.invalidVPA")
	ErrInvalidAmount = errors.New("error.upi.invalidAmount")
	ErrInvalidRef    = errors.New("error.upi.invalidReference")
	ErrInvalidPayee  = errors.New("error.upi.invalidPayeeName")
)

// Syntax only: this can reject typos but can never say a VPA exists.
var (
	vpaRe = regexp.MustCompile(`^[a-zA-Z0-9][a-zA-Z0-9._-]{1,255}@[a-zA-Z][a-zA-Z0-9]{1,63}$`)
	refRe = regexp.MustCompile(`^[A-Za-z0-9][A-Za-z0-9._/-]{0,34}$`)
)

// Conservative field limits. They are assumptions to confirm against the
// current NPCI UPI linking specification before release.
const (
	maxPayeeRunes = 99
	maxNoteRunes  = 50
)

// ValidVPA reports whether s has the shape of a UPI address (handle@psp).
// It does NOT verify that the address exists or belongs to the business.
func ValidVPA(s string) bool { return vpaRe.MatchString(s) }

// Request describes one payment the customer will be asked to make.
type Request struct {
	PayeeVPA      string // the business's own VPA
	PayeeName     string
	AmountPaise   int64  // fixed amount, INR minor units (paise); must be > 0
	InvoiceNumber string // shown to the customer
	Ref           string // merchant reference (becomes the "tr" parameter)
	Note          string // optional transaction note
}

// Summary is what the UI must show before presenting a QR or link, so the
// payer can confirm who is being paid, how much, and for which invoice.
type Summary struct {
	PayeeName, PayeeVPA, InvoiceNumber, Amount string
}

func formatPaise(p int64) string { return fmt.Sprintf("%d.%02d", p/100, p%100) }

func clean(s string, max int) string {
	var b strings.Builder
	n := 0
	for _, r := range strings.TrimSpace(s) {
		if unicode.IsControl(r) {
			continue
		}
		if n++; n > max {
			break
		}
		b.WriteRune(r)
	}
	return b.String()
}

func validate(r Request) (Request, error) {
	if !ValidVPA(r.PayeeVPA) {
		return r, ErrInvalidVPA
	}
	if r.AmountPaise <= 0 || r.AmountPaise > 99_99_99_99_999 {
		return r, ErrInvalidAmount
	}
	if !refRe.MatchString(r.Ref) {
		return r, ErrInvalidRef
	}
	r.PayeeName = clean(r.PayeeName, maxPayeeRunes)
	if r.PayeeName == "" {
		return r, ErrInvalidPayee
	}
	r.Note = clean(r.Note, maxNoteRunes)
	return r, nil
}

// Describe returns the confirmation summary for a request.
func Describe(r Request) (Summary, error) {
	r, err := validate(r)
	if err != nil {
		return Summary{}, err
	}
	return Summary{PayeeName: r.PayeeName, PayeeVPA: r.PayeeVPA, InvoiceNumber: r.InvoiceNumber, Amount: "INR " + formatPaise(r.AmountPaise)}, nil
}

func esc(s string) string { return strings.ReplaceAll(url.QueryEscape(s), "+", "%20") }

// IntentURL builds the upi://pay deep link (also the content of a dynamic QR)
// with a fixed amount, INR currency and the merchant reference. Render it as a
// QR in the UI; Mavri does not claim the QR is an IRP or provider QR.
func IntentURL(r Request) (string, error) {
	r, err := validate(r)
	if err != nil {
		return "", err
	}
	parts := []string{
		"pa=" + esc(r.PayeeVPA),
		"pn=" + esc(r.PayeeName),
		"am=" + formatPaise(r.AmountPaise),
		"cu=INR",
		"tr=" + esc(r.Ref),
	}
	if r.Note != "" {
		parts = append(parts, "tn="+esc(r.Note))
	}
	return "upi://pay?" + strings.Join(parts, "&"), nil
}

// StaticURL builds a reusable link with no amount, for a printed shop QR.
func StaticURL(vpa, name string) (string, error) {
	name = clean(name, maxPayeeRunes)
	if !ValidVPA(vpa) {
		return "", ErrInvalidVPA
	}
	if name == "" {
		return "", ErrInvalidPayee
	}
	return "upi://pay?pa=" + esc(vpa) + "&pn=" + esc(name) + "&cu=INR", nil
}
