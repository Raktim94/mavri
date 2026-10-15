// Package csvio moves customers, products, invoices and payments in and out as CSV.
package csvio

import (
	"context"
	"database/sql"
	"encoding/csv"
	"io"
	"strings"

	"github.com/Raktim94/mavri/server/internal/model"
	"github.com/Raktim94/mavri/server/internal/money"
	"github.com/Raktim94/mavri/server/internal/store"
)

// Kinds that can be exported.
var Kinds = []string{"customers", "products", "invoices", "payments"}

// SafeCell stops a spreadsheet from running a cell that starts like a formula.
func SafeCell(s string) string {
	if s != "" && strings.ContainsRune("=+-@\t\r", rune(s[0])) {
		return "'" + s
	}
	return s
}

func row(w *csv.Writer, cells ...string) { _ = w.Write(cells) }

// Export writes one kind as CSV. Amounts are in major units (12.50), so a spreadsheet can read them.
func Export(ctx context.Context, d *sql.DB, st *store.Store, kind string, w io.Writer) error {
	cw := csv.NewWriter(w)
	defer cw.Flush()
	switch kind {
	case "customers":
		row(cw, "name", "email", "phone", "address", "tax_id", "country", "note")
		ps, err := store.Parties.Select(ctx, d, "WHERE kind = 'customer' AND archived = 0 ORDER BY name COLLATE NOCASE")
		if err != nil {
			return err
		}
		for _, p := range ps {
			row(cw, SafeCell(p.Name), SafeCell(p.Email), SafeCell(p.Phone), SafeCell(p.Address), SafeCell(p.TaxID), p.Country, SafeCell(p.Note))
		}
	case "products":
		row(cw, "name", "description", "price", "category", "unit")
		ps, err := store.Products.Select(ctx, d, "WHERE archived = 0 ORDER BY name COLLATE NOCASE")
		if err != nil {
			return err
		}
		gs, err := store.Groups.Select(ctx, d, "")
		if err != nil {
			return err
		}
		names := map[int64]string{}
		for _, g := range gs {
			names[g.ID] = g.Name
		}
		for _, p := range ps {
			var cat, unit string
			if p.CategoryID != nil {
				cat = names[*p.CategoryID]
			}
			if p.UnitID != nil {
				unit = names[*p.UnitID]
			}
			row(cw, SafeCell(p.Name), SafeCell(p.Description), money.Major(p.PriceCents, 2), SafeCell(cat), SafeCell(unit))
		}
	case "invoices":
		row(cw, "number", "type", "customer", "customer_email", "issued_on", "due_on", "status", "currency", "total", "paid", "balance")
		items, _, err := st.ListDocuments(ctx, store.Filter{Limit: 100000})
		if err != nil {
			return err
		}
		for _, it := range items {
			doc, err := st.GetDocument(ctx, d, it.ID)
			if err != nil {
				return err
			}
			dec := doc.Currency.Decimals
			row(cw, SafeCell(doc.FullNumber), doc.Kind, SafeCell(doc.Customer.Name), SafeCell(doc.Customer.Email), doc.IssuedOn, doc.DueOn, doc.Status, doc.Currency.Code,
				money.Major(doc.Totals.TotalCents, dec), money.Major(doc.PaidCents, dec), money.Major(doc.Totals.TotalCents-doc.PaidCents, dec))
		}
	case "payments":
		row(cw, "invoice", "customer", "paid_on", "amount", "currency", "method", "note")
		items, _, err := st.ListDocuments(ctx, store.Filter{Kind: model.KindInvoice, Limit: 100000})
		if err != nil {
			return err
		}
		for _, it := range items {
			doc, err := st.GetDocument(ctx, d, it.ID)
			if err != nil {
				return err
			}
			for _, p := range doc.Payments {
				row(cw, SafeCell(doc.FullNumber), SafeCell(doc.Customer.Name), p.PaidOn, money.Major(p.AmountCents, doc.Currency.Decimals), doc.Currency.Code, SafeCell(p.Method), SafeCell(p.Note))
			}
		}
	default:
		return ErrUnknownKind
	}
	cw.Flush()
	return cw.Error()
}
