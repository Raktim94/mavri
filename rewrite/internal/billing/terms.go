// Package billing holds invoicing business rules that need no database:
// payment terms, aging, late fees, payment allocation, credit notes, invoice
// lifecycle, numbering, recurring schedules, reminders, quotes and statements.
//
// Amounts are int64 minor units (paise, cents) and always travel with their
// currency code. Nothing here adds amounts in different currencies.
package billing

import (
	"errors"
	"time"

	"github.com/Raktim94/nodedr-invoice/rewrite/internal/money"
)

// Errors (translation keys).
var (
	ErrInvalidTerms     = errors.New("error.billing.invalidTerms")
	ErrInvalidAmount    = errors.New("error.billing.invalidAmount")
	ErrCurrencyMismatch = errors.New("error.billing.currencyMismatch")
)

// Day returns the calendar date of t (its own year, month and day) at
// midnight UTC, so date arithmetic never depends on a time zone or DST.
func Day(t time.Time) time.Time { return time.Date(t.Year(), t.Month(), t.Day(), 0, 0, 0, 0, time.UTC) }

// TermsKind says how a due date is derived.
type TermsKind string

const (
	DueOnReceipt   TermsKind = "due_on_receipt"
	NetDays        TermsKind = "net_days"          // issue date + Days
	EndOfMonthPlus TermsKind = "end_of_month_plus" // last day of issue month + Days
	FixedDate      TermsKind = "fixed_date"
)

// Terms are a payment term, for example "Net 30".
type Terms struct {
	Kind TermsKind
	Days int
	Date time.Time // FixedDate only
}

// DueDate returns the due date for an invoice issued on issue.
func (t Terms) DueDate(issue time.Time) (time.Time, error) {
	d := Day(issue)
	switch t.Kind {
	case DueOnReceipt:
		return d, nil
	case NetDays:
		if t.Days < 0 || t.Days > 3650 {
			return time.Time{}, ErrInvalidTerms
		}
		return d.AddDate(0, 0, t.Days), nil
	case EndOfMonthPlus:
		if t.Days < 0 || t.Days > 3650 {
			return time.Time{}, ErrInvalidTerms
		}
		eom := time.Date(d.Year(), d.Month()+1, 0, 0, 0, 0, 0, time.UTC)
		return eom.AddDate(0, 0, t.Days), nil
	case FixedDate:
		if t.Date.IsZero() || Day(t.Date).Before(d) {
			return time.Time{}, ErrInvalidTerms
		}
		return Day(t.Date), nil
	}
	return time.Time{}, ErrInvalidTerms
}

// EarlyDiscount is a prompt-payment discount such as "2/10 net 30".
type EarlyDiscount struct {
	Percent    *money.Rat
	WithinDays int
}

// For returns the discount (minor units, rounded half up) earned by paying
// amount on paid, for an invoice issued on issue. It is zero when too late.
func (e EarlyDiscount) For(issue, paid time.Time, amount int64) int64 {
	if e.Percent == nil || e.WithinDays <= 0 || amount <= 0 {
		return 0
	}
	if Day(paid).After(Day(issue).AddDate(0, 0, e.WithinDays)) {
		return 0
	}
	v := new(money.Rat).Mul(new(money.Rat).SetInt64(amount), e.Percent)
	v.Quo(v, money.MustDecimal("100"))
	return money.Round(v).Int64()
}
