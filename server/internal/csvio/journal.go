package csvio

import (
	"context"
	"database/sql"
	"encoding/csv"
	"sort"

	"github.com/Raktim94/mavri/server/internal/model"
	"github.com/Raktim94/mavri/server/internal/money"
	"github.com/Raktim94/mavri/server/internal/store"
)

// Account names used in the journal export. They are plain names, not account numbers: map them to the chart of
// accounts of your accounting software when you import.
const (
	AcctReceivable = "Accounts receivable"
	AcctSales      = "Sales"
	AcctTax        = "Tax payable"
	AcctWithheld   = "Tax withheld by customer"
	AcctBank       = "Bank or cash received"
)

type journalLine struct {
	date, ref, account, currency, memo, customer string
	debit, credit                                int64
	dec                                          int
}

// writeJournal writes a double-entry journal of everything issued and received: each issued invoice debits accounts
// receivable and credits sales and tax; a credit note does the opposite; each payment debits the bank and credits
// accounts receivable, and a refund does the opposite. Drafts, quotes and void invoices are left out. Mavri is not an
// accounting system: this is a starting point for yours.
func writeJournal(ctx context.Context, d *sql.DB, st *store.Store, cw *csv.Writer, pick func(int64) bool) error {
	row(cw, "date", "reference", "account", "debit", "credit", "currency", "memo", "customer")
	items, _, err := st.ListDocuments(ctx, store.Filter{Kind: model.KindInvoice, Limit: 100000})
	if err != nil {
		return err
	}
	var lines []journalLine
	for _, it := range items {
		if !pick(it.ID) || it.Status == model.StatusDraft || it.Status == model.StatusVoid {
			continue
		}
		doc, err := st.GetDocument(ctx, d, it.ID)
		if err != nil {
			return err
		}
		t := doc.Totals
		net := t.TotalCents - t.TaxCents
		memo := "Invoice"
		credit := doc.DocType == "credit"
		switch doc.DocType {
		case "credit":
			memo = "Credit note for " + doc.CorrectsNumber
		case "debit":
			memo = "Debit note for " + doc.CorrectsNumber
		}
		add := func(account string, debit, cr int64) {
			if debit == 0 && cr == 0 {
				return
			}
			lines = append(lines, journalLine{doc.IssuedOn, doc.FullNumber, account, doc.Currency.Code, memo, doc.Customer.Name, debit, cr, doc.Currency.Decimals})
		}
		// ordinary and debit invoices: receivable up, sales and tax up. Credit notes: the mirror image.
		side := func(amount int64, account string, receivable bool) {
			if amount == 0 {
				return
			}
			debitSide := receivable != credit
			if debitSide {
				add(account, amount, 0)
			} else {
				add(account, 0, amount)
			}
		}
		side(t.TotalCents, AcctReceivable, true)
		side(net, AcctSales, false)
		if t.TaxCents >= 0 {
			side(t.TaxCents, AcctTax, false)
		} else {
			// Tax withheld by the customer is something they will pay to the authority for us: an asset, not a liability.
			side(-t.TaxCents, AcctWithheld, true)
		}
		for _, p := range doc.Payments {
			refund := p.Kind == "refund"
			if refund {
				lines = append(lines, journalLine{p.PaidOn, doc.FullNumber, AcctReceivable, doc.Currency.Code, "Refund paid back", doc.Customer.Name, p.AmountCents, 0, doc.Currency.Decimals},
					journalLine{p.PaidOn, doc.FullNumber, AcctBank, doc.Currency.Code, "Refund paid back", doc.Customer.Name, 0, p.AmountCents, doc.Currency.Decimals})
			} else {
				lines = append(lines, journalLine{p.PaidOn, doc.FullNumber, AcctBank, doc.Currency.Code, "Payment received", doc.Customer.Name, p.AmountCents, 0, doc.Currency.Decimals},
					journalLine{p.PaidOn, doc.FullNumber, AcctReceivable, doc.Currency.Code, "Payment received", doc.Customer.Name, 0, p.AmountCents, doc.Currency.Decimals})
			}
		}
	}
	sort.SliceStable(lines, func(i, j int) bool {
		if lines[i].date != lines[j].date {
			return lines[i].date < lines[j].date
		}
		return lines[i].ref < lines[j].ref
	})
	for _, l := range lines {
		deb, cre := "", ""
		if l.debit != 0 {
			deb = money.Major(l.debit, l.dec)
		}
		if l.credit != 0 {
			cre = money.Major(l.credit, l.dec)
		}
		row(cw, l.date, SafeCell(l.ref), l.account, deb, cre, l.currency, SafeCell(l.memo), SafeCell(l.customer))
	}
	cw.Flush()
	return cw.Error()
}
