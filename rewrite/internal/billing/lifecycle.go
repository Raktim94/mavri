package billing

import (
	"errors"
	"time"

	"github.com/Raktim94/nodedr-invoice/rewrite/internal/gst"
)

// Status of an invoice. "Overdue" is derived (see DisplayStatus), not stored.
type Status string

const (
	Draft         Status = "draft"
	Issued        Status = "issued"
	PartiallyPaid Status = "partially_paid"
	Paid          Status = "paid"
	Credited      Status = "credited" // fully cleared by credit notes with no payment
	Void          Status = "void"
)

// Errors (translation keys).
var (
	ErrNotEditable     = errors.New("error.billing.invoiceNotEditable")
	ErrInvalidStatus   = errors.New("error.billing.invalidStatus")
	ErrOverpayment     = errors.New("error.billing.overpayment")
	ErrUseCreditNote   = errors.New("error.billing.useCreditNote")
	ErrCreditTooLarge  = errors.New("error.billing.creditExceedsInvoice")
	ErrCreditReference = errors.New("error.billing.creditNoteReferenceMissing")
)

// Invoice is the part of an invoice the lifecycle rules need.
type Invoice struct {
	Status   Status
	Currency string
	Total    int64 // minor units, fixed once issued
	Paid     int64
	Credited int64
	Due      time.Time
}

// Outstanding is the unpaid balance, never below zero.
func (i Invoice) Outstanding() int64 {
	if o := i.Total - i.Paid - i.Credited; o > 0 {
		return o
	}
	return 0
}

// CanEdit: only drafts can change. An issued invoice is a legal record;
// corrections go through a credit note (and a new invoice if needed).
func (i Invoice) CanEdit() bool { return i.Status == Draft }

// Issue moves a draft to issued.
func (i *Invoice) Issue() error {
	if i.Status != Draft {
		return ErrInvalidStatus
	}
	if i.Total < 0 {
		return ErrInvalidAmount
	}
	i.Status = Issued
	return nil
}

// RecordPayment applies a verified payment. It cannot exceed the balance;
// surplus must be handled by allocation as credit on account.
func (i *Invoice) RecordPayment(amount int64) error {
	if i.Status != Issued && i.Status != PartiallyPaid {
		return ErrInvalidStatus
	}
	if amount <= 0 {
		return ErrInvalidAmount
	}
	if amount > i.Outstanding() {
		return ErrOverpayment
	}
	i.Paid += amount
	i.settle()
	return nil
}

func (i *Invoice) settle() {
	switch {
	case i.Outstanding() == 0 && i.Paid == 0:
		i.Status = Credited
	case i.Outstanding() == 0:
		i.Status = Paid
	case i.Paid > 0 || i.Credited > 0:
		i.Status = PartiallyPaid
	}
}

// Void cancels a draft or an issued invoice that has had no payment or
// credit. Anything else needs a credit note, so the numbering and history stay
// intact.
func (i *Invoice) Void() error {
	switch i.Status {
	case Draft, Issued:
		if i.Paid > 0 || i.Credited > 0 {
			return ErrUseCreditNote
		}
		i.Status = Void
		return nil
	case Void:
		return ErrInvalidStatus
	}
	return ErrUseCreditNote
}

// DisplayStatus adds the derived "overdue" label for unpaid issued invoices.
func (i Invoice) DisplayStatus(asOf time.Time) string {
	if (i.Status == Issued || i.Status == PartiallyPaid) && DaysOverdue(i.Due, asOf) > 0 {
		return "overdue"
	}
	return string(i.Status)
}

// CreditNote reduces what a customer owes for a previously issued invoice.
type CreditNote struct {
	Currency       string
	Amount         int64
	OriginalNumber string    // number of the invoice being credited
	OriginalDate   time.Time // its issue date
	Reason         string
}

// ApplyCreditNote records a credit note against the invoice. It returns the
// excess: the part of the credit that exceeds the balance (the customer had
// already paid), which the caller must refund or hold as credit on account.
// The credit may never exceed the invoice total in all.
func (i *Invoice) ApplyCreditNote(cn CreditNote) (excess int64, err error) {
	if i.Status != Issued && i.Status != PartiallyPaid && i.Status != Paid && i.Status != Credited {
		return 0, ErrInvalidStatus
	}
	if cn.Currency != i.Currency {
		return 0, ErrCurrencyMismatch
	}
	if cn.Amount <= 0 {
		return 0, ErrInvalidAmount
	}
	if !gst.ValidInvoiceNumber(cn.OriginalNumber) || cn.OriginalDate.IsZero() || cn.Reason == "" {
		return 0, ErrCreditReference
	}
	if i.Credited+cn.Amount > i.Total {
		return 0, ErrCreditTooLarge
	}
	before := i.Outstanding()
	i.Credited += cn.Amount
	if cn.Amount > before {
		excess = cn.Amount - before
	}
	i.settle()
	return excess, nil
}
