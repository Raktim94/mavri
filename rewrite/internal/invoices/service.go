package invoices

import (
	"context"
	"database/sql"
	"encoding/json"
	"errors"
	"fmt"
	"strconv"
	"strings"
	"time"

	"github.com/Raktim94/nodedr-invoice/rewrite/internal/entity"
)

// Row is a request or response object.
type Row = entity.Row

// Service reads and writes invoices.
type Service struct {
	Repo entity.Repo
	Now  func() time.Time
}

var allTables = []string{"invoices", "invoice_currency_snapshots", "invoice_client_snapshots", "invoice_bank_snapshots",
	"invoice_business_snapshots", "invoice_style_profile_snapshots", "invoice_customizations", "invoice_layout_snapshots",
	"invoice_item_snapshots", "invoice_payments", "invoice_items", "attachments", "invoice_sequences", "currencies"}

func (s *Service) now() time.Time {
	if s.Now != nil {
		return s.Now()
	}
	return time.Now()
}

// failure keeps the stable key of a database error but drops its message.
func keyOnly(err error) error { return &entity.Failure{Key: entity.MapError(err).Key} }

func notFound() error { return &entity.Failure{Key: "error.invoiceNotFound"} }

// ---- small value helpers ---------------------------------------------------

func asInt(v any) (int64, bool) {
	switch n := v.(type) {
	case json.Number:
		i, err := n.Int64()
		return i, err == nil
	case int64:
		return n, true
	case int:
		return int64(n), true
	case float64:
		return int64(n), true
	case string:
		i, err := strconv.ParseInt(strings.TrimSpace(n), 10, 64)
		return i, err == nil
	}
	return 0, false
}

func asString(v any) string {
	if s, ok := v.(string); ok {
		return s
	}
	return ""
}

func child(row Row, key string) Row {
	if c, ok := row[key].(Row); ok {
		return c
	}
	return nil
}

func children(row Row, key string) []Row {
	if c, ok := row[key].([]Row); ok {
		return c
	}
	return nil
}

func clone(r Row) Row {
	out := make(Row, len(r)+4)
	for k, v := range r {
		out[k] = v
	}
	return out
}

// PrepareRequest applies what the HTTP layer always did to a request body: an
// absent customization, business snapshot or bank snapshot becomes an object
// of nulls rather than staying absent. Orders built inside the server skip it.
func PrepareRequest(row Row) Row {
	for _, key := range []string{"invoiceCustomization", "invoiceBusinessSnapshot", "invoiceBankSnapshot"} {
		if child(row, key) == nil {
			row[key] = Row{}
		}
	}
	return row
}

// ---- reading -----------------------------------------------------------------

type readOptions struct {
	ID      *int64
	Type    string
	Filters []entity.Filter
	// HasFilter is false when the filter query was missing or unparsable.
	HasFilter bool
	ClientID  *int64
}

func (s *Service) invoicesWhere(o readOptions) (string, []any) {
	var conds []string
	var args []any
	if o.ID != nil && *o.ID != 0 {
		conds, args = append(conds, `i."id" = ?`), append(args, *o.ID)
	}
	if o.Type != "" {
		conds, args = append(conds, `i."invoiceType" = ?`), append(args, o.Type)
	}
	if o.ClientID != nil {
		conds, args = append(conds, `i."clientId" = ?`), append(args, *o.ClientID)
	}
	for _, f := range o.Filters {
		switch f.Type {
		case "Active":
			conds = append(conds, `i."isArchived" = 0`)
		case "Archived":
			conds = append(conds, `i."isArchived" = 1`)
		case "Client":
			if f.Value != "" {
				conds, args = append(conds, `ics."clientName" = ?`), append(args, f.Value)
			}
		case "Business":
			if f.Value != "" {
				conds, args = append(conds, `ibs."businessName" = ?`), append(args, f.Value)
			}
		case "Date":
			if parts := strings.Split(f.Value, ","); f.Value != "" && len(parts) == 2 {
				conds, args = append(conds, `i."issuedAt" BETWEEN ? AND ?`), append(args, parts[0], parts[1])
			}
		case "Status":
			if f.Value != "" {
				conds, args = append(conds, `i."status" = ?`), append(args, f.Value)
			}
		}
	}
	if len(conds) == 0 {
		return "", nil
	}
	return "WHERE " + strings.Join(conds, " AND "), args
}

func placeholders(n int) string {
	if n == 0 {
		return ""
	}
	return strings.TrimSuffix(strings.Repeat("?, ", n), ", ")
}

func idArgs(ids []int64) []any {
	out := make([]any, len(ids))
	for i, v := range ids {
		out[i] = v
	}
	return out
}

func groupBy(rows []Row, key string) map[int64][]Row {
	out := map[int64][]Row{}
	for _, r := range rows {
		if id, ok := asInt(r[key]); ok {
			out[id] = append(out[id], r)
		}
	}
	return out
}

func first(m map[int64][]Row, id int64) (Row, bool) {
	if l := m[id]; len(l) > 0 {
		return l[0], true
	}
	return nil, false
}

// read returns invoices with everything attached, newest first. Invoices
// without a business or client snapshot do not appear, as before.
func (s *Service) read(ctx context.Context, q entity.Queryer, o readOptions) ([]Row, error) {
	cols, err := s.Repo.PlainColumns(ctx, "invoices", "i")
	if err != nil {
		return nil, err
	}
	where, args := s.invoicesWhere(o)
	rows, err := q.QueryContext(ctx, `SELECT `+cols+`, c."format" AS "currencyFormat"
FROM invoices i
INNER JOIN currencies AS c ON c."id" = i."currencyId"
INNER JOIN invoice_business_snapshots AS ibs ON ibs."parentInvoiceId" = i."id"
INNER JOIN invoice_client_snapshots AS ics ON ics."parentInvoiceId" = i."id"
`+where+` ORDER BY i."createdAt" DESC`, args...)
	if err != nil {
		return nil, err
	}
	invoices, err := invoice.Convert(rows)
	rows.Close()
	if err != nil {
		return nil, err
	}
	if len(invoices) == 0 {
		return []Row{}, nil
	}
	ids := make([]int64, len(invoices))
	for i, inv := range invoices {
		ids[i], _ = asInt(inv["id"])
	}
	in := fmt.Sprintf(`WHERE t."parentInvoiceId" IN (%s)`, placeholders(len(ids)))
	load := func(spec *entity.Spec) (map[int64][]Row, []Row, error) {
		got, err := s.Repo.SelectWith(ctx, q, spec, in, idArgs(ids)...)
		return groupBy(got, "parentInvoiceId"), got, err
	}
	var payments, items, attachments, businessSnaps, clientSnaps, currencySnaps, customizations, styleSnaps, bankSnaps, layoutSnaps map[int64][]Row
	var itemRows []Row
	for _, l := range []struct {
		spec *entity.Spec
		into *map[int64][]Row
		keep *[]Row
	}{
		{payment, &payments, nil}, {lineItem, &items, &itemRows}, {attachment, &attachments, nil},
		{businessSnap, &businessSnaps, nil}, {clientSnap, &clientSnaps, nil}, {currencySnap, &currencySnaps, nil},
		{customization, &customizations, nil}, {styleSnap, &styleSnaps, nil}, {bankSnap, &bankSnaps, nil},
		{layoutSnap, &layoutSnaps, nil},
	} {
		m, all, err := load(l.spec)
		if err != nil {
			return nil, err
		}
		*l.into = m
		if l.keep != nil {
			*l.keep = all
		}
	}
	itemIDs := make([]int64, 0, len(itemRows))
	for _, it := range itemRows {
		id, _ := asInt(it["id"])
		itemIDs = append(itemIDs, id)
	}
	snapRows, err := s.Repo.SelectWith(ctx, q, itemSnap,
		fmt.Sprintf(`WHERE t."parentInvoiceItemId" IN (%s)`, placeholders(len(itemIDs))), idArgs(itemIDs)...)
	if err != nil {
		return nil, err
	}
	itemSnaps := groupBy(snapRows, "parentInvoiceItemId")

	out := make([]Row, 0, len(invoices))
	for _, inv := range invoices {
		id, _ := asInt(inv["id"])
		r := clone(inv)
		r["invoicePayments"] = orEmpty(payments[id])
		lines := []Row{}
		for _, it := range items[id] {
			line := clone(it)
			itemID, _ := asInt(it["id"])
			if snap, ok := first(itemSnaps, itemID); ok {
				line["invoiceItemSnapshot"] = snap
			}
			lines = append(lines, line)
		}
		r["invoiceItems"] = lines
		r["invoiceAttachments"] = orEmpty(attachments[id])
		for key, m := range map[string]map[int64][]Row{
			"invoiceBankSnapshot": bankSnaps, "invoiceBusinessSnapshot": businessSnaps,
			"invoiceClientSnapshot": clientSnaps, "invoiceCurrencySnapshot": currencySnaps,
			"invoiceCustomization": customizations, "invoiceLayoutSnapshot": layoutSnaps,
			"invoiceStyleProfileSnapshot": styleSnaps,
		} {
			if v, ok := first(m, id); ok {
				r[key] = v
			}
		}
		out = append(out, r)
	}
	return out, nil
}

func orEmpty(l []Row) []Row {
	if l == nil {
		return []Row{}
	}
	return l
}

// List returns invoices of one type (or all), filtered.
func (s *Service) List(ctx context.Context, typ string, filters []entity.Filter, hasFilter bool) ([]Row, error) {
	if err := s.Repo.Warm(ctx, allTables...); err != nil {
		return nil, err
	}
	return s.read(ctx, s.Repo.DB, readOptions{Type: typ, Filters: filters, HasFilter: hasFilter})
}

func (s *Service) one(ctx context.Context, q entity.Queryer, id int64) (any, error) {
	got, err := s.read(ctx, q, readOptions{ID: &id})
	if err != nil {
		return nil, err
	}
	if len(got) > 0 {
		return got[0], nil
	}
	return []Row{}, nil // what the old server answered when the invoice could not be read back
}

// ---- numbering -----------------------------------------------------------------

const maxSafeInt = 9007199254740991

type numbered struct {
	value int64
	width int
}

func parseNumeric(v string) (numbered, bool) {
	n := strings.TrimSpace(v)
	if n == "" {
		return numbered{}, false
	}
	for _, c := range n {
		if c < '0' || c > '9' {
			return numbered{}, false
		}
	}
	val, err := strconv.ParseUint(n, 10, 64)
	if err != nil || val > maxSafeInt {
		return numbered{}, false
	}
	return numbered{int64(val), len(n)}, true
}

func formatWidth(n int64, width int) string {
	raw := strconv.FormatInt(n, 10)
	if width <= len(raw) {
		return raw
	}
	return strings.Repeat("0", width-len(raw)) + raw
}

func scopeStats(ctx context.Context, q entity.Queryer, businessID, clientID int64, typ string) (maxVal int64, maxWidth int, err error) {
	rows, err := q.QueryContext(ctx, `SELECT "invoiceNumber" FROM invoices WHERE "businessId" = ? AND "clientId" = ? AND "invoiceType" = ?`,
		businessID, clientID, typ)
	if err != nil {
		return 0, 0, err
	}
	defer rows.Close()
	for rows.Next() {
		var num sql.NullString
		if err := rows.Scan(&num); err != nil {
			return 0, 0, err
		}
		if p, ok := parseNumeric(num.String); ok {
			if p.value > maxVal {
				maxVal = p.value
			}
			if p.width > maxWidth {
				maxWidth = p.width
			}
		}
	}
	return maxVal, maxWidth, rows.Err()
}

type seqRow struct {
	id, businessID, clientID, next int64
	typ                            string
}

func (s *Service) sequenceFor(ctx context.Context, q entity.Queryer, businessID, clientID int64, typ string) (*seqRow, error) {
	var r seqRow
	var next any
	err := q.QueryRowContext(ctx, `SELECT "id","businessId","clientId","nextSequence","invoiceType" FROM invoice_sequences WHERE "businessId" = ? and "clientId" = ? and "invoiceType" = ?`,
		businessID, clientID, typ).Scan(&r.id, &r.businessID, &r.clientID, &next, &r.typ)
	if errors.Is(err, sql.ErrNoRows) {
		return nil, nil
	}
	if err != nil {
		return nil, err
	}
	r.next, _ = asInt(sqlValue(next))
	return &r, nil
}

func sqlValue(v any) any {
	if b, ok := v.([]byte); ok {
		return string(b)
	}
	return v
}

func (s *Service) writeSequence(ctx context.Context, tx *sql.Tx, row Row, update bool) error {
	_, err := s.Repo.Write(ctx, tx, sequence, row, update, false)
	return err
}

func (s *Service) scopedNext(ctx context.Context, q entity.Queryer, businessID, clientID int64, number, typ string) (next int64, padding int, err error) {
	maxVal, maxWidth, err := scopeStats(ctx, q, businessID, clientID, typ)
	if err != nil {
		return 0, 0, err
	}
	fromInput := int64(1)
	inputWidth := 0
	if p, ok := parseNumeric(number); ok {
		fromInput, inputWidth = p.value+1, p.width
	}
	next = maxVal + 1
	if fromInput > next {
		next = fromInput
	}
	if next < 1 {
		next = 1
	}
	padding = maxWidth
	if inputWidth > padding {
		padding = inputWidth
	}
	return next, padding, nil
}

func (s *Service) processSequence(ctx context.Context, tx *sql.Tx, businessID, clientID int64, number, typ string) error {
	cur, err := s.sequenceFor(ctx, tx, businessID, clientID, typ)
	if err != nil {
		return err
	}
	if cur != nil {
		return s.writeSequence(ctx, tx, Row{"id": cur.id, "businessId": cur.businessID, "clientId": cur.clientID,
			"nextSequence": cur.next + 1, "invoiceType": cur.typ}, true)
	}
	next, _, err := s.scopedNext(ctx, tx, businessID, clientID, number, typ)
	if err != nil {
		return err
	}
	return s.writeSequence(ctx, tx, Row{"businessId": businessID, "clientId": clientID, "nextSequence": next, "invoiceType": typ}, false)
}

func (s *Service) processSequenceOnUpdate(ctx context.Context, tx *sql.Tx, prevNumber string, prevClient, prevBusiness int64,
	number string, clientID, businessID int64, typ string) error {
	if prevNumber == number && prevClient == clientID && prevBusiness == businessID {
		return nil
	}
	p, ok := parseNumeric(number)
	if !ok {
		return nil
	}
	cur, err := s.sequenceFor(ctx, tx, businessID, clientID, typ)
	if err != nil {
		return err
	}
	desired := p.value + 1
	if cur != nil {
		if cur.next >= desired {
			return nil
		}
		return s.writeSequence(ctx, tx, Row{"id": cur.id, "businessId": cur.businessID, "clientId": cur.clientID,
			"nextSequence": desired, "invoiceType": typ}, true)
	}
	return s.writeSequence(ctx, tx, Row{"businessId": businessID, "clientId": clientID, "nextSequence": desired, "invoiceType": typ}, false)
}

// NextSequence is the number the next invoice of this client and business
// would get, nil when no invoice was ever numbered in that scope.
func (s *Service) NextSequence(ctx context.Context, businessID, clientID any, typ string) (Row, error) {
	if err := s.Repo.Warm(ctx, allTables...); err != nil {
		return nil, err
	}
	var next any
	err := s.Repo.DB.QueryRowContext(ctx, `SELECT "nextSequence" FROM invoice_sequences WHERE "businessId" = ? and "clientId" = ? and "invoiceType" = ?`,
		businessID, clientID, typ).Scan(&next)
	if errors.Is(err, sql.ErrNoRows) {
		return nil, nil
	}
	if err != nil {
		return nil, err
	}
	n, _ := asInt(sqlValue(next))
	var bID, cID int64
	bID, _ = asInt(businessID)
	cID, _ = asInt(clientID)
	_, width, err := scopeStats(ctx, s.Repo.DB, bID, cID, typ)
	if err != nil {
		return nil, err
	}
	return Row{"nextSequence": n, "formattedSequence": formatWidth(n, width)}, nil
}

// CustomHeaders lists the distinct custom column headers used on invoices or
// quotations.
func (s *Service) CustomHeaders(ctx context.Context, typ string) ([]Row, error) {
	rows, err := s.Repo.DB.QueryContext(ctx, `
    SELECT ii."customField"
      FROM invoice_items ii
      INNER JOIN invoices as i on i."id" = ii."parentInvoiceId"
      WHERE i."invoiceType" = ?
      GROUP BY ii."customField"`, typ)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	out := []Row{}
	seen := map[string]bool{}
	for rows.Next() {
		var raw sql.NullString
		if err := rows.Scan(&raw); err != nil {
			return nil, err
		}
		if !raw.Valid || raw.String == "" {
			continue
		}
		var f struct {
			Header    string          `json:"header"`
			SortOrder json.RawMessage `json:"sortOrder"`
			Alignment json.RawMessage `json:"alignment"`
		}
		if err := json.Unmarshal([]byte(raw.String), &f); err != nil {
			return nil, err
		}
		if seen[f.Header] {
			continue
		}
		seen[f.Header] = true
		meta := Row{"header": f.Header}
		if len(f.SortOrder) > 0 {
			meta["sortOrder"] = f.SortOrder
		}
		if len(f.Alignment) > 0 {
			meta["alignment"] = f.Alignment
		}
		out = append(out, meta)
	}
	return out, rows.Err()
}

// ---- delete ----------------------------------------------------------------------

// Delete removes an invoice; its snapshots, items and payments go with it.
func (s *Service) Delete(ctx context.Context, id int64) error {
	_, err := s.Repo.DB.ExecContext(ctx, `DELETE FROM invoices WHERE "id" = ?`, id)
	return err
}

func (s *Service) begin(ctx context.Context) (*sql.Tx, error) {
	if err := s.Repo.Warm(ctx, allTables...); err != nil {
		return nil, err
	}
	return s.Repo.DB.BeginTx(ctx, nil)
}
