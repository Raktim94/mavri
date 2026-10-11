package billing

import (
	"sort"
	"time"
)

// OpenInvoice is an invoice that still has a balance.
type OpenInvoice struct {
	ID          string
	Currency    string
	Due         time.Time
	Outstanding int64
}

// Allocation is the part of a payment applied to one invoice.
type Allocation struct {
	InvoiceID string
	Amount    int64
}

// Strategy picks the order invoices are settled in.
type Strategy int

const (
	OldestDueFirst Strategy = iota // earliest due date first, ties by ID
	InGivenOrder                   // exactly the order supplied (the user chose)
)

// Allocate spreads a payment over invoices. It never applies more than an
// invoice's balance; whatever is left is returned as unapplied (credit on
// account). All invoices must share the payment's currency, because amounts
// in different currencies are never combined.
func Allocate(currency string, amount int64, invoices []OpenInvoice, s Strategy) (allocs []Allocation, unapplied int64, err error) {
	if amount <= 0 {
		return nil, 0, ErrInvalidAmount
	}
	list := append([]OpenInvoice(nil), invoices...)
	for _, inv := range list {
		if inv.Currency != currency {
			return nil, 0, ErrCurrencyMismatch
		}
	}
	if s == OldestDueFirst {
		sort.SliceStable(list, func(i, j int) bool {
			if !list[i].Due.Equal(list[j].Due) {
				return list[i].Due.Before(list[j].Due)
			}
			return list[i].ID < list[j].ID
		})
	}
	left := amount
	for _, inv := range list {
		if left == 0 {
			break
		}
		if inv.Outstanding <= 0 {
			continue
		}
		take := inv.Outstanding
		if take > left {
			take = left
		}
		allocs = append(allocs, Allocation{InvoiceID: inv.ID, Amount: take})
		left -= take
	}
	return allocs, left, nil
}
