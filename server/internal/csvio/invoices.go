package csvio

import (
	"context"
	"database/sql"
	"fmt"
	"io"
	"sort"
	"strings"
	"time"
	"unicode/utf8"

	"github.com/Raktim94/mavri/server/internal/model"
	"github.com/Raktim94/mavri/server/internal/money"
	"github.com/Raktim94/mavri/server/internal/store"
)

// invoice columns, besides the shared aliases. A file has one row per line item; rows with the same number are one invoice.
var invoiceAliases = map[string]string{
	"invoice": "number", "invoice number": "number", "invoice no": "number", "invoice #": "number", "no": "number", "document": "number",
	"client": "customer", "customer name": "customer", "bill to": "customer", "customer email": "customer_email", "client email": "customer_email",
	"date": "issued_on", "invoice date": "issued_on", "issued": "issued_on", "issue date": "issued_on", "issued on": "issued_on",
	"due": "due_on", "due date": "due_on", "due on": "due_on", "currency code": "currency",
	"description": "item", "line item": "item", "name": "item", "product": "item", "item name": "item",
	"qty": "quantity", "quantity": "quantity", "unit price": "unit_price", "price": "unit_price", "rate": "unit_price",
	"tax": "tax_rate", "tax %": "tax_rate", "vat": "tax_rate", "vat %": "tax_rate", "gst": "tax_rate", "gst %": "tax_rate", "tax rate": "tax_rate",
	"amount paid": "paid", "paid amount": "paid", "payment date": "paid_on", "paid date": "paid_on", "business": "issuer", "issuer": "issuer",
	"grand total": "total", "invoice total": "total",
}

func invCanon(h string) string {
	c := strings.ToLower(strings.TrimSpace(strings.TrimPrefix(h, "\ufeff")))
	c = strings.ReplaceAll(c, "_", " ")
	if a, ok := invoiceAliases[c]; ok {
		return a
	}
	return strings.ReplaceAll(c, " ", "_")
}

func isDay(s string) bool { _, err := time.Parse("2006-01-02", s); return err == nil }

// normDay reads 2026-10-16, 16/10/2026 and 16.10.2026 (day first, as most countries write it).
func normDay(s string) (string, bool) {
	s = strings.TrimSpace(s)
	if isDay(s) {
		return s, true
	}
	for _, layout := range []string{"02/01/2006", "2/1/2006", "02.01.2006", "2.1.2006", "02-01-2006"} {
		if t, err := time.Parse(layout, s); err == nil {
			return t.Format("2006-01-02"), true
		}
	}
	return "", false
}

type invRow struct {
	idx  int // position in the table, to find the line and raw row
	item string
	qty  float64
	unit float64
	tax  float64
}

// ImportInvoices reads a CSV with one row per line item. Rows that share an invoice number become one invoice.
// An invoice with any problem is skipped as a whole and every problem is listed with its line, so the file can be fixed
// and imported again; invoices that already exist (same business and number) are skipped, which makes a re-import safe.
func ImportInvoices(ctx context.Context, st *store.Store, r io.Reader, dryRun bool) (Report, error) {
	rep := Report{Kind: "invoices", DryRun: dryRun, Errors: []RowError{}, Preview: []map[string]string{}}
	raw, err := io.ReadAll(io.LimitReader(r, 16<<20))
	if err != nil {
		return rep, err
	}
	if !utf8.Valid(raw) {
		return rep, fmt.Errorf("%w: the file is not UTF-8 text; save it as CSV (UTF-8) and try again", ErrInvalid)
	}
	t, err := readTable(strings.NewReader(string(raw)))
	if err != nil {
		return rep, err
	}
	// Re-read the header with the invoice aliases.
	t.cols = map[string]int{}
	for i, h := range t.header {
		if c := invCanon(h); c != "" {
			if _, dup := t.cols[c]; !dup {
				t.cols[c] = i
			}
		}
	}
	rep.Header, rep.Total = t.header, len(t.rows)
	for _, need := range []string{"number", "customer", "issued_on", "currency", "item", "unit_price"} {
		if _, ok := t.cols[need]; !ok {
			return rep, fmt.Errorf("%w: the first row needs a %q column (accepted names include invoice number, customer, date, currency, description and unit price)", ErrInvalid, need)
		}
	}

	d := st.DB
	issuers, err := store.Parties.Select(ctx, d, "WHERE kind = 'issuer' AND archived = 0")
	if err != nil {
		return rep, err
	}
	customers, err := store.Parties.Select(ctx, d, "WHERE kind = 'customer' AND archived = 0")
	if err != nil {
		return rep, err
	}
	currencies, err := store.Currencies.Select(ctx, d, "WHERE archived = 0")
	if err != nil {
		return rep, err
	}
	byCode := map[string]model.Currency{}
	for _, c := range currencies {
		byCode[c.Code] = c
	}

	// group rows by invoice number, keeping the file's order
	var order []string
	groups := map[string][]int{}
	for i, rec := range t.rows {
		n := t.get(rec, "number")
		if n == "" {
			rep.bad(t, i, "the invoice number is empty")
			continue
		}
		if _, ok := groups[n]; !ok {
			order = append(order, n)
		}
		groups[n] = append(groups[n], i)
	}

	type ready struct {
		doc model.Document
		sum map[string]string
	}
	var toAdd []ready
	for _, num := range order {
		idx := groups[num]
		first := t.rows[idx[0]]
		fail := func(i int, msg string) { rep.bad(t, i, fmt.Sprintf("invoice %s: %s", num, msg)) }
		before := len(rep.Errors)

		// the business
		var issuer model.Party
		switch name := t.get(first, "issuer"); {
		case name != "":
			found := 0
			for _, p := range issuers {
				if strings.EqualFold(p.Name, name) {
					issuer, found = p, found+1
				}
			}
			if found != 1 {
				fail(idx[0], fmt.Sprintf("business %q was not found among your businesses", name))
			}
		case len(issuers) == 1:
			issuer = issuers[0]
		default:
			fail(idx[0], "add an issuer column naming your business (you have more than one, or none)")
		}

		// the customer: by email first, then by name; an ambiguous name is not guessed
		var cust model.Party
		name, email := t.get(first, "customer"), strings.ToLower(t.get(first, "customer_email"))
		var matches []model.Party
		for _, p := range customers {
			if email != "" && strings.ToLower(p.Email) == email || email == "" && strings.EqualFold(p.Name, name) {
				matches = append(matches, p)
			}
		}
		switch {
		case name == "":
			fail(idx[0], "the customer is empty")
		case len(matches) == 0:
			fail(idx[0], fmt.Sprintf("customer %q is not in Mavri yet; import or add customers first", name))
		case len(matches) > 1:
			fail(idx[0], fmt.Sprintf("customer %q matches %d records; add a customer email column to pick one", name, len(matches)))
		default:
			cust = matches[0]
		}

		code := strings.ToUpper(t.get(first, "currency"))
		cur, okCur := byCode[code]
		if !okCur {
			fail(idx[0], fmt.Sprintf("currency %q is not one of your currencies", code))
		}
		issued, okDay := normDay(t.get(first, "issued_on"))
		if !okDay {
			fail(idx[0], fmt.Sprintf("date %q is not a date (use 2026-10-16 or 16/10/2026)", t.get(first, "issued_on")))
		}
		due := ""
		if s := t.get(first, "due_on"); s != "" {
			if due, okDay = normDay(s); !okDay {
				fail(idx[0], fmt.Sprintf("due date %q is not a date", s))
			}
		}

		var lines []model.Line
		for _, i := range idx {
			rec := t.rows[i]
			// the header facts must agree on every row of one invoice
			for _, col := range []string{"customer", "issued_on", "currency"} {
				if v := t.get(rec, col); v != "" && v != t.get(first, col) {
					fail(i, fmt.Sprintf("%s differs from the first row of this invoice", col))
				}
			}
			ln := model.Line{Name: t.get(rec, "item"), Quantity: 1, Unit: t.get(rec, "unit")}
			if ln.Name == "" {
				fail(i, "the description is empty")
			}
			if s := t.get(rec, "quantity"); s != "" {
				q, err := parseNumber(s, "quantity")
				if err != nil || q == 0 {
					fail(i, fmt.Sprintf("quantity %q is not a positive number", s))
				}
				ln.Quantity = q
			}
			if p, err := parseNumber(t.get(rec, "unit_price"), "unit price"); err != nil {
				fail(i, err.Error())
			} else if okCur {
				ln.UnitCents = money.ToMinor(p, cur.Decimals)
			}
			if s := t.get(rec, "tax_rate"); s != "" {
				tr, err := parseNumber(strings.TrimSuffix(s, "%"), "tax rate")
				if err != nil || tr > 100 {
					fail(i, fmt.Sprintf("tax rate %q is not a percentage", s))
				}
				if tr > 0 {
					ln.TaxRate, ln.TaxMode = tr, "add"
				}
			}
			lines = append(lines, ln)
		}
		if len(rep.Errors) > before {
			continue
		}

		doc := model.Document{Kind: model.KindInvoice, IssuerID: issuer.ID, CustomerID: cust.ID, CurrencyID: cur.ID, IssuedOn: issued, DueOn: due,
			Number: num, Lines: lines, NoteCustomer: t.get(first, "note")}
		// the file's own total, when it has one, must match what the lines add up to
		totals := money.Compute(&doc)
		if s := t.get(first, "total"); s != "" {
			want, err := parseNumber(s, "total")
			if err != nil {
				fail(idx[0], err.Error())
				continue
			}
			if diff := money.ToMinor(want, cur.Decimals) - totals.TotalCents; diff > 1 || diff < -1 {
				fail(idx[0], fmt.Sprintf("the file says the total is %s but the lines add up to %s; check the prices and tax columns", s, money.Major(totals.TotalCents, cur.Decimals)))
				continue
			}
		}
		if s := t.get(first, "paid"); s != "" {
			paid, err := parseNumber(s, "paid amount")
			if err != nil {
				fail(idx[0], err.Error())
				continue
			}
			if c := money.ToMinor(paid, cur.Decimals); c > 0 {
				on, ok := normDay(t.get(first, "paid_on"))
				if !ok {
					on = issued
				}
				doc.Payments = []model.Payment{{AmountCents: c, PaidOn: on, Method: "import", Note: "imported from CSV"}}
			}
		}

		// already there? the same business and number
		var n int
		_ = d.QueryRowContext(ctx, `SELECT COUNT(*) FROM documents WHERE kind = 'invoice' AND issuer_id = ? AND (number_prefix || number || number_suffix) = ?`, issuer.ID, num).Scan(&n)
		if n > 0 {
			rep.Skipped++
			fail(idx[0], "already exists; skipped")
			continue
		}
		rep.Valid++
		sum := map[string]string{"number": num, "customer": cust.Name, "date": issued, "lines": fmt.Sprint(len(lines)), "total": money.Major(totals.TotalCents, cur.Decimals) + " " + cur.Code}
		if len(rep.Preview) < 10 {
			rep.Preview = append(rep.Preview, sum)
		}
		toAdd = append(toAdd, ready{doc, sum})
	}
	sort.SliceStable(rep.Errors, func(i, j int) bool { return rep.Errors[i].Line < rep.Errors[j].Line })
	if dryRun {
		return rep, nil
	}
	for _, r := range toAdd {
		if _, err := st.CreateDocument(ctx, r.doc, store.SaveOptions{}); err != nil {
			rep.Errors = append(rep.Errors, RowError{Message: fmt.Sprintf("invoice %s: %v", r.doc.Number, err)})
			continue
		}
		rep.Created++
	}
	return rep, nil
}

var _ = sql.ErrNoRows
