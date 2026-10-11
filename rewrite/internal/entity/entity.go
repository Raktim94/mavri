// Package entity is the generic list/create/update/delete/batch engine behind
// the simple resource routes (banks, businesses, clients, currencies,
// categories, units, items). Each resource is a Spec; the engine does the SQL.
package entity

import (
	"context"
	"database/sql"
	"encoding/base64"
	"encoding/json"
	"errors"
	"fmt"
	"strconv"
	"strings"
	"sync"
)

// Row is one record as sent to the renderer.
type Row map[string]any

// Spec describes a resource.
type Spec struct {
	Table  string
	Fields []string // writable columns, in insert order
	Blobs  []string // columns sent as base64 text and stored as BLOB
	// Joins follows "FROM <table> t". InvAlias is the invoices alias used by
	// the "no invoices in N days" filters.
	Joins    string
	InvAlias string
	// InvoiceCount and QuotesCount are the SQL expressions for the two counters.
	InvoiceCount string
	QuotesCount  string
	// Extra adds select columns (e.g. joined names); GroupBy defaults to t."id".
	Extra   string
	GroupBy string
	// Defaults are applied to a row before saving when the key is absent or null.
	Defaults map[string]any
	// Prepare may adjust a row inside the batch transaction (e.g. resolve names).
	Prepare func(ctx context.Context, tx *sql.Tx, row Row) error
}

type column struct {
	name string
	text bool // DATE/TIME column read as text so it is returned exactly as stored
	// hasDefault marks NOT NULL columns with a default: when a request leaves
	// them out, the default applies instead of failing on NULL (the old server
	// failed here, so every client had to send every field).
	hasDefault bool
}

// Failure is an error carrying a stable key the renderer translates.
type Failure struct{ Key, Message string }

func (f *Failure) Error() string { return f.Key + ": " + f.Message }

// BooleanFields are columns the renderer expects as true/false. SQLite stores
// them as 0/1 and the old adapter converted by column name.
var BooleanFields = map[string]bool{
	"isDarkMode": true, "shouldIncludeYear": true, "shouldIncludeMonth": true, "shouldIncludeBusinessName": true,
	"quotesON": true, "reportsON": true, "styleProfilesON": true, "receiptPrintingOn": true, "presetsON": true,
	"isArchived": true, "taxExempt": true, "clientTaxExempt": true, "labelUpperCase": true,
	"styleProfileLabelUpperCase": true, "showQuantity": true, "showUnit": true, "showRowNo": true,
	"ublON": true, "xrechnungON": true, "styleProfileShowQuantity": true, "styleProfileShowUnit": true,
	"styleProfileShowRowNo": true,
}

var errorSnippets = []struct{ snippet, key string }{
	{"UNIQUE constraint failed", "error.invalidConstraintUnique"},
	{"FOREIGN KEY constraint failed", "error.invalidConstraintForeign"},
	{"CHECK constraint failed", "error.invalidConstraintCheck"},
	{"NOT NULL constraint failed", "error.invalidConstraintNotNull"},
	{"datatype mismatch", "error.datatypeMismatch"},
	{"database is locked", "error.databaseLocked"},
	{"file is not a database", "error.databaseCorrupt"},
	{"SQLITE_ERROR", "error.sqlSyntaxError"},
	{"SQLITE_IOERR", "error.diskIOError"},
}

// MapError turns a database error into the stable keys the renderer knows.
func MapError(err error) *Failure {
	var f *Failure
	if errors.As(err, &f) {
		return f
	}
	for _, s := range errorSnippets {
		if strings.Contains(err.Error(), s.snippet) {
			return &Failure{Key: s.key}
		}
	}
	return &Failure{Key: "error.unknownError", Message: err.Error()}
}

// Repo runs a Spec against a database.
type Repo struct{ DB *sql.DB }

var colCache sync.Map // table name -> []column; every database has the same layout

func tableColumns(ctx context.Context, db *sql.DB, table string) ([]column, error) {
	if v, ok := colCache.Load(table); ok {
		return v.([]column), nil
	}
	rows, err := db.QueryContext(ctx, fmt.Sprintf(`PRAGMA table_info("%s")`, table))
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var cols []column
	for rows.Next() {
		var cid, notnull, pk int
		var name, typ string
		var dflt sql.NullString
		if err := rows.Scan(&cid, &name, &typ, &notnull, &dflt, &pk); err != nil {
			return nil, err
		}
		u := strings.ToUpper(typ)
		cols = append(cols, column{name: name, text: strings.Contains(u, "DATE") || strings.Contains(u, "TIME"),
			hasDefault: notnull == 1 && dflt.Valid})
	}
	if err := rows.Err(); err != nil {
		return nil, err
	}
	if len(cols) == 0 {
		return nil, fmt.Errorf("entity: table %q not found", table)
	}
	colCache.Store(table, cols)
	return cols, nil
}

func (s *Spec) columns(ctx context.Context, db *sql.DB) ([]column, error) {
	return tableColumns(ctx, db, s.Table)
}

func (s *Spec) selectSQL(cols []column) string {
	var b strings.Builder
	b.WriteString("SELECT ")
	for _, c := range cols {
		if c.text {
			fmt.Fprintf(&b, `CAST(t."%s" AS TEXT) AS "%s", `, c.name, c.name)
		} else {
			fmt.Fprintf(&b, `t."%s", `, c.name)
		}
	}
	fmt.Fprintf(&b, `%s AS "invoiceCount", %s AS "quotesCount"`, s.InvoiceCount, s.QuotesCount)
	if s.Extra != "" {
		b.WriteString(", " + s.Extra)
	}
	fmt.Fprintf(&b, " FROM %s t %s", s.Table, s.Joins)
	return b.String()
}

func (s *Spec) groupBy() string {
	if s.GroupBy != "" {
		return s.GroupBy
	}
	return `t."id"`
}

func (s *Spec) isBlob(name string) bool {
	for _, b := range s.Blobs {
		if b == name {
			return true
		}
	}
	return false
}

func (s *Spec) scan(rows *sql.Rows) ([]Row, error) {
	names, err := rows.Columns()
	if err != nil {
		return nil, err
	}
	var out []Row
	for rows.Next() {
		vals := make([]any, len(names))
		ptrs := make([]any, len(names))
		for i := range vals {
			ptrs[i] = &vals[i]
		}
		if err := rows.Scan(ptrs...); err != nil {
			return nil, err
		}
		row := Row{}
		for i, n := range names {
			row[n] = s.outValue(n, vals[i])
		}
		out = append(out, row)
	}
	return out, rows.Err()
}

func (s *Spec) outValue(name string, v any) any {
	switch x := v.(type) {
	case []byte:
		if s.isBlob(name) {
			return base64.StdEncoding.EncodeToString(x)
		}
		return string(x)
	case int64:
		if BooleanFields[name] {
			return x != 0
		}
		return x
	case float64:
		if BooleanFields[name] {
			return x != 0
		}
		return x
	case nil:
		if BooleanFields[name] {
			return false
		}
		return nil
	case string:
		if BooleanFields[name] {
			return x != "" && x != "0"
		}
		return x
	}
	return v
}

// Filter is one entry of the ?filter=[{"type":...,"value":...}] query.
type Filter struct{ Type, Value string }

// ParseFilter reads the query value, ignoring anything malformed or unknown.
func ParseFilter(q string) []Filter {
	if q == "" {
		return nil
	}
	var raw []map[string]any
	if json.Unmarshal([]byte(q), &raw) != nil {
		return nil
	}
	known := map[string]bool{"All": true, "Active": true, "Archived": true, "AtleastOneInvoice": true, "NoInvoices": true,
		"NoInvoices30": true, "NoInvoices60": true, "NoInvoices90": true, "Client": true, "Business": true, "Date": true, "Status": true}
	var out []Filter
	for _, m := range raw {
		t, _ := m["type"].(string)
		v, ok := m["value"].(string)
		if !known[t] || !ok {
			continue
		}
		out = append(out, Filter{t, v})
	}
	return out
}

func (s *Spec) having(filters []Filter) string {
	var c []string
	for _, f := range filters {
		switch f.Type {
		case "NoInvoices30", "NoInvoices60", "NoInvoices90":
			days := strings.TrimPrefix(f.Type, "NoInvoices")
			c = append(c, fmt.Sprintf(`(MAX(%[1]s."updatedAt") IS NULL OR MAX(%[1]s."updatedAt") < datetime('now', '-%[2]s days'))`, s.InvAlias, days))
		case "NoInvoices":
			c = append(c, fmt.Sprintf(`(COUNT(%s."id") = 0)`, s.InvAlias))
		case "AtleastOneInvoice":
			c = append(c, fmt.Sprintf(`(COUNT(%s."id") > 0)`, s.InvAlias))
		case "Active":
			c = append(c, `(t."isArchived" = 0)`)
		case "Archived":
			c = append(c, `(t."isArchived" = 1)`)
		}
	}
	if len(c) == 0 {
		return ""
	}
	return "HAVING " + strings.Join(c, " AND ")
}

// List returns every row, newest first, honouring the filters.
func (r Repo) List(ctx context.Context, s *Spec, filters []Filter) ([]Row, error) {
	cols, err := s.columns(ctx, r.DB)
	if err != nil {
		return nil, err
	}
	q := s.selectSQL(cols) + " GROUP BY " + s.groupBy() + " " + s.having(filters) + ` ORDER BY t."createdAt" DESC`
	rows, err := r.DB.QueryContext(ctx, q)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	out, err := s.scan(rows)
	if out == nil {
		out = []Row{}
	}
	return out, err
}

type queryer interface {
	QueryContext(context.Context, string, ...any) (*sql.Rows, error)
	ExecContext(context.Context, string, ...any) (sql.Result, error)
}

func (s *Spec) one(ctx context.Context, q queryer, cols []column, id int64) (Row, error) {
	rows, err := q.QueryContext(ctx, s.selectSQL(cols)+` WHERE t."id" = ? GROUP BY `+s.groupBy(), id)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	got, err := s.scan(rows)
	if err != nil || len(got) == 0 {
		return nil, err
	}
	return got[0], nil
}

// param converts a decoded JSON value into something the driver accepts.
func (s *Spec) param(field string, v any) (any, error) {
	switch x := v.(type) {
	case nil:
		return nil, nil
	case bool:
		if x {
			return 1, nil
		}
		return 0, nil
	case json.Number:
		if i, err := x.Int64(); err == nil {
			return i, nil
		}
		return x.Float64()
	case string:
		if s.isBlob(field) {
			if x == "" {
				return nil, nil
			}
			return decodeBase64(x), nil
		}
		return x, nil
	}
	return nil, &Failure{Key: "error.unknownError", Message: "unsupported value for " + field}
}

// decodeBase64 is as forgiving as Node's Buffer.from(value, "base64"): it
// accepts the URL-safe alphabet, missing padding and stray whitespace.
func decodeBase64(v string) []byte {
	v = strings.Map(func(r rune) rune {
		switch r {
		case '\n', '\r', ' ', '\t', '=':
			return -1
		case '-':
			return '+'
		case '_':
			return '/'
		}
		return r
	}, v)
	b, err := base64.RawStdEncoding.DecodeString(v)
	if err != nil {
		return []byte{}
	}
	return b
}

func (s *Spec) save(ctx context.Context, q queryer, cols []column, row Row, update bool) (Row, error) {
	for k, d := range s.Defaults {
		if row[k] == nil {
			row[k] = d
		}
	}
	withDefault := map[string]bool{}
	for _, c := range cols {
		withDefault[c.name] = c.hasDefault
	}
	var names []string
	var params []any
	for _, f := range s.Fields {
		if row[f] == nil && withDefault[f] {
			continue
		}
		p, err := s.param(f, row[f])
		if err != nil {
			return nil, err
		}
		names = append(names, f)
		params = append(params, p)
	}
	var id int64
	if update {
		id = -1
		if n, ok := row["id"].(json.Number); ok {
			if v, err := n.Int64(); err == nil {
				id = v
			}
		}
		set := make([]string, len(names))
		for i, f := range names {
			set[i] = fmt.Sprintf(`"%s" = ?`, f)
		}
		set = append(set, `"updatedAt" = (datetime('now'))`)
		if _, err := q.ExecContext(ctx, fmt.Sprintf(`UPDATE %s SET %s WHERE "id" = ?`,
			s.Table, strings.Join(set, ", ")), append(params, id)...); err != nil {
			return nil, err
		}
	} else {
		var res sql.Result
		var err error
		if len(names) == 0 {
			res, err = q.ExecContext(ctx, fmt.Sprintf(`INSERT INTO %s DEFAULT VALUES`, s.Table))
		} else {
			quoted := make([]string, len(names))
			marks := make([]string, len(names))
			for i, f := range names {
				quoted[i], marks[i] = `"`+f+`"`, "?"
			}
			res, err = q.ExecContext(ctx, fmt.Sprintf(`INSERT INTO %s (%s) VALUES (%s)`, s.Table,
				strings.Join(quoted, ","), strings.Join(marks, ",")), params...)
		}
		if err != nil {
			return nil, err
		}
		if id, err = res.LastInsertId(); err != nil {
			return nil, err
		}
	}
	return s.one(ctx, q, cols, id)
}

// Save inserts or updates one row and returns it with its counters. An update
// of an id that does not exist returns (nil, nil), as the old server did.
func (r Repo) Save(ctx context.Context, s *Spec, row Row, update bool) (Row, error) {
	cols, err := s.columns(ctx, r.DB)
	if err != nil {
		return nil, err
	}
	return s.save(ctx, r.DB, cols, row, update)
}

// Delete removes a row. Deleting a missing id is not an error.
func (r Repo) Delete(ctx context.Context, s *Spec, id int64) error {
	_, err := r.DB.ExecContext(ctx, fmt.Sprintf(`DELETE FROM %s WHERE "id" = ?`, s.Table), id)
	return err
}

// Batch inserts all rows in one transaction; the first failure rolls back
// everything and is returned.
func (r Repo) Batch(ctx context.Context, s *Spec, rows []Row) error {
	cols, err := s.columns(ctx, r.DB)
	if err != nil {
		return err
	}
	tx, err := r.DB.BeginTx(ctx, nil)
	if err != nil {
		return err
	}
	defer tx.Rollback() // no-op after Commit
	for _, row := range rows {
		if s.Prepare != nil {
			if err := s.Prepare(ctx, tx, row); err != nil {
				return err
			}
		}
		if _, err := s.save(ctx, tx, cols, row, false); err != nil {
			return err
		}
	}
	return tx.Commit()
}

// IDFromPath parses the :id path value the way Number() did: junk becomes a
// value that matches nothing.
func IDFromPath(v string) int64 {
	if i, err := strconv.ParseInt(v, 10, 64); err == nil {
		return i
	}
	return -1
}

func formatInt(i int64) string { return strconv.FormatInt(i, 10) }

// plainColumns selects every column of a table, dates as stored text.
func plainColumns(cols []column, alias string) string {
	parts := make([]string, len(cols))
	for i, c := range cols {
		if c.text {
			parts[i] = fmt.Sprintf(`CAST(%s."%s" AS TEXT) AS "%s"`, alias, c.name, c.name)
		} else {
			parts[i] = fmt.Sprintf(`%s."%s"`, alias, c.name)
		}
	}
	return strings.Join(parts, ", ")
}

// Select returns every column of table's rows matching tail (a WHERE/ORDER BY
// clause with ? placeholders), converted like the resource rows.
func (r Repo) Select(ctx context.Context, table, tail string, args ...any) ([]Row, error) {
	cols, err := tableColumns(ctx, r.DB, table)
	if err != nil {
		return nil, err
	}
	rows, err := r.DB.QueryContext(ctx, fmt.Sprintf(`SELECT %s FROM %s t %s`, plainColumns(cols, "t"), table, tail), args...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	spec := &Spec{}
	out, err := spec.scan(rows)
	if out == nil {
		out = []Row{}
	}
	return out, err
}

// UpdateColumns sets the given columns on the rows matching where. Only real
// columns of the table are accepted. It reports false when nothing was given.
func (r Repo) UpdateColumns(ctx context.Context, table string, values Row, where string, args ...any) (bool, error) {
	cols, err := tableColumns(ctx, r.DB, table)
	if err != nil {
		return false, err
	}
	known := map[string]bool{}
	for _, c := range cols {
		known[c.name] = true
	}
	spec := &Spec{}
	var set []string
	var params []any
	for k, v := range values {
		if v == nil {
			if !known[k] {
				return false, &Failure{Key: "error.sqlSyntaxError"}
			}
			set, params = append(set, fmt.Sprintf(`"%s" = ?`, k)), append(params, nil)
			continue
		}
		if !known[k] {
			return false, &Failure{Key: "error.sqlSyntaxError"}
		}
		p, err := spec.param(k, v)
		if err != nil {
			return false, &Failure{Key: "error.unknownError", Message: "error.unsupportedValue"}
		}
		set, params = append(set, fmt.Sprintf(`"%s" = ?`, k)), append(params, p)
	}
	if len(set) == 0 {
		return false, nil
	}
	set = append(set, `"updatedAt" = datetime('now')`)
	_, err = r.DB.ExecContext(ctx, fmt.Sprintf(`UPDATE %s SET %s WHERE %s`, table, strings.Join(set, ", "), where), append(params, args...)...)
	return err == nil, err
}
