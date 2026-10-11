package billing

import (
	"sort"
	"time"
)

// Entry is one ledger line for a customer. Debit increases what they owe
// (an invoice); Credit reduces it (a payment or credit note).
type Entry struct {
	Date        time.Time
	Description string
	Currency    string
	Debit       int64
	Credit      int64
}

// StatementLine is an entry with the running balance after it.
type StatementLine struct {
	Entry
	Balance int64
}

// Statement builds a customer statement for one currency over [from, to]
// (inclusive). Entries before `from` are rolled into the opening balance.
// Positive balances mean the customer owes money.
func Statement(currency string, opening int64, entries []Entry, from, to time.Time) (lines []StatementLine, closing int64, err error) {
	list := append([]Entry(nil), entries...)
	for _, e := range list {
		if e.Currency != currency {
			return nil, 0, ErrCurrencyMismatch
		}
	}
	sort.SliceStable(list, func(i, j int) bool { return list[i].Date.Before(list[j].Date) })
	bal := opening
	f, t := Day(from), Day(to)
	for _, e := range list {
		d := Day(e.Date)
		switch {
		case d.Before(f):
			bal += e.Debit - e.Credit
		case d.After(t):
		default:
			bal += e.Debit - e.Credit
			lines = append(lines, StatementLine{Entry: e, Balance: bal})
		}
	}
	return lines, bal, nil
}
