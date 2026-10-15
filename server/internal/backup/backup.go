// Package backup exports the business data as one JSON document and restores it.
//
// Accounts, sessions, API keys and store connections are not part of a backup:
// they belong to this installation. Restoring replaces all invoices, quotes and
// records, and removes store connections (create them again afterwards).
package backup

import (
	"context"
	"database/sql"
	"encoding/base64"
	"encoding/json"
	"errors"
	"fmt"
	"strings"
	"time"

	"github.com/Raktim94/mavri/server/internal/db"
)

// Version of the file format.
const Version = 1

// tables in the order they can be inserted (parents first).
var tables = []string{"currencies", "parties", "bank_accounts", "catalog_groups", "products", "styles", "presets",
	"documents", "document_lines", "payments", "attachments", "settings"}

// File is the backup document.
type File struct {
	App        string                      `json:"app"`
	Version    int                         `json:"version"`
	ExportedAt string                      `json:"exportedAt"`
	Tables     map[string][]map[string]any `json:"tables"`
}

// ErrInvalid is returned for a file that is not a valid Mavri backup.
var ErrInvalid = errors.New("not a valid Mavri backup")

type column struct {
	name string
	blob bool
}

func columns(ctx context.Context, q db.Queryer, table string) ([]column, error) {
	rows, err := q.QueryContext(ctx, `SELECT name, type FROM pragma_table_info(?)`, table)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var out []column
	for rows.Next() {
		var n, t string
		if err := rows.Scan(&n, &t); err != nil {
			return nil, err
		}
		out = append(out, column{n, strings.EqualFold(t, "BLOB")})
	}
	return out, rows.Err()
}

// Export reads every table.
func Export(ctx context.Context, d *sql.DB) (File, error) {
	f := File{App: "mavri", Version: Version, ExportedAt: time.Now().UTC().Format(time.RFC3339), Tables: map[string][]map[string]any{}}
	for _, t := range tables {
		cols, err := columns(ctx, d, t)
		if err != nil {
			return f, err
		}
		rows, err := d.QueryContext(ctx, "SELECT * FROM "+t+" ORDER BY 1")
		if err != nil {
			return f, err
		}
		out := []map[string]any{}
		for rows.Next() {
			vals := make([]any, len(cols))
			ptrs := make([]any, len(cols))
			for i := range vals {
				ptrs[i] = &vals[i]
			}
			if err := rows.Scan(ptrs...); err != nil {
				rows.Close()
				return f, err
			}
			row := map[string]any{}
			for i, c := range cols {
				if b, ok := vals[i].([]byte); ok {
					if c.blob {
						row[c.name] = base64.StdEncoding.EncodeToString(b)
					} else {
						row[c.name] = string(b)
					}
				} else {
					row[c.name] = vals[i]
				}
			}
			out = append(out, row)
		}
		rows.Close()
		if err := rows.Err(); err != nil {
			return f, err
		}
		f.Tables[t] = out
	}
	return f, nil
}

// Parse reads a backup file.
func Parse(raw []byte) (File, error) {
	var f File
	dec := json.NewDecoder(strings.NewReader(string(raw)))
	dec.UseNumber() // keep large integers exact
	if err := dec.Decode(&f); err != nil || f.App != "mavri" {
		return f, ErrInvalid
	}
	if f.Version != Version {
		return f, fmt.Errorf("%w: unsupported version %d", ErrInvalid, f.Version)
	}
	for name := range f.Tables {
		known := false
		for _, t := range tables {
			known = known || t == name
		}
		if !known {
			return f, fmt.Errorf("%w: unknown table %q", ErrInvalid, name)
		}
	}
	return f, nil
}

// Restore replaces the data with the file's, all or nothing.
func Restore(ctx context.Context, d *sql.DB, f File) error {
	return db.WithTx(ctx, d, func(tx *sql.Tx) error {
		if _, err := tx.ExecContext(ctx, `PRAGMA defer_foreign_keys = ON`); err != nil {
			return err
		}
		for _, t := range []string{"shop_orders", "shops"} {
			if _, err := tx.ExecContext(ctx, "DELETE FROM "+t); err != nil {
				return err
			}
		}
		for i := len(tables) - 1; i >= 0; i-- {
			if _, err := tx.ExecContext(ctx, "DELETE FROM "+tables[i]); err != nil {
				return err
			}
		}
		for _, t := range tables {
			cols, err := columns(ctx, tx, t)
			if err != nil {
				return err
			}
			byName := map[string]column{}
			for _, c := range cols {
				byName[c.name] = c
			}
			for n, row := range f.Tables[t] {
				var names []string
				var args []any
				for k, v := range row {
					c, ok := byName[k]
					if !ok {
						return fmt.Errorf("%w: %s row %d has unknown column %q", ErrInvalid, t, n+1, k)
					}
					names = append(names, k)
					val, err := convert(v, c)
					if err != nil {
						return fmt.Errorf("%w: %s.%s: %v", ErrInvalid, t, k, err)
					}
					args = append(args, val)
				}
				q := fmt.Sprintf("INSERT INTO %s (%s) VALUES (%s)", t, strings.Join(names, ", "), strings.TrimSuffix(strings.Repeat("?, ", len(names)), ", "))
				if _, err := tx.ExecContext(ctx, q, args...); err != nil {
					return fmt.Errorf("%w: %s row %d: %v", ErrInvalid, t, n+1, err)
				}
			}
		}
		// Check the references now, so a bad file is rolled back cleanly.
		bad, err := tx.QueryContext(ctx, `PRAGMA foreign_key_check`)
		if err != nil {
			return err
		}
		defer bad.Close()
		if bad.Next() {
			var table, parent string
			var rowid, idx any
			_ = bad.Scan(&table, &rowid, &parent, &idx)
			return fmt.Errorf("%w: %s refers to a missing %s", ErrInvalid, table, parent)
		}
		return bad.Err()
	})
}

func convert(v any, c column) (any, error) {
	switch x := v.(type) {
	case nil:
		return nil, nil
	case json.Number:
		if i, err := x.Int64(); err == nil {
			return i, nil
		}
		return x.Float64()
	case string:
		if c.blob {
			return base64.StdEncoding.DecodeString(x)
		}
		return x, nil
	case bool:
		if x {
			return int64(1), nil
		}
		return int64(0), nil
	}
	return nil, fmt.Errorf("unsupported value of type %T", v)
}
