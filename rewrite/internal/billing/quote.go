package billing

import (
	"errors"
	"time"
)

// QuoteStatus of a quotation.
type QuoteStatus string

const (
	QuoteDraft     QuoteStatus = "draft"
	QuoteSent      QuoteStatus = "sent"
	QuoteAccepted  QuoteStatus = "accepted"
	QuoteDeclined  QuoteStatus = "declined"
	QuoteExpired   QuoteStatus = "expired"
	QuoteConverted QuoteStatus = "converted"
)

// ErrQuoteTransition is returned for a change the quote's state does not allow.
var ErrQuoteTransition = errors.New("error.billing.invalidQuoteTransition")

// Quote tracks a quotation's lifecycle and revisions.
type Quote struct {
	Status             QuoteStatus
	ValidUntil         time.Time // last day the customer may accept
	Version            int
	ConvertedInvoiceID string
}

// EffectiveStatus shows "expired" for a sent quote past its validity.
func (q Quote) EffectiveStatus(now time.Time) QuoteStatus {
	if q.Status == QuoteSent && !q.ValidUntil.IsZero() && Day(now).After(Day(q.ValidUntil)) {
		return QuoteExpired
	}
	return q.Status
}

// Send marks a draft as sent to the customer.
func (q *Quote) Send() error {
	if q.Status != QuoteDraft {
		return ErrQuoteTransition
	}
	q.Status = QuoteSent
	return nil
}

// Accept records the customer's acceptance; it must come within validity.
func (q *Quote) Accept(now time.Time) error {
	if q.EffectiveStatus(now) != QuoteSent {
		return ErrQuoteTransition
	}
	q.Status = QuoteAccepted
	return nil
}

// Decline records a rejection of a sent quote.
func (q *Quote) Decline(now time.Time) error {
	if q.EffectiveStatus(now) != QuoteSent {
		return ErrQuoteTransition
	}
	q.Status = QuoteDeclined
	return nil
}

// Revise starts a new version as a draft. Accepted or converted quotes are
// commitments and cannot be revised; make a new quote instead.
func (q *Quote) Revise() error {
	switch q.Status {
	case QuoteDraft, QuoteSent, QuoteDeclined, QuoteExpired:
		q.Version++
		q.Status = QuoteDraft
		return nil
	}
	return ErrQuoteTransition
}

// Convert links an accepted quote to the invoice created from it. A quote
// accepted in time stays convertible even after its validity date passes.
func (q *Quote) Convert(invoiceID string) error {
	if q.Status != QuoteAccepted || invoiceID == "" {
		return ErrQuoteTransition
	}
	q.Status, q.ConvertedInvoiceID = QuoteConverted, invoiceID
	return nil
}
