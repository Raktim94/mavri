package upi

import (
	"context"
	"errors"
	"net/http"
	"time"
)

// Status of a UPI payment request.
type Status string

const (
	Pending           Status = "pending"
	Paid              Status = "paid" // verified by a trusted source
	Failed            Status = "failed"
	Expired           Status = "expired"
	PartiallyRefunded Status = "partially_refunded"
	Refunded          Status = "refunded"
)

// Source says where a piece of evidence came from. Only the first two are
// trusted to move money state.
type Source string

const (
	ProviderLookup  Source = "provider_lookup"  // status fetched from the provider/acquirer by us
	ProviderWebhook Source = "provider_webhook" // signature-verified webhook
	ClientRedirect  Source = "client_redirect"  // browser returned from a UPI app: never proof
	CustomerClaim   Source = "customer_claim"   // screenshot, UTR typed by customer: never proof
	System          Source = "system"           // internal timers such as expiry
)

func (s Source) trusted() bool { return s == ProviderLookup || s == ProviderWebhook }

// Errors (translation keys).
var (
	ErrUntrustedSource   = errors.New("error.upi.untrustedSource")
	ErrMismatch          = errors.New("error.upi.evidenceMismatch")
	ErrDuplicatePayment  = errors.New("error.upi.duplicatePayment")
	ErrInvalidTransition = errors.New("error.upi.invalidTransition")
	ErrInvalidRefund     = errors.New("error.upi.invalidRefund")
)

// Evidence is one claim about a payment. EventID must be unique per provider
// event so repeated deliveries are recognised.
type Evidence struct {
	Source        Source
	EventID       string
	ProviderTxnID string
	Ref           string
	Amount        int64 // paise
	Currency      string
	At            time.Time
	Reason        string
}

// AuditEntry records every accepted or rejected change, in order.
type AuditEntry struct {
	At       time.Time
	Event    string // "paid", "failed", "expired", "refund", "rejected", "duplicate_ignored", ...
	From, To Status
	Source   Source
	EventID  string
	Detail   string // translation key or short code; never customer banking data
}

// Payment is one requested UPI payment for an invoice.
type Payment struct {
	ID, InvoiceID  string
	Ref            string
	Amount         int64  // paise
	Currency       string // always "INR"
	Status         Status
	ExpiresAt      time.Time
	PaidTxnID      string
	RefundedAmount int64
	Audit          []AuditEntry

	seen map[string]bool // processed EventIDs (idempotency)
}

// NewPayment creates a pending payment.
func NewPayment(id, invoiceID, ref string, amountPaise int64, expiresAt time.Time) (*Payment, error) {
	if amountPaise <= 0 {
		return nil, ErrInvalidAmount
	}
	if !refRe.MatchString(ref) {
		return nil, ErrInvalidRef
	}
	return &Payment{ID: id, InvoiceID: invoiceID, Ref: ref, Amount: amountPaise, Currency: "INR",
		Status: Pending, ExpiresAt: expiresAt, seen: map[string]bool{}}, nil
}

func (p *Payment) log(at time.Time, event string, from, to Status, ev Evidence, detail string) {
	p.Audit = append(p.Audit, AuditEntry{At: at, Event: event, From: from, To: to, Source: ev.Source, EventID: ev.EventID, Detail: detail})
}

// duplicate reports whether this event was already processed.
func (p *Payment) duplicate(ev Evidence) bool {
	if p.seen == nil {
		p.seen = map[string]bool{}
	}
	if ev.EventID != "" && p.seen[ev.EventID] {
		return true
	}
	if ev.EventID != "" {
		p.seen[ev.EventID] = true
	}
	return false
}

// ConfirmPaid marks the payment paid when, and only when, trusted evidence
// matches reference, amount and currency exactly. It returns applied=false
// with no error for a re-delivered event (idempotent). Money confirmed by the
// provider after expiry is accepted, because it was really received.
func (p *Payment) ConfirmPaid(ev Evidence) (applied bool, err error) {
	if !ev.Source.trusted() {
		p.log(ev.At, "rejected", p.Status, p.Status, ev, "untrusted_source")
		return false, ErrUntrustedSource
	}
	if p.duplicate(ev) {
		p.log(ev.At, "duplicate_ignored", p.Status, p.Status, ev, "")
		return false, nil
	}
	if ev.Ref != p.Ref || ev.Amount != p.Amount || ev.Currency != p.Currency {
		p.log(ev.At, "rejected", p.Status, p.Status, ev, "mismatch")
		return false, ErrMismatch
	}
	switch p.Status {
	case Pending, Expired:
		reason := ""
		if p.Status == Expired {
			reason = "late_confirmation"
		}
		p.log(ev.At, "paid", p.Status, Paid, ev, reason)
		p.Status, p.PaidTxnID = Paid, ev.ProviderTxnID
		return true, nil
	case Paid, PartiallyRefunded, Refunded:
		if ev.ProviderTxnID == p.PaidTxnID {
			p.log(ev.At, "duplicate_ignored", p.Status, p.Status, ev, "same_transaction")
			return false, nil
		}
		// A second, different transaction for the same request: the customer
		// paid twice. Flag it for reconciliation/refund; never double-credit.
		p.log(ev.At, "rejected", p.Status, p.Status, ev, "duplicate_payment")
		return false, ErrDuplicatePayment
	}
	p.log(ev.At, "rejected", p.Status, p.Status, ev, "invalid_transition")
	return false, ErrInvalidTransition
}

// MarkFailed records a provider-reported failure of a pending payment.
func (p *Payment) MarkFailed(ev Evidence) error {
	if !ev.Source.trusted() {
		p.log(ev.At, "rejected", p.Status, p.Status, ev, "untrusted_source")
		return ErrUntrustedSource
	}
	if p.duplicate(ev) {
		return nil
	}
	if p.Status != Pending {
		p.log(ev.At, "rejected", p.Status, p.Status, ev, "invalid_transition")
		return ErrInvalidTransition
	}
	p.log(ev.At, "failed", Pending, Failed, ev, ev.Reason)
	p.Status = Failed
	return nil
}

// ExpireIfDue moves a pending payment past its expiry to Expired.
func (p *Payment) ExpireIfDue(now time.Time) bool {
	if p.Status != Pending || p.ExpiresAt.IsZero() || now.Before(p.ExpiresAt) {
		return false
	}
	p.log(now, "expired", Pending, Expired, Evidence{Source: System}, "")
	p.Status = Expired
	return true
}

// Refund records a provider-confirmed refund of part or all of a paid payment.
func (p *Payment) Refund(ev Evidence, amount int64) error {
	if !ev.Source.trusted() {
		p.log(ev.At, "rejected", p.Status, p.Status, ev, "untrusted_source")
		return ErrUntrustedSource
	}
	if p.duplicate(ev) {
		return nil
	}
	if p.Status != Paid && p.Status != PartiallyRefunded {
		p.log(ev.At, "rejected", p.Status, p.Status, ev, "invalid_transition")
		return ErrInvalidTransition
	}
	if amount <= 0 || p.RefundedAmount+amount > p.Amount {
		p.log(ev.At, "rejected", p.Status, p.Status, ev, "invalid_refund")
		return ErrInvalidRefund
	}
	from := p.Status
	p.RefundedAmount += amount
	p.Status = PartiallyRefunded
	if p.RefundedAmount == p.Amount {
		p.Status = Refunded
	}
	p.log(ev.At, "refund", from, p.Status, ev, "")
	return nil
}

// ProviderStatus is a provider's answer to a status lookup.
type ProviderStatus struct {
	Status        Status
	ProviderTxnID string
	Amount        int64
	Currency      string
	Ref           string
}

// Provider is the boundary to an onboarded acquirer or payment provider.
// Implementations must verify webhook signatures inside ParseWebhook and
// return an error for anything unauthentic. Mavri ships no implementation and
// makes no claim of direct NPCI access.
type Provider interface {
	Name() string
	LookupStatus(ctx context.Context, ref string) (ProviderStatus, error)
	ParseWebhook(h http.Header, rawBody []byte) (Evidence, error)
}
