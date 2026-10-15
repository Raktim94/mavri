package csvio

import (
	"context"
	"database/sql"
	"encoding/csv"
	"errors"
	"fmt"
	"io"
	"math"
	"strconv"
	"strings"
	"unicode/utf8"

	"github.com/Raktim94/mavri/server/internal/db"
	"github.com/Raktim94/mavri/server/internal/model"
	"github.com/Raktim94/mavri/server/internal/money"
	"github.com/Raktim94/mavri/server/internal/store"
)

// ErrUnknownKind is returned for a kind that cannot be exported or imported.
var ErrUnknownKind = errors.New("unknown kind: use customers, products, invoices or payments")

// ErrInvalid is a file that cannot be read as CSV at all.
var ErrInvalid = errors.New("invalid file")

// MaxRows bounds one import.
const MaxRows = 5000

// RowError explains why a row was not imported. Raw is the original row, so the list can be fixed and re-imported.
type RowError struct {
	Line    int      `json:"line"`
	Message string   `json:"message"`
	Raw     []string `json:"raw"`
}

// Report is the outcome of a dry run or an import.
type Report struct {
	Kind    string              `json:"kind"`
	DryRun  bool                `json:"dryRun"`
	Header  []string            `json:"header"`
	Total   int                 `json:"total"`   // data rows in the file
	Valid   int                 `json:"valid"`   // rows that can be (or were) imported
	Created int                 `json:"created"` // rows actually written; 0 on a dry run
	Skipped int                 `json:"skipped"` // valid-looking rows that already exist
	Errors  []RowError          `json:"errors"`
	Preview []map[string]string `json:"preview"` // the first valid rows
}

// aliases map header names people use to our field names.
var aliases = map[string]string{
	"company": "name", "customer": "name", "full name": "name", "e-mail": "email", "mail": "email", "telephone": "phone", "mobile": "phone",
	"vat": "tax_id", "vat id": "tax_id", "tax id": "tax_id", "taxid": "tax_id", "gstin": "tax_id", "tax number": "tax_id",
	"notes": "note", "comment": "note", "price": "price", "unit price": "price", "rate": "price", "amount": "price",
	"title": "name", "product": "name", "item": "name", "details": "description", "category": "category", "unit": "unit",
}

func canon(h string) string {
	h = strings.ToLower(strings.TrimSpace(strings.TrimPrefix(h, "\ufeff")))
	h = strings.ReplaceAll(h, "_", " ")
	if a, ok := aliases[h]; ok {
		return a
	}
	return strings.ReplaceAll(h, " ", "_")
}

type table struct {
	header []string
	cols   map[string]int
	rows   [][]string
	lines  []int
}

func readTable(r io.Reader) (table, error) {
	cr := csv.NewReader(r)
	cr.FieldsPerRecord = -1
	cr.LazyQuotes = true
	cr.TrimLeadingSpace = true
	var t table
	t.cols = map[string]int{}
	line := 0
	for {
		rec, err := cr.Read()
		if errors.Is(err, io.EOF) {
			break
		}
		if err != nil {
			return t, fmt.Errorf("%w: %v", ErrInvalid, err)
		}
		line++
		if len(rec) == 1 && strings.TrimSpace(rec[0]) == "" {
			continue
		}
		if t.header == nil {
			for i, h := range rec {
				t.header = append(t.header, strings.TrimSpace(strings.TrimPrefix(h, "\ufeff")))
				if c := canon(h); c != "" {
					if _, dup := t.cols[c]; !dup {
						t.cols[c] = i
					}
				}
			}
			continue
		}
		if len(t.rows) >= MaxRows {
			return t, fmt.Errorf("%w: at most %d rows per import", ErrInvalid, MaxRows)
		}
		t.rows = append(t.rows, rec)
		t.lines = append(t.lines, line)
	}
	if t.header == nil {
		return t, fmt.Errorf("%w: the file is empty", ErrInvalid)
	}
	return t, nil
}

func (t table) get(rec []string, name string) string {
	if i, ok := t.cols[name]; ok && i < len(rec) {
		return strings.TrimSpace(rec[i])
	}
	return ""
}

// ParsePrice reads "12.5", "1,234.50", "€12,50" or "12,50" as minor units with two decimals.
func ParsePrice(s string) (int64, error) {
	for i := 1; i+1 < len(s); i++ { // 1e5 is an exponent, not "15"
		if (s[i] == 'e' || s[i] == 'E') && s[i-1] >= '0' && s[i-1] <= '9' && s[i+1] >= '0' && s[i+1] <= '9' {
			return 0, fmt.Errorf("price %q is not a number", s)
		}
	}
	var b strings.Builder
	for _, r := range s {
		if r >= '0' && r <= '9' || r == '.' || r == ',' || r == '-' {
			b.WriteRune(r)
		}
	}
	v := b.String()
	if v == "" || v == "-" {
		return 0, fmt.Errorf("price %q is not a number", s)
	}
	switch {
	case strings.Contains(v, ",") && strings.Contains(v, "."):
		if strings.LastIndex(v, ",") > strings.LastIndex(v, ".") { // 1.234,50
			v = strings.ReplaceAll(strings.ReplaceAll(v, ".", ""), ",", ".")
		} else { // 1,234.50
			v = strings.ReplaceAll(v, ",", "")
		}
	case strings.Contains(v, ","):
		parts := strings.Split(v, ",")
		if len(parts) == 2 && len(parts[1]) != 3 { // 12,50
			v = parts[0] + "." + parts[1]
		} else { // 1,234
			v = strings.ReplaceAll(v, ",", "")
		}
	}
	f, err := strconv.ParseFloat(v, 64)
	if err != nil || math.IsNaN(f) || math.IsInf(f, 0) || f > 1e12 {
		return 0, fmt.Errorf("price %q is not a number", s)
	}
	if f < 0 {
		return 0, fmt.Errorf("price %q is negative", s)
	}
	return money.ToMinor(f, 2), nil
}

// Import reads a CSV of customers or products. With dryRun nothing is written; the report says what would be.
func Import(ctx context.Context, d *sql.DB, kind string, r io.Reader, dryRun bool) (Report, error) {
	rep := Report{Kind: kind, DryRun: dryRun, Errors: []RowError{}, Preview: []map[string]string{}}
	if kind != "customers" && kind != "products" {
		return rep, ErrUnknownKind
	}
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
	rep.Header, rep.Total = t.header, len(t.rows)
	if _, ok := t.cols["name"]; !ok {
		return rep, fmt.Errorf("%w: the first row must have a \"name\" column", ErrInvalid)
	}
	if kind == "customers" {
		err = importCustomers(ctx, d, t, &rep, dryRun)
	} else {
		err = importProducts(ctx, d, t, &rep, dryRun)
	}
	return rep, err
}

func (rep *Report) bad(t table, i int, msg string) {
	rep.Errors = append(rep.Errors, RowError{Line: t.lines[i], Message: msg, Raw: t.rows[i]})
}

func (rep *Report) ok(preview map[string]string) {
	rep.Valid++
	if len(rep.Preview) < 10 {
		rep.Preview = append(rep.Preview, preview)
	}
}

func importCustomers(ctx context.Context, d *sql.DB, t table, rep *Report, dryRun bool) error {
	existing := map[string]bool{}
	ps, err := store.Parties.Select(ctx, d, "WHERE kind = 'customer'")
	if err != nil {
		return err
	}
	for _, p := range ps {
		existing[strings.ToLower(p.Name+"|"+p.Email)] = true
	}
	var toAdd []model.Party
	for i, rec := range t.rows {
		p := model.Party{Kind: "customer", Name: t.get(rec, "name"), Email: t.get(rec, "email"), Phone: t.get(rec, "phone"), Address: t.get(rec, "address"),
			TaxID: t.get(rec, "tax_id"), Country: t.get(rec, "country"), Note: t.get(rec, "note")}
		if err := store.CheckParty(&p); err != nil {
			rep.bad(t, i, err.Error())
			continue
		}
		if p.Email != "" && (!strings.Contains(p.Email, "@") || strings.ContainsAny(p.Email, " \r\n,;")) {
			rep.bad(t, i, fmt.Sprintf("%q is not an email address", p.Email))
			continue
		}
		key := strings.ToLower(p.Name + "|" + p.Email)
		if existing[key] {
			rep.Skipped++
			rep.bad(t, i, "already exists (same name and email); skipped")
			continue
		}
		existing[key] = true
		rep.ok(map[string]string{"name": p.Name, "email": p.Email, "phone": p.Phone, "country": p.Country})
		toAdd = append(toAdd, p)
	}
	if dryRun {
		return nil
	}
	err = db.WithTx(ctx, d, func(tx *sql.Tx) error {
		for i := range toAdd {
			if err := store.Parties.Insert(ctx, tx, &toAdd[i]); err != nil {
				return err
			}
		}
		return nil
	})
	if err == nil {
		rep.Created = len(toAdd)
	}
	return err
}

func importProducts(ctx context.Context, d *sql.DB, t table, rep *Report, dryRun bool) error {
	existing := map[string]bool{}
	ps, err := store.Products.Select(ctx, d, "")
	if err != nil {
		return err
	}
	for _, p := range ps {
		existing[strings.ToLower(p.Name)] = true
	}
	type item struct {
		p         model.Product
		cat, unit string
	}
	var toAdd []item
	for i, rec := range t.rows {
		p := model.Product{Name: t.get(rec, "name"), Description: t.get(rec, "description")}
		if s := t.get(rec, "price"); s != "" {
			c, err := ParsePrice(s)
			if err != nil {
				rep.bad(t, i, err.Error())
				continue
			}
			p.PriceCents = c
		}
		if err := store.CheckProduct(&p); err != nil {
			rep.bad(t, i, err.Error())
			continue
		}
		if existing[strings.ToLower(p.Name)] {
			rep.Skipped++
			rep.bad(t, i, "a product with this name already exists; skipped")
			continue
		}
		existing[strings.ToLower(p.Name)] = true
		rep.ok(map[string]string{"name": p.Name, "price": money.Major(p.PriceCents, 2), "category": t.get(rec, "category"), "unit": t.get(rec, "unit")})
		toAdd = append(toAdd, item{p, t.get(rec, "category"), t.get(rec, "unit")})
	}
	if dryRun {
		return nil
	}
	err = db.WithTx(ctx, d, func(tx *sql.Tx) error {
		group := func(kind, name string) (*int64, error) {
			if name == "" {
				return nil, nil
			}
			gs, err := store.Groups.Select(ctx, tx, "WHERE kind = ? AND name = ? COLLATE NOCASE", kind, name)
			if err != nil {
				return nil, err
			}
			if len(gs) > 0 {
				return &gs[0].ID, nil
			}
			g := model.Group{Kind: kind, Name: name}
			if err := store.Groups.Insert(ctx, tx, &g); err != nil {
				return nil, err
			}
			return &g.ID, nil
		}
		for i := range toAdd {
			var err error
			if toAdd[i].p.CategoryID, err = group("category", toAdd[i].cat); err != nil {
				return err
			}
			if toAdd[i].p.UnitID, err = group("unit", toAdd[i].unit); err != nil {
				return err
			}
			if err := store.Products.Insert(ctx, tx, &toAdd[i].p); err != nil {
				return err
			}
		}
		return nil
	})
	if err == nil {
		rep.Created = len(toAdd)
	}
	return err
}
