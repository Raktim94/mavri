package store

import (
	"context"
	"database/sql"
	"encoding/json"
	"errors"
	"fmt"
	"sort"
	"strconv"
	"strings"
	"time"

	"github.com/Raktim94/mavri/server/internal/db"
	"github.com/Raktim94/mavri/server/internal/model"
	"github.com/Raktim94/mavri/server/internal/money"
)

// docRow is the documents table; the API's Document is built from it.
type docRow struct {
	ID               int64   `db:"id"`
	Kind             string  `db:"kind"`
	NumberPrefix     string  `db:"number_prefix"`
	Number           string  `db:"number"`
	NumberSuffix     string  `db:"number_suffix"`
	IssuerID         int64   `db:"issuer_id"`
	CustomerID       int64   `db:"customer_id"`
	CurrencyID       int64   `db:"currency_id"`
	BankID           *int64  `db:"bank_id"`
	StyleID          *int64  `db:"style_id"`
	ConvertedFrom    *int64  `db:"converted_from"`
	IssuedOn         string  `db:"issued_on"`
	DueOn            string  `db:"due_on"`
	Status           string  `db:"status"`
	DiscountMode     string  `db:"discount_mode"`
	DiscountCents    int64   `db:"discount_cents"`
	DiscountPercent  float64 `db:"discount_percent"`
	SurchargeMode    string  `db:"surcharge_mode"`
	SurchargeCents   int64   `db:"surcharge_cents"`
	SurchargePercent float64 `db:"surcharge_percent"`
	ShippingCents    int64   `db:"shipping_cents"`
	TaxRate          float64 `db:"tax_rate"`
	TaxMode          string  `db:"tax_mode"`
	NoteCustomer     string  `db:"note_customer"`
	NoteTerms        string  `db:"note_terms"`
	NoteThanks       string  `db:"note_thanks"`
	IssuerSnap       string  `db:"issuer_snap"`
	CustomerSnap     string  `db:"customer_snap"`
	CurrencySnap     string  `db:"currency_snap"`
	BankSnap         string  `db:"bank_snap"`
	StyleSnap        string  `db:"style_snap"`
	DocType          string  `db:"doc_type"`
	Corrects         *int64  `db:"corrects"`
	Locked           bool    `db:"locked"`
	IssuedAt         string  `db:"issued_at"`
	CreditedCents    int64   `db:"credited_cents"`
	SupplyDate       string  `db:"supply_date"`
	PORef            string  `db:"po_ref"`
	ProjectRef       string  `db:"project_ref"`
	SettlementCur    string  `db:"settlement_currency"`
	ExchangeRate     float64 `db:"exchange_rate"`
	ExchangeDate     string  `db:"exchange_date"`
	CreatedAt        string  `db:"created_at"`
	UpdatedAt        string  `db:"updated_at"`
}

var docs = db.NewTable[docRow]("documents")
var attachmentsTable = db.NewTable[model.Attachment]("attachments")

func (r docRow) toDocument() model.Document {
	d := model.Document{
		ID: r.ID, Kind: r.Kind, NumberPrefix: r.NumberPrefix, Number: r.Number, NumberSuffix: r.NumberSuffix,
		FullNumber: r.NumberPrefix + r.Number + r.NumberSuffix,
		IssuerID:   r.IssuerID, CustomerID: r.CustomerID, CurrencyID: r.CurrencyID, BankID: r.BankID, StyleID: r.StyleID,
		ConvertedFrom: r.ConvertedFrom, IssuedOn: r.IssuedOn, DueOn: r.DueOn, Status: r.Status,
		Discount:      model.Adjustment{Mode: r.DiscountMode, Cents: r.DiscountCents, Percent: r.DiscountPercent},
		Surcharge:     model.Adjustment{Mode: r.SurchargeMode, Cents: r.SurchargeCents, Percent: r.SurchargePercent},
		ShippingCents: r.ShippingCents, TaxRate: r.TaxRate, TaxMode: r.TaxMode,
		NoteCustomer: r.NoteCustomer, NoteTerms: r.NoteTerms, NoteThanks: r.NoteThanks,
		CreatedAt: r.CreatedAt, UpdatedAt: r.UpdatedAt,
		DocType: r.DocType, Corrects: r.Corrects, Locked: r.Locked, IssuedAt: r.IssuedAt, CreditedCents: r.CreditedCents,
		SupplyDate: r.SupplyDate, PORef: r.PORef, ProjectRef: r.ProjectRef,
		SettlementCurrency: r.SettlementCur, ExchangeRate: r.ExchangeRate, ExchangeDate: r.ExchangeDate,
		Lines: []model.Line{}, Payments: []model.Payment{}, Attachments: []model.Attachment{},
	}
	_ = json.Unmarshal([]byte(r.IssuerSnap), &d.Issuer)
	_ = json.Unmarshal([]byte(r.CustomerSnap), &d.Customer)
	_ = json.Unmarshal([]byte(r.CurrencySnap), &d.Currency)
	_ = json.Unmarshal([]byte(r.BankSnap), &d.Bank)
	_ = json.Unmarshal([]byte(r.StyleSnap), &d.Style)
	return d
}

func toRow(d model.Document) docRow {
	return docRow{
		ID: d.ID, Kind: d.Kind, NumberPrefix: d.NumberPrefix, Number: d.Number, NumberSuffix: d.NumberSuffix,
		IssuerID: d.IssuerID, CustomerID: d.CustomerID, CurrencyID: d.CurrencyID, BankID: d.BankID, StyleID: d.StyleID,
		ConvertedFrom: d.ConvertedFrom, IssuedOn: d.IssuedOn, DueOn: d.DueOn, Status: d.Status,
		DiscountMode: d.Discount.Mode, DiscountCents: d.Discount.Cents, DiscountPercent: d.Discount.Percent,
		SurchargeMode: d.Surcharge.Mode, SurchargeCents: d.Surcharge.Cents, SurchargePercent: d.Surcharge.Percent,
		ShippingCents: d.ShippingCents, TaxRate: d.TaxRate, TaxMode: d.TaxMode,
		NoteCustomer: d.NoteCustomer, NoteTerms: d.NoteTerms, NoteThanks: d.NoteThanks,
		CreatedAt: d.CreatedAt,
		DocType:   d.DocType, Corrects: d.Corrects, Locked: d.Locked, IssuedAt: d.IssuedAt, CreditedCents: d.CreditedCents,
		SupplyDate: d.SupplyDate, PORef: d.PORef, ProjectRef: d.ProjectRef,
		SettlementCur: d.SettlementCurrency, ExchangeRate: d.ExchangeRate, ExchangeDate: d.ExchangeDate,
	}
}

func snap(v any) string {
	b, _ := json.Marshal(v)
	return string(b)
}

func validDate(s string) bool {
	_, err := time.Parse("2006-01-02", s)
	return err == nil
}

// ---- reading ---------------------------------------------------------------

type lineRow struct {
	ID          int64   `db:"id"`
	DocumentID  int64   `db:"document_id"`
	Position    int     `db:"position"`
	ProductID   *int64  `db:"product_id"`
	Name        string  `db:"name"`
	Unit        string  `db:"unit"`
	Quantity    float64 `db:"quantity"`
	UnitCents   int64   `db:"unit_cents"`
	TaxRate     float64 `db:"tax_rate"`
	TaxMode     string  `db:"tax_mode"`
	Code        string  `db:"code"`
	TaxCode     string  `db:"tax_code"`
	Period      string  `db:"period"`
	LineType    string  `db:"line_type"`
	TaxCategory string  `db:"tax_category"`
}

var linesTable = db.NewTable[lineRow]("document_lines")

func (r lineRow) toLine() model.Line {
	return model.Line{ID: r.ID, ProductID: r.ProductID, Name: r.Name, Unit: r.Unit, Quantity: r.Quantity,
		UnitCents: r.UnitCents, TaxRate: r.TaxRate, TaxMode: r.TaxMode, Code: r.Code, TaxCode: r.TaxCode, Period: r.Period,
		LineType: r.LineType, TaxCategory: r.TaxCategory}
}

func (s *Store) finish(d *model.Document) {
	d.Totals = money.Compute(d)
	d.PaidCents = money.Paid(d)
	d.ReceivedCents = money.Received(d)
}

// GetDocument loads a document with its lines, payments and attachments.
func (s *Store) GetDocument(ctx context.Context, q db.Queryer, id int64) (model.Document, error) {
	row, err := docs.Get(ctx, q, id)
	if err != nil {
		return model.Document{}, err
	}
	d := row.toDocument()
	lines, err := linesTable.Select(ctx, q, "WHERE document_id = ? ORDER BY position", id)
	if err != nil {
		return d, err
	}
	for _, l := range lines {
		d.Lines = append(d.Lines, l.toLine())
	}
	if d.Payments, err = payments.Select(ctx, q, "WHERE document_id = ? ORDER BY paid_on, id", id); err != nil {
		return d, err
	}
	if d.Attachments, err = attachmentsTable.Select(ctx, q, "WHERE document_id = ? ORDER BY id", id); err != nil {
		return d, err
	}
	if d.Corrects != nil {
		_ = q.QueryRowContext(ctx, `SELECT number_prefix || number || number_suffix FROM documents WHERE id = ?`, *d.Corrects).Scan(&d.CorrectsNumber)
	}
	s.finish(&d)
	return d, nil
}

// Filter narrows a document list.
type Filter struct {
	Kind       string
	Status     string
	Query      string // number or customer name
	CustomerID int64
	From, To   string // issue dates, inclusive
	Limit      int    // 0 means no limit
	Offset     int
}

// ListDocuments returns summaries, newest first, and the total number matching.
func (s *Store) ListDocuments(ctx context.Context, f Filter) ([]model.Summary, int, error) {
	var where []string
	var args []any
	add := func(cond string, a ...any) { where = append(where, cond); args = append(args, a...) }
	if f.Kind != "" {
		add("d.kind = ?", f.Kind)
	}
	if f.Status != "" {
		add("d.status = ?", f.Status)
	}
	if f.CustomerID != 0 {
		add("d.customer_id = ?", f.CustomerID)
	}
	if f.From != "" {
		add("d.issued_on >= ?", f.From)
	}
	if f.To != "" {
		add("d.issued_on <= ?", f.To)
	}
	if q := strings.TrimSpace(f.Query); q != "" {
		like := "%" + strings.NewReplacer(`\`, `\\`, `%`, `\%`, `_`, `\_`).Replace(q) + "%"
		add(`(d.number_prefix || d.number || d.number_suffix LIKE ? ESCAPE '\' OR json_extract(d.customer_snap, '$.name') LIKE ? ESCAPE '\')`, like, like)
	}
	cond := ""
	if len(where) > 0 {
		cond = "WHERE " + strings.Join(where, " AND ")
	}
	var total int
	if err := s.DB.QueryRowContext(ctx, "SELECT COUNT(*) FROM documents d "+cond, args...).Scan(&total); err != nil {
		return nil, 0, err
	}
	tail := "ORDER BY d.issued_on DESC, d.id DESC"
	qargs := append([]any{}, args...)
	if f.Limit > 0 {
		tail += " LIMIT ? OFFSET ?"
		qargs = append(qargs, f.Limit, f.Offset)
	}
	rows, err := s.DB.QueryContext(ctx, `SELECT d.id, d.kind, d.number_prefix || d.number || d.number_suffix, d.customer_id,
		COALESCE(json_extract(d.customer_snap, '$.name'), ''), d.issued_on, d.due_on, d.status,
		COALESCE(json_extract(d.currency_snap, '$.code'), ''), COALESCE(json_extract(d.currency_snap, '$.symbol'), ''),
		COALESCE(json_extract(d.currency_snap, '$.pattern'), ''), COALESCE(json_extract(d.currency_snap, '$.decimals'), 2),
		d.discount_mode, d.discount_cents, d.discount_percent, d.surcharge_mode, d.surcharge_cents, d.surcharge_percent,
		d.shipping_cents, d.tax_rate, d.tax_mode, d.doc_type, d.locked, d.credited_cents, COALESCE(d.corrects, 0) FROM documents d `+cond+" "+tail, qargs...)
	if err != nil {
		return nil, 0, err
	}
	defer rows.Close()
	var out []model.Summary
	var shells []model.Document
	for rows.Next() {
		var sm model.Summary
		var d model.Document
		if err := rows.Scan(&sm.ID, &sm.Kind, &sm.FullNumber, &sm.CustomerID, &sm.CustomerName, &sm.IssuedOn, &sm.DueOn, &sm.Status,
			&sm.CurrencyCode, &sm.CurrencySym, &sm.CurrencyPat, &sm.CurrencyScale, &d.Discount.Mode, &d.Discount.Cents, &d.Discount.Percent,
			&d.Surcharge.Mode, &d.Surcharge.Cents, &d.Surcharge.Percent, &d.ShippingCents, &d.TaxRate, &d.TaxMode, &sm.DocType, &sm.Locked, &sm.CreditedCents, &sm.Corrects); err != nil {
			return nil, 0, err
		}
		out = append(out, sm)
		shells = append(shells, d)
	}
	if err := rows.Err(); err != nil {
		return nil, 0, err
	}
	rows.Close()
	if len(out) == 0 {
		return []model.Summary{}, total, nil
	}
	idx := map[int64]int{}
	ids := make([]any, len(out))
	for i, sm := range out {
		idx[sm.ID] = i
		ids[i] = sm.ID
	}
	in := "(" + strings.TrimSuffix(strings.Repeat("?,", len(ids)), ",") + ")"
	lrows, err := linesTable.Select(ctx, s.DB, "WHERE document_id IN "+in+" ORDER BY document_id, position", ids...)
	if err != nil {
		return nil, 0, err
	}
	for _, l := range lrows {
		i := idx[l.DocumentID]
		shells[i].Lines = append(shells[i].Lines, l.toLine())
	}
	prows, err := s.DB.QueryContext(ctx, "SELECT document_id, CASE WHEN kind = 'refund' THEN -amount_cents ELSE amount_cents END FROM payments WHERE document_id IN "+in, ids...)
	if err != nil {
		return nil, 0, err
	}
	defer prows.Close()
	for prows.Next() {
		var id, amt int64
		if err := prows.Scan(&id, &amt); err != nil {
			return nil, 0, err
		}
		out[idx[id]].PaidCents += amt
	}
	for i := range out {
		out[i].TotalCents = money.Compute(&shells[i]).TotalCents
		out[i].ReceivedCents = out[i].PaidCents
		out[i].PaidCents += out[i].CreditedCents
	}
	return out, total, prows.Err()
}

// ---- numbering -------------------------------------------------------------

// NextNumber suggests the number for the next document of a kind from an
// issuer: one more than the highest number already used with the same prefix
// and suffix, keeping any zero padding.
func (s *Store) NextNumber(ctx context.Context, q db.Queryer, issuerID int64, kind, prefix, suffix string) (string, error) {
	rows, err := q.QueryContext(ctx, `SELECT number FROM documents WHERE issuer_id = ? AND kind = ? AND number_prefix = ? AND number_suffix = ?`,
		issuerID, kind, prefix, suffix)
	if err != nil {
		return "", err
	}
	defer rows.Close()
	var max int64
	width := 1
	for rows.Next() {
		var num string
		if err := rows.Scan(&num); err != nil {
			return "", err
		}
		n, err := strconv.ParseInt(num, 10, 64)
		if err != nil || n < 0 {
			continue
		}
		if n >= max {
			max = n
			if strings.HasPrefix(num, "0") {
				width = len(num)
			} else {
				width = 1
			}
		}
	}
	next := strconv.FormatInt(max+1, 10)
	for len(next) < width {
		next = "0" + next
	}
	return next, rows.Err()
}

// DefaultAffixes returns the prefix and suffix configured for a kind.
func (s *Store) DefaultAffixes(ctx context.Context, q db.Queryer, kind string) (prefix, suffix string, err error) {
	set, err := s.GetSettings(ctx, q)
	if err != nil {
		return "", "", err
	}
	if kind == model.KindQuote {
		return set.QuotePrefix, "", nil
	}
	return set.InvoicePrefix, set.InvoiceSuffix, nil
}

// ---- writing ---------------------------------------------------------------

// SaveOptions control how a document is saved.
type SaveOptions struct {
	// RefreshDetails re-copies the issuer, customer, bank, currency and style
	// from the live records even when they did not change.
	RefreshDetails bool
	// Internal lets the caller set the fields only the store controls (document type, lock, credits). Used by
	// corrections and issuing, never by what arrives over the API.
	Internal bool
}

func party(ctx context.Context, q db.Queryer, id int64, kind string) (model.Party, error) {
	p, err := Parties.Get(ctx, q, id)
	if errors.Is(err, db.ErrNotFound) || (err == nil && p.Kind != kind) {
		return p, invalid("%s %d does not exist", kind, id)
	}
	return p, err
}

// prepare validates a document and fills its snapshots, number and status.
// old is the stored version when updating.
func (s *Store) prepare(ctx context.Context, q db.Queryer, d *model.Document, old *model.Document, opt SaveOptions) (docRow, error) {
	if d.Kind != model.KindInvoice && d.Kind != model.KindQuote {
		return docRow{}, invalid("kind must be invoice or quote")
	}
	if old != nil && old.Kind != d.Kind {
		return docRow{}, invalid("a document cannot change kind")
	}
	if !opt.Internal {
		// These belong to the store. A new document starts unlocked and uncorrected; an existing one keeps what it has.
		d.DocType, d.Corrects, d.Locked, d.IssuedAt, d.CreditedCents = "", nil, false, "", 0
		if old != nil {
			d.DocType, d.Corrects, d.Locked, d.IssuedAt, d.CreditedCents = old.DocType, old.Corrects, old.Locked, old.IssuedAt, old.CreditedCents
		}
	}
	if old != nil && old.Locked && !opt.Internal {
		if err := lockedChange(*old, *d); err != nil {
			return docRow{}, err
		}
		opt.RefreshDetails = false
	}
	if d.DocType != "" && d.DocType != "credit" && d.DocType != "debit" {
		return docRow{}, invalid("unknown document type")
	}
	if d.SupplyDate != "" && !validDate(d.SupplyDate) {
		return docRow{}, invalid("supplyDate must be a date like 2026-10-12")
	}
	d.SettlementCurrency = strings.ToUpper(strings.TrimSpace(d.SettlementCurrency))
	if d.SettlementCurrency != "" {
		if len(d.SettlementCurrency) != 3 {
			return docRow{}, invalid("the settlement currency must be a three-letter code")
		}
		if d.ExchangeRate <= 0 {
			return docRow{}, invalid("give the exchange rate for the settlement currency")
		}
		if d.ExchangeDate != "" && !validDate(d.ExchangeDate) {
			return docRow{}, invalid("exchangeDate must be a date like 2026-10-12")
		}
	} else {
		d.ExchangeRate, d.ExchangeDate = 0, ""
	}
	if !validDate(d.IssuedOn) {
		return docRow{}, invalid("issuedOn must be a date like 2026-10-12")
	}
	if d.DueOn != "" && !validDate(d.DueOn) {
		return docRow{}, invalid("dueOn must be a date like 2026-10-12")
	}
	if len(d.Lines) == 0 {
		return docRow{}, invalid("add at least one line")
	}
	for i, l := range d.Lines {
		if strings.TrimSpace(l.Name) == "" {
			return docRow{}, invalid("line %d needs a name", i+1)
		}
		if l.Quantity <= 0 || l.UnitCents < 0 || l.TaxRate < 0 {
			return docRow{}, invalid("line %d has an invalid quantity, price or tax rate", i+1)
		}
		if l.TaxMode != "" && l.TaxMode != "add" && l.TaxMode != "included" {
			return docRow{}, invalid("line %d: tax mode must be add or included", i+1)
		}
		switch l.TaxCategory {
		case "":
		case "exempt", "zero", "reverse_charge", "export":
			// A line that is exempt, zero-rated, reverse-charged or exported charges no tax, whatever rate was typed.
			d.Lines[i].TaxRate, d.Lines[i].TaxMode = 0, ""
		default:
			return docRow{}, invalid("line %d: tax category must be exempt, zero, reverse_charge or export", i+1)
		}
		switch l.LineType {
		case "", "service", "product", "shipping", "expense", "time":
		default:
			return docRow{}, invalid("line %d: unknown line type", i+1)
		}
	}
	for _, a := range []struct {
		name string
		v    model.Adjustment
	}{{"discount", d.Discount}, {"surcharge", d.Surcharge}} {
		switch a.v.Mode {
		case "", "fixed", "percent":
		default:
			return docRow{}, invalid("%s mode must be fixed or percent", a.name)
		}
		if a.v.Cents < 0 || a.v.Percent < 0 || a.v.Percent > 100 {
			return docRow{}, invalid("%s is out of range", a.name)
		}
	}
	switch d.TaxMode {
	case "", "add", "included", "withheld":
	default:
		return docRow{}, invalid("tax mode must be add, included or withheld")
	}
	if d.ShippingCents < 0 || d.TaxRate < 0 {
		return docRow{}, invalid("shipping and tax rate cannot be negative")
	}
	if d.Kind == model.KindQuote && len(d.Payments) > 0 {
		return docRow{}, invalid("quotes cannot have payments")
	}
	for i, p := range d.Payments {
		if p.AmountCents <= 0 || !validDate(p.PaidOn) {
			return docRow{}, invalid("each payment needs a positive amount and a date")
		}
		switch p.Kind {
		case "":
			d.Payments[i].Kind = "payment"
		case "payment", "refund":
		default:
			return docRow{}, invalid("a payment is a payment or a refund")
		}
	}
	if money.Received(d) < 0 {
		return docRow{}, invalid("refunds cannot be more than the payments received")
	}
	if d.Status == model.StatusDraft {
		if d.Kind != model.KindInvoice || d.DocType != "" {
			return docRow{}, invalid("only an ordinary invoice can be a draft")
		}
		if len(d.Payments) > 0 {
			return docRow{}, invalid("a draft cannot have payments; issue it first")
		}
		if d.Locked {
			return docRow{}, invalid("an issued invoice cannot go back to draft")
		}
	}

	row := toRow(*d)
	issuer, err := party(ctx, q, d.IssuerID, "issuer")
	if err != nil {
		return row, err
	}
	customer, err := party(ctx, q, d.CustomerID, "customer")
	if err != nil {
		return row, err
	}
	cur, err := Currencies.Get(ctx, q, d.CurrencyID)
	if err != nil {
		return row, invalid("currency %d does not exist", d.CurrencyID)
	}
	// Keep the stored copy of anything that did not change, so documents that
	// were already sent do not change when a record is edited later.
	keep := func(changed bool, stored string) bool {
		return old != nil && !changed && !opt.RefreshDetails && stored != ""
	}
	if old != nil {
		oldRow, _ := docs.Get(ctx, q, old.ID)
		row.IssuerSnap, row.CustomerSnap, row.CurrencySnap, row.BankSnap, row.StyleSnap =
			oldRow.IssuerSnap, oldRow.CustomerSnap, oldRow.CurrencySnap, oldRow.BankSnap, oldRow.StyleSnap
		if !keep(old.IssuerID != d.IssuerID, oldRow.IssuerSnap) {
			row.IssuerSnap = snap(issuer)
		}
		if !keep(old.CustomerID != d.CustomerID, oldRow.CustomerSnap) {
			row.CustomerSnap = snap(customer)
		}
		if !keep(old.CurrencyID != d.CurrencyID, oldRow.CurrencySnap) {
			row.CurrencySnap = snap(cur)
		}
	} else {
		row.IssuerSnap, row.CustomerSnap, row.CurrencySnap = snap(issuer), snap(customer), snap(cur)
	}
	if d.BankID != nil {
		b, err := Banks.Get(ctx, q, *d.BankID)
		if err != nil {
			return row, invalid("bank account %d does not exist", *d.BankID)
		}
		if old == nil || opt.RefreshDetails || old.BankID == nil || *old.BankID != *d.BankID {
			row.BankSnap = snap(b)
		}
	} else {
		row.BankSnap = "{}"
	}
	if d.StyleID != nil {
		st, err := Styles.Get(ctx, q, *d.StyleID)
		if err != nil {
			return row, invalid("style %d does not exist", *d.StyleID)
		}
		if old == nil || opt.RefreshDetails || old.StyleID == nil || *old.StyleID != *d.StyleID {
			row.StyleSnap = snap(st)
		}
	} else {
		row.StyleSnap = "{}"
	}
	if row.IssuerSnap == "" {
		row.IssuerSnap = "{}"
	}

	// Status follows the payments for invoices; quotes are set by hand.
	if d.Kind == model.KindInvoice {
		if d.Status != "" && d.Status != model.StatusVoid && d.Status != model.StatusUnpaid && d.Status != model.StatusPartial && d.Status != model.StatusPaid &&
			d.Status != model.StatusDraft && d.Status != model.StatusCredited && d.Status != model.StatusCredit {
			return row, invalid("invoice status must be draft, unpaid, partial, paid or void")
		}
		tmp := *d
		switch {
		case d.DocType == "credit":
			row.Status = model.StatusCredit
		case d.Status == model.StatusDraft:
			row.Status = model.StatusDraft
		default:
			row.Status = money.InvoiceStatusFull(d.Status, money.Compute(&tmp).TotalCents, money.Paid(&tmp), tmp.CreditedCents)
		}
	} else {
		switch d.Status {
		case "":
			row.Status = model.StatusOpen
		case model.StatusOpen, model.StatusAccepted, model.StatusDeclined:
			row.Status = d.Status
		default:
			return row, invalid("quote status must be open, accepted or declined")
		}
	}
	if row.NumberPrefix+row.Number+row.NumberSuffix == "" || strings.TrimSpace(row.Number) == "" {
		prefix, suffix, err := s.DefaultAffixes(ctx, q, d.Kind)
		if err != nil {
			return row, err
		}
		n, err := s.NextNumber(ctx, q, d.IssuerID, d.Kind, prefix, suffix)
		if err != nil {
			return row, err
		}
		row.NumberPrefix, row.Number, row.NumberSuffix = prefix, n, suffix
	}
	return row, nil
}

func (s *Store) writeChildren(ctx context.Context, tx *sql.Tx, id int64, d *model.Document) error {
	if _, err := tx.ExecContext(ctx, `DELETE FROM document_lines WHERE document_id = ?`, id); err != nil {
		return err
	}
	for i, l := range d.Lines {
		r := lineRow{DocumentID: id, Position: i + 1, ProductID: l.ProductID, Name: strings.TrimSpace(l.Name), Unit: l.Unit,
			Quantity: l.Quantity, UnitCents: l.UnitCents, TaxRate: l.TaxRate, TaxMode: l.TaxMode,
			Code: strings.TrimSpace(l.Code), TaxCode: strings.TrimSpace(l.TaxCode), Period: strings.TrimSpace(l.Period), LineType: l.LineType, TaxCategory: l.TaxCategory}
		if err := linesTable.Insert(ctx, tx, &r); err != nil {
			return err
		}
	}
	if _, err := tx.ExecContext(ctx, `DELETE FROM payments WHERE document_id = ?`, id); err != nil {
		return err
	}
	for _, p := range d.Payments {
		p.ID, p.DocumentID = 0, id
		if err := payments.Insert(ctx, tx, &p); err != nil {
			return err
		}
	}
	if d.Attachments != nil {
		if _, err := tx.ExecContext(ctx, `DELETE FROM attachments WHERE document_id = ?`, id); err != nil {
			return err
		}
		for _, a := range d.Attachments {
			if a.Name == "" || len(a.Data) == 0 {
				continue
			}
			a.ID, a.DocumentID = 0, id
			if err := attachmentsTable.Insert(ctx, tx, &a); err != nil {
				return err
			}
		}
	}
	return nil
}

// CreateDocument validates and stores a new document.
func (s *Store) CreateDocument(ctx context.Context, d model.Document, opt SaveOptions) (model.Document, error) {
	var id int64
	err := db.WithTx(ctx, s.DB, func(tx *sql.Tx) error {
		row, err := s.prepare(ctx, tx, &d, nil, opt)
		if err != nil {
			return err
		}
		row.ID = 0
		if err := docs.Insert(ctx, tx, &row); err != nil {
			return err
		}
		id = row.ID
		return s.writeChildren(ctx, tx, id, &d)
	})
	if err != nil {
		return model.Document{}, wrapDup(err)
	}
	return s.GetDocument(ctx, s.DB, id)
}

// UpdateDocument replaces a document's contents.
func (s *Store) UpdateDocument(ctx context.Context, id int64, d model.Document, opt SaveOptions) (model.Document, error) {
	err := db.WithTx(ctx, s.DB, func(tx *sql.Tx) error {
		old, err := s.GetDocument(ctx, tx, id)
		if err != nil {
			return err
		}
		d.ID = id
		if strings.TrimSpace(d.Number) == "" { // not sent: keep the number the document has
			d.NumberPrefix, d.Number, d.NumberSuffix = old.NumberPrefix, old.Number, old.NumberSuffix
		}
		row, err := s.prepare(ctx, tx, &d, &old, opt)
		if err != nil {
			return err
		}
		row.ID, row.CreatedAt = id, old.CreatedAt
		row.ConvertedFrom = old.ConvertedFrom
		if err := docs.Update(ctx, tx, &row); err != nil {
			return err
		}
		return s.writeChildren(ctx, tx, id, &d)
	})
	if err != nil {
		return model.Document{}, wrapDup(err)
	}
	return s.GetDocument(ctx, s.DB, id)
}

func wrapDup(err error) error {
	if errors.Is(err, db.ErrConflict) && strings.Contains(err.Error(), "documents.") {
		return Validation{"a " + "document with this number already exists for this issuer"}
	}
	return err
}

// DeleteDocument removes a document and, through cascades, its lines and payments.
func (s *Store) DeleteDocument(ctx context.Context, id int64) error {
	if row, err := docs.Get(ctx, s.DB, id); err == nil && row.Locked {
		return fmt.Errorf("%w: an issued invoice cannot be deleted; void it, or issue a credit note", ErrLocked)
	}
	return docs.Delete(ctx, s.DB, id)
}

// Duplicate copies a document as a new one: next number, today's date, no payments.
func (s *Store) Duplicate(ctx context.Context, id int64) (model.Document, error) {
	src, err := s.GetDocument(ctx, s.DB, id)
	if err != nil {
		return model.Document{}, err
	}
	nd := src
	nd.ID, nd.Number, nd.Payments, nd.Attachments, nd.ConvertedFrom = 0, "", nil, nil, nil
	nd.IssuedOn = s.Today()
	if src.DueOn != "" && validDate(src.IssuedOn) && validDate(src.DueOn) {
		a, _ := time.Parse("2006-01-02", src.IssuedOn)
		b, _ := time.Parse("2006-01-02", src.DueOn)
		nd.DueOn = s.now().UTC().Add(b.Sub(a)).Format("2006-01-02")
	}
	nd.Status = ""
	return s.CreateDocument(ctx, nd, SaveOptions{RefreshDetails: true})
}

// Convert turns a quote into an invoice and marks the quote accepted.
func (s *Store) Convert(ctx context.Context, id int64) (model.Document, error) {
	var out model.Document
	err := db.WithTx(ctx, s.DB, func(tx *sql.Tx) error {
		q, err := s.GetDocument(ctx, tx, id)
		if err != nil {
			return err
		}
		if q.Kind != model.KindQuote {
			return invalid("only a quote can be converted")
		}
		var n int
		if err := tx.QueryRowContext(ctx, `SELECT COUNT(*) FROM documents WHERE converted_from = ?`, id).Scan(&n); err != nil {
			return err
		}
		if n > 0 {
			return Validation{"this quote was already converted"}
		}
		inv := q
		inv.ID, inv.Kind, inv.Number, inv.Payments, inv.Attachments, inv.Status = 0, model.KindInvoice, "", nil, nil, ""
		inv.IssuedOn = s.Today()
		inv.ConvertedFrom = &id
		prefix, suffix, err := s.DefaultAffixes(ctx, tx, model.KindInvoice)
		if err != nil {
			return err
		}
		inv.NumberPrefix, inv.NumberSuffix = prefix, suffix
		row, err := s.prepare(ctx, tx, &inv, nil, SaveOptions{})
		if err != nil {
			return err
		}
		row.ID, row.ConvertedFrom = 0, &id
		// Keep the quote's copies of the parties: what the customer agreed to.
		qrow, _ := docs.Get(ctx, tx, id)
		row.IssuerSnap, row.CustomerSnap, row.CurrencySnap = qrow.IssuerSnap, qrow.CustomerSnap, qrow.CurrencySnap
		if err := docs.Insert(ctx, tx, &row); err != nil {
			return err
		}
		if err := s.writeChildren(ctx, tx, row.ID, &inv); err != nil {
			return err
		}
		if _, err := tx.ExecContext(ctx, `UPDATE documents SET status = 'accepted', updated_at = ? WHERE id = ?`, db.Now(), id); err != nil {
			return err
		}
		out, err = s.GetDocument(ctx, tx, row.ID)
		return err
	})
	return out, wrapDup(err)
}

// ---- reports ---------------------------------------------------------------

// ReportRow is one line of a report: billed and paid for a month or a customer in one currency.
type ReportRow struct {
	Label            string `json:"label"`
	Currency         string `json:"currency"`
	CurrencyDecimals int    `json:"currencyDecimals"`
	Count            int    `json:"count"`
	BilledCents      int64  `json:"billedCents"`
	PaidCents        int64  `json:"paidCents"`
}

// Report is the yearly summary of invoices (void ones excluded).
type Report struct {
	Year       string      `json:"year"`
	Years      []string    `json:"years"`
	ByMonth    []ReportRow `json:"byMonth"`
	ByCustomer []ReportRow `json:"byCustomer"`
}

// YearReport totals invoices issued in a year by month and by customer.
func (s *Store) YearReport(ctx context.Context, year string) (Report, error) {
	rep := Report{Year: year, Years: []string{}, ByMonth: []ReportRow{}, ByCustomer: []ReportRow{}}
	list, _, err := s.ListDocuments(ctx, Filter{Kind: model.KindInvoice})
	if err != nil {
		return rep, err
	}
	yrs := map[string]bool{}
	byMonth, byCust := map[string]*ReportRow{}, map[string]*ReportRow{}
	bump := func(m map[string]*ReportRow, label string, sm model.Summary) {
		key := label + "|" + sm.CurrencyCode
		r := m[key]
		if r == nil {
			r = &ReportRow{Label: label, Currency: sm.CurrencyCode, CurrencyDecimals: sm.CurrencyScale}
			m[key] = r
		}
		r.Count++
		r.BilledCents += sm.TotalCents
		r.PaidCents += sm.PaidCents
	}
	for _, sm := range list {
		if sm.Status == model.StatusVoid || sm.Status == model.StatusDraft || len(sm.IssuedOn) < 7 {
			continue
		}
		// A credit note takes away from what was billed; "paid" means money actually received, not credits.
		if sm.DocType == "credit" {
			sm.TotalCents = -sm.TotalCents
		}
		sm.PaidCents = sm.ReceivedCents
		yrs[sm.IssuedOn[:4]] = true
		if sm.IssuedOn[:4] != year {
			continue
		}
		bump(byMonth, sm.IssuedOn[:7], sm)
		bump(byCust, sm.CustomerName, sm)
	}
	for y := range yrs {
		rep.Years = append(rep.Years, y)
	}
	sort.Sort(sort.Reverse(sort.StringSlice(rep.Years)))
	flat := func(m map[string]*ReportRow, less func(a, b ReportRow) bool) []ReportRow {
		out := []ReportRow{}
		for _, r := range m {
			out = append(out, *r)
		}
		sort.Slice(out, func(i, j int) bool { return less(out[i], out[j]) })
		return out
	}
	rep.ByMonth = flat(byMonth, func(a, b ReportRow) bool { return a.Label < b.Label || (a.Label == b.Label && a.Currency < b.Currency) })
	rep.ByCustomer = flat(byCust, func(a, b ReportRow) bool { return a.BilledCents > b.BilledCents })
	return rep, nil
}
