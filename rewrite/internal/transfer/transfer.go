// Package transfer exports the whole database as one JSON document and imports
// such a document back, replacing the data.
package transfer

import (
	"context"
	"database/sql"
	"encoding/json"
	"fmt"
	"strings"

	"github.com/Raktim94/nodedr-invoice/rewrite/internal/entity"
)

type table struct {
	name  string
	key   string   // key in the document
	blobs []string // columns exchanged as base64
}

// tables lists every exported table in the order rows are inserted on import
// (parents before the rows that point at them).
var tables = []table{
	{"currencies", "currencies", nil},
	{"units", "units", nil},
	{"categories", "categories", nil},
	{"businesses", "businesses", []string{"logo"}},
	{"layouts", "layouts", nil},
	{"style_profiles", "styleProfiles", []string{"watermarkFileData", "paidWatermarkFileData"}},
	{"banks", "banks", []string{"qrCode"}},
	{"clients", "clients", nil},
	{"items", "items", nil},
	{"invoices", "invoices", []string{"signatureData"}},
	{"invoice_sequences", "invoiceSequences", nil},
	{"invoice_style_profile_snapshots", "invoiceStyleProfileSnapshots", nil},
	{"invoice_business_snapshots", "invoiceBusinessSnapshots", []string{"businessLogo"}},
	{"invoice_bank_snapshots", "invoiceBankSnapshots", []string{"qrCode"}},
	{"invoice_customizations", "invoiceCustomizations", []string{"watermarkFileData", "paidWatermarkFileData"}},
	{"invoice_client_snapshots", "invoiceClientSnapshots", nil},
	{"invoice_currency_snapshots", "invoiceCurrencySnapshots", nil},
	{"invoice_items", "invoiceItems", nil},
	{"invoice_item_snapshots", "invoiceItemSnapshots", nil},
	{"invoice_layout_snapshots", "invoiceLayoutSnapshots", nil},
	{"invoice_payments", "invoicePayments", nil},
	{"attachments", "attachments", []string{"data"}},
	{"presets", "presets", []string{"signatureData"}},
}

// deleteOrder empties children before parents.
var deleteOrder = []string{"presets", "invoice_sequences", "invoice_style_profile_snapshots", "invoice_customizations",
	"invoice_currency_snapshots", "invoice_client_snapshots", "invoice_bank_snapshots", "invoice_business_snapshots",
	"invoice_item_snapshots", "invoice_items", "invoice_layout_snapshots", "attachments", "invoice_payments", "invoices", "items",
	"businesses", "clients", "units", "categories", "currencies", "style_profiles", "layouts", "banks"}

func spec(t table) *entity.Spec { return &entity.Spec{Table: t.name, Blobs: t.blobs} }

// Export returns every row of every table, binary columns as base64.
func Export(ctx context.Context, repo entity.Repo) (map[string]any, error) {
	if err := repo.Warm(ctx, tableNames()...); err != nil {
		return nil, err
	}
	out := map[string]any{}
	for _, t := range tables {
		rows, err := repo.SelectWith(ctx, repo.DB, spec(t), "")
		if err != nil {
			return nil, err
		}
		if rows == nil {
			rows = []entity.Row{}
		}
		out[t.key] = rows
	}
	settings, err := repo.SelectWith(ctx, repo.DB, &entity.Spec{Table: "settings"}, "LIMIT 1")
	if err != nil {
		return nil, err
	}
	if len(settings) > 0 {
		out["settings"] = settings[0]
	} else {
		out["settings"] = nil
	}
	return out, nil
}

func tableNames() []string {
	names := []string{"settings"}
	for _, t := range tables {
		names = append(names, t.name)
	}
	return names
}

// ErrInvalidFile is the key for a document that is not an object.
const ErrInvalidFile = "invalidFile"

func insertRows(ctx context.Context, repo entity.Repo, tx *sql.Tx, t table, rows []any) error {
	known, err := repo.Columns(ctx, t.name)
	if err != nil {
		return err
	}
	isCol := map[string]bool{}
	for _, c := range known {
		isCol[c] = true
	}
	sp := spec(t)
	for _, raw := range rows {
		row, _ := raw.(map[string]any)
		var cols []string
		var marks []string
		var params []any
		for k, v := range row {
			if k == "invoiceFullNumber" {
				continue
			}
			if !isCol[k] {
				return &entity.Failure{Key: "error.sqlSyntaxError"}
			}
			p, err := sp.Param(k, v)
			if err != nil {
				return err
			}
			cols, marks, params = append(cols, `"`+k+`"`), append(marks, "?"), append(params, p)
		}
		if len(cols) == 0 {
			continue
		}
		if _, err := tx.ExecContext(ctx, fmt.Sprintf(`INSERT INTO %s (%s) VALUES (%s)`, t.name,
			strings.Join(cols, ","), strings.Join(marks, ",")), params...); err != nil {
			return err
		}
	}
	return nil
}

// Import replaces the data with the document's. It is all or nothing.
func Import(ctx context.Context, repo entity.Repo, doc any) error {
	root, ok := doc.(map[string]any)
	if !ok {
		return &entity.Failure{Key: ErrInvalidFile}
	}
	if err := repo.Warm(ctx, append(tableNames(), "settings")...); err != nil {
		return err
	}
	// Foreign keys are switched off for the load (rows arrive parents-first,
	// but a document may be incomplete) and back on afterwards. The pragma is
	// ignored inside a transaction, so it goes first.
	if _, err := repo.DB.ExecContext(ctx, `PRAGMA foreign_keys = OFF`); err != nil {
		return err
	}
	defer repo.DB.ExecContext(context.Background(), `PRAGMA foreign_keys = ON`)

	tx, err := repo.DB.BeginTx(ctx, nil)
	if err != nil {
		return err
	}
	defer tx.Rollback()
	for _, name := range deleteOrder {
		if _, err := tx.ExecContext(ctx, `DELETE FROM `+name); err != nil {
			return err
		}
	}
	for _, t := range tables {
		rows, _ := root[t.key].([]any)
		if err := insertRows(ctx, repo, tx, t, rows); err != nil {
			return err
		}
	}
	if settings, ok := root["settings"].(map[string]any); ok {
		if err := updateSettings(ctx, repo, tx, settings); err != nil {
			return err
		}
	}
	return tx.Commit()
}

func updateSettings(ctx context.Context, repo entity.Repo, tx *sql.Tx, settings map[string]any) error {
	known, err := repo.Columns(ctx, "settings")
	if err != nil {
		return err
	}
	isCol := map[string]bool{}
	for _, c := range known {
		isCol[c] = true
	}
	sp := &entity.Spec{Table: "settings"}
	var set []string
	var params []any
	for k, v := range settings {
		if k == "id" {
			continue
		}
		if !isCol[k] {
			return &entity.Failure{Key: "error.sqlSyntaxError"}
		}
		p, err := sp.Param(k, v)
		if err != nil {
			return err
		}
		set, params = append(set, `"`+k+`" = ?`), append(params, p)
	}
	if len(set) == 0 {
		return nil
	}
	_, err = tx.ExecContext(ctx, `UPDATE settings SET `+strings.Join(set, ", ")+` WHERE "id" = (SELECT "id" FROM settings LIMIT 1)`, params...)
	return err
}

// Parse reads the document with exact integers.
func Parse(data []byte) (any, error) {
	dec := json.NewDecoder(strings.NewReader(string(data)))
	dec.UseNumber()
	var v any
	if err := dec.Decode(&v); err != nil {
		return nil, err
	}
	return v, nil
}
