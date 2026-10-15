// Package store is Mavri's persistence layer: reference records, documents
// with their snapshots and totals, numbering, settings and reports.
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
)

// Tables for the reference records. They are stateless and shared.
var (
	Parties    = db.NewTable[model.Party]("parties")
	Currencies = db.NewTable[model.Currency]("currencies")
	Banks      = db.NewTable[model.BankAccount]("bank_accounts")
	Groups     = db.NewTable[model.Group]("catalog_groups")
	Products   = db.NewTable[model.Product]("products")
	Styles     = db.NewTable[model.Style]("styles")
	Presets    = db.NewTable[model.Preset]("presets")
	Shops      = db.NewTable[model.Shop]("shops")
	payments   = db.NewTable[model.Payment]("payments")
)

// Validation is a problem with what the caller sent; the HTTP layer answers 400.
type Validation struct{ Msg string }

func (v Validation) Error() string { return v.Msg }

func invalid(format string, a ...any) error { return Validation{fmt.Sprintf(format, a...)} }

// Store wraps the database.
type Store struct {
	DB  *sql.DB
	Now func() time.Time
}

func (s *Store) now() time.Time {
	if s.Now != nil {
		return s.Now()
	}
	return time.Now()
}

// Today is the current date as YYYY-MM-DD.
func (s *Store) Today() string { return s.now().UTC().Format("2006-01-02") }

// ---- settings --------------------------------------------------------------

// GetSettings returns the saved preferences, or the defaults.
func (s *Store) GetSettings(ctx context.Context, q db.Queryer) (model.Settings, error) {
	set := model.DefaultSettings()
	var raw string
	err := q.QueryRowContext(ctx, `SELECT value FROM settings WHERE key = 'app'`).Scan(&raw)
	if errors.Is(err, sql.ErrNoRows) {
		return set, nil
	}
	if err != nil {
		return set, err
	}
	// Unmarshalling over the defaults keeps new settings at their defaults.
	if err := json.Unmarshal([]byte(raw), &set); err != nil {
		return model.DefaultSettings(), nil
	}
	return set, nil
}

// SaveSettings validates and stores the preferences.
func (s *Store) SaveSettings(ctx context.Context, set model.Settings) error {
	if len(set.InvoicePrefix) > 20 || len(set.InvoiceSuffix) > 20 || len(set.QuotePrefix) > 20 {
		return invalid("prefixes and suffixes are at most 20 characters")
	}
	raw, _ := json.Marshal(set)
	_, err := s.DB.ExecContext(ctx, `INSERT INTO settings (key, value) VALUES ('app', ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value`, string(raw))
	return err
}

// ---- reference records -----------------------------------------------------

func hasText(s string) bool { return strings.TrimSpace(s) != "" }

// CheckParty validates a party before saving.
func CheckParty(p *model.Party) error {
	p.Name = strings.TrimSpace(p.Name)
	if p.Kind != "issuer" && p.Kind != "customer" {
		return invalid("kind must be issuer or customer")
	}
	if !hasText(p.Name) {
		return invalid("name is required")
	}
	if p.Country != "" && len(p.Country) != 2 {
		return invalid("country must be a two-letter code")
	}
	p.Country = strings.ToUpper(p.Country)
	return nil
}

// CheckCurrency validates a currency.
func CheckCurrency(c *model.Currency) error {
	c.Code = strings.ToUpper(strings.TrimSpace(c.Code))
	if len(c.Code) != 3 {
		return invalid("code must be three letters")
	}
	if !hasText(c.Symbol) || !hasText(c.Name) {
		return invalid("symbol and name are required")
	}
	if c.Pattern == "" {
		c.Pattern = "{symbol}{amount}"
	}
	if !strings.Contains(c.Pattern, "{amount}") {
		return invalid("pattern must contain {amount}")
	}
	if c.Decimals < 0 || c.Decimals > 4 {
		return invalid("decimals must be 0 to 4")
	}
	return nil
}

// CheckBank validates a bank account.
func CheckBank(b *model.BankAccount) error {
	if !hasText(b.Label) {
		return invalid("label is required")
	}
	return nil
}

// CheckGroup validates a category or unit.
func CheckGroup(g *model.Group) error {
	g.Name = strings.TrimSpace(g.Name)
	if g.Kind != "category" && g.Kind != "unit" {
		return invalid("kind must be category or unit")
	}
	if g.Name == "" {
		return invalid("name is required")
	}
	return nil
}

// CheckProduct validates a catalog product.
func CheckProduct(p *model.Product) error {
	if !hasText(p.Name) {
		return invalid("name is required")
	}
	if p.PriceCents < 0 {
		return invalid("price cannot be negative")
	}
	return nil
}

// CheckStyle validates a style.
func CheckStyle(st *model.Style) error {
	if !hasText(st.Name) {
		return invalid("name is required")
	}
	if len(st.Accent) != 7 || st.Accent[0] != '#' {
		return invalid("accent must be a colour like #3b5bdb")
	}
	return nil
}

// CheckPreset validates a preset.
func CheckPreset(p *model.Preset) error {
	if !hasText(p.Name) {
		return invalid("name is required")
	}
	if p.IssuerID == 0 || p.CustomerID == 0 || p.CurrencyID == 0 {
		return invalid("issuer, customer and currency are required")
	}
	return nil
}

// SaveSettingsTx stores preferences using an open transaction.
func SaveSettingsTx(ctx context.Context, q db.Queryer, set model.Settings) error {
	raw, _ := json.Marshal(set)
	_, err := q.ExecContext(ctx, `INSERT INTO settings (key, value) VALUES ('app', ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value`, string(raw))
	return err
}
