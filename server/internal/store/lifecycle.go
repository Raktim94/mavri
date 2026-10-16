package store

import (
	"context"
	"database/sql"
	"encoding/json"
	"errors"
	"fmt"
	"strings"
	"time"

	"github.com/Raktim94/mavri/server/internal/db"
	"github.com/Raktim94/mavri/server/internal/model"
	"github.com/Raktim94/mavri/server/internal/money"
)

// ErrLocked is returned when an issued invoice is changed in a way only a credit or debit note allows.
var ErrLocked = errors.New("locked")

// lockedChange says whether new differs from an issued document in anything but its payments or being voided.
// Everything a client could have seen is fixed: figures, parties, dates, number, notes and look.
func lockedChange(old, d model.Document) error {
	type fixed struct {
		Kind, Prefix, Number, Suffix, IssuedOn, DueOn, NoteC, NoteT, NoteTh, TaxMode, Supply, PO, Project, SetCur, ExDate string
		Issuer, Customer, Currency                                                                                        int64
		Bank, Style                                                                                                       int64
		Disc, Sur                                                                                                         model.Adjustment
		Ship                                                                                                              int64
		Rate, ExRate                                                                                                      float64
		Lines                                                                                                             []model.Line
	}
	of := func(x model.Document) string {
		f := fixed{x.Kind, x.NumberPrefix, x.Number, x.NumberSuffix, x.IssuedOn, x.DueOn, x.NoteCustomer, x.NoteTerms, x.NoteThanks, x.TaxMode,
			x.SupplyDate, x.PORef, x.ProjectRef, x.SettlementCurrency, x.ExchangeDate, x.IssuerID, x.CustomerID, x.CurrencyID, 0, 0, x.Discount, x.Surcharge,
			x.ShippingCents, x.TaxRate, x.ExchangeRate, nil}
		if x.BankID != nil {
			f.Bank = *x.BankID
		}
		if x.StyleID != nil {
			f.Style = *x.StyleID
		}
		for _, l := range x.Lines {
			l.ID = 0
			l.Name = strings.TrimSpace(l.Name)
			f.Lines = append(f.Lines, l)
		}
		b, _ := json.Marshal(f)
		return string(b)
	}
	if of(old) != of(d) {
		return fmt.Errorf("%w: this invoice has been issued, so its figures and details can no longer change; issue a credit note or a debit note instead", ErrLocked)
	}
	return nil
}

// IssueDocument locks a draft invoice: from now on only payments and voiding can change it. Quotes and credit
// notes are not issued this way, and an invoice cannot be issued twice.
func (s *Store) IssueDocument(ctx context.Context, id int64) (model.Document, error) {
	var out model.Document
	err := db.WithTx(ctx, s.DB, func(tx *sql.Tx) error {
		d, err := s.GetDocument(ctx, tx, id)
		if err != nil {
			return err
		}
		switch {
		case d.Kind != model.KindInvoice || d.DocType != "":
			return invalid("only an invoice can be issued")
		case d.Locked:
			return invalid("this invoice is already issued")
		case d.Status == model.StatusVoid:
			return invalid("a void invoice cannot be issued")
		}
		status := money.InvoiceStatusFull("", d.Totals.TotalCents, money.Paid(&d), d.CreditedCents)
		if _, err := tx.ExecContext(ctx, `UPDATE documents SET locked = 1, issued_at = ?, status = ?, updated_at = ? WHERE id = ?`, db.Now(), status, db.Now(), id); err != nil {
			return err
		}
		out, err = s.GetDocument(ctx, tx, id)
		return err
	})
	return out, err
}

// CreditLine picks a line of the original invoice, and how much of it to credit.
type CreditLine struct {
	Index    int     `json:"index"` // position in the original, from 0
	Quantity float64 `json:"quantity"`
}

// Correction describes a credit or a debit note against an issued invoice.
type Correction struct {
	Kind   string       `json:"kind"`   // credit or debit
	Full   bool         `json:"full"`   // credit: everything on the original, including discount, surcharge and shipping
	Credit []CreditLine `json:"credit"` // credit: some lines of the original
	Lines  []model.Line `json:"lines"`  // debit: what is charged
	Reason string       `json:"reason"`
}

// Correct issues a credit or debit note that points at an issued invoice. Credit notes reduce what the invoice
// is owed (and settle it when they cover it); debit notes are further invoices for extra charges. Both are
// issued immediately: a correction is itself a financial document.
func (s *Store) Correct(ctx context.Context, id int64, c Correction) (model.Document, error) {
	var out model.Document
	err := db.WithTx(ctx, s.DB, func(tx *sql.Tx) error {
		orig, err := s.GetDocument(ctx, tx, id)
		if err != nil {
			return err
		}
		if orig.Kind != model.KindInvoice || orig.DocType != "" {
			return invalid("only an ordinary invoice can be corrected")
		}
		if !orig.Locked {
			return invalid("issue the invoice first; until then you can simply edit it")
		}
		if orig.Status == model.StatusVoid {
			return invalid("a void invoice cannot be corrected")
		}
		reason := strings.TrimSpace(c.Reason)
		doc := orig
		doc.ID, doc.Payments, doc.Attachments, doc.ConvertedFrom = 0, nil, nil, nil
		doc.Corrects = &id
		doc.Locked, doc.IssuedAt, doc.CreditedCents, doc.IssuedOn = true, db.Now(), 0, s.Today()
		doc.PORef, doc.ProjectRef = orig.PORef, orig.ProjectRef
		prefix, suffix := "", ""
		set, _ := s.GetSettings(ctx, tx)
		switch c.Kind {
		case "credit":
			doc.DocType, doc.Status, doc.DueOn = "credit", model.StatusCredit, ""
			prefix = firstText(set.CreditPrefix, "CN-")
			if !c.Full {
				if len(c.Credit) == 0 {
					return invalid("choose what to credit: everything, or some lines")
				}
				doc.Lines = nil
				doc.Discount, doc.Surcharge, doc.ShippingCents = model.Adjustment{}, model.Adjustment{}, 0
				for _, cl := range c.Credit {
					if cl.Index < 0 || cl.Index >= len(orig.Lines) {
						return invalid("line %d does not exist on the invoice", cl.Index+1)
					}
					l := orig.Lines[cl.Index]
					if cl.Quantity <= 0 || cl.Quantity > l.Quantity {
						return invalid("line %d: credit between 0 and %v", cl.Index+1, l.Quantity)
					}
					l.ID, l.Quantity = 0, cl.Quantity
					doc.Lines = append(doc.Lines, l)
				}
			}
			doc.NoteCustomer = "Credit note for " + orig.FullNumber + "."
			if reason != "" {
				doc.NoteCustomer += " " + reason
			}
		case "debit":
			if len(c.Lines) == 0 {
				return invalid("add what is being charged")
			}
			doc.DocType, doc.Status = "debit", ""
			prefix = firstText(set.DebitPrefix, "DN-")
			doc.Lines = c.Lines
			doc.Discount, doc.Surcharge, doc.ShippingCents = model.Adjustment{}, model.Adjustment{}, 0
			doc.TaxRate, doc.TaxMode = 0, ""
			doc.NoteCustomer = "Debit note for " + orig.FullNumber + "."
			if reason != "" {
				doc.NoteCustomer += " " + reason
			}
			if orig.DueOn != "" && validDate(orig.IssuedOn) && validDate(orig.DueOn) {
				a, _ := time.Parse("2006-01-02", orig.IssuedOn)
				b, _ := time.Parse("2006-01-02", orig.DueOn)
				doc.DueOn = s.now().UTC().Add(b.Sub(a)).Format("2006-01-02")
			} else {
				doc.DueOn = ""
			}
		default:
			return invalid("a correction is a credit note or a debit note")
		}
		n, err := s.NextNumber(ctx, tx, orig.IssuerID, model.KindInvoice, prefix, suffix)
		if err != nil {
			return err
		}
		doc.NumberPrefix, doc.Number, doc.NumberSuffix = prefix, n, suffix
		total := money.Compute(&doc).TotalCents
		if c.Kind == "credit" && orig.CreditedCents+total > orig.Totals.TotalCents {
			return invalid("the credit notes would be more than the invoice (%s already credited)", money.Major(orig.CreditedCents, orig.Currency.Decimals))
		}
		row, err := s.prepare(ctx, tx, &doc, nil, SaveOptions{Internal: true})
		if err != nil {
			return err
		}
		// A correction keeps the original's copies of the parties and the look: it is part of the same paperwork.
		orow, _ := docs.Get(ctx, tx, id)
		row.IssuerSnap, row.CustomerSnap, row.CurrencySnap, row.BankSnap, row.StyleSnap = orow.IssuerSnap, orow.CustomerSnap, orow.CurrencySnap, orow.BankSnap, orow.StyleSnap
		row.ID = 0
		if err := docs.Insert(ctx, tx, &row); err != nil {
			return err
		}
		if err := s.writeChildren(ctx, tx, row.ID, &doc); err != nil {
			return err
		}
		if c.Kind == "credit" {
			credited := orig.CreditedCents + total
			orig.CreditedCents = credited
			status := money.InvoiceStatusFull(orig.Status, orig.Totals.TotalCents, money.Paid(&orig), credited)
			if _, err := tx.ExecContext(ctx, `UPDATE documents SET credited_cents = ?, status = ?, updated_at = ? WHERE id = ?`, credited, status, db.Now(), id); err != nil {
				return err
			}
		}
		out, err = s.GetDocument(ctx, tx, row.ID)
		return err
	})
	return out, wrapDup(err)
}

func firstText(v ...string) string {
	for _, s := range v {
		if strings.TrimSpace(s) != "" {
			return strings.TrimSpace(s)
		}
	}
	return ""
}

// Corrections lists the credit and debit notes that point at an invoice, oldest first.
func (s *Store) Corrections(ctx context.Context, id int64) ([]model.Summary, error) {
	items, _, err := s.ListDocuments(ctx, Filter{Kind: model.KindInvoice})
	if err != nil {
		return nil, err
	}
	out := []model.Summary{}
	for i := len(items) - 1; i >= 0; i-- {
		if items[i].Corrects == id {
			out = append(out, items[i])
		}
	}
	return out, nil
}
