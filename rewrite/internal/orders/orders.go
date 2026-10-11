// Package orders connects online stores to invoicing: integrations (one per
// store, with an encrypted webhook secret), the ledger that makes redelivered
// webhooks harmless, and turning an order into an invoice.
package orders

import (
	"context"
	"crypto/rand"
	"database/sql"
	"encoding/base64"
	"errors"
	"fmt"
	"math"
	"strings"
	"time"
	"unicode/utf8"

	"github.com/Raktim94/nodedr-invoice/rewrite/internal/entity"
	"github.com/Raktim94/nodedr-invoice/rewrite/internal/invoices"
	"github.com/Raktim94/nodedr-invoice/rewrite/internal/secrets"
)

// Row is a response object.
type Row = entity.Row

// Service holds what the order flows need.
type Service struct {
	Repo     entity.Repo
	Invoices *invoices.Service
	Box      *secrets.Box
	Now      func() time.Time
}

func (s *Service) now() string {
	t := time.Now()
	if s.Now != nil {
		t = s.Now()
	}
	return t.UTC().Format("2006-01-02T15:04:05.000Z")
}

// Integration is one connected store.
type Integration struct {
	ID                                int64
	Name, Platform, SecretEncrypted   string
	BusinessID, CurrencyID            int64
	BankID, LayoutID, StyleProfilesID sql.NullInt64
	DefaultTaxRate                    float64
	AutoIssue, IsActive               bool
}

// Platforms are the senders a webhook may come from.
var Platforms = []string{"shopify", "woocommerce", "generic"}

// ValidPlatform reports whether p is a known sender.
func ValidPlatform(p string) bool {
	for _, k := range Platforms {
		if k == p {
			return true
		}
	}
	return false
}

var (
	entityClients = entity.Clients
	entityItems   = entity.Items
)

var integrationSpec = &entity.Spec{
	Table: "ecommerce_integrations",
	Fields: []string{"name", "platform", "webhookSecretEncrypted", "businessId", "currencyId", "bankId", "layoutId",
		"styleProfilesId", "defaultTaxRate", "autoIssue", "createdByUserId"},
}

// ---- integrations ----------------------------------------------------------------

// List returns the integrations without their secrets, newest first.
func (s *Service) List(ctx context.Context, baseURL string) ([]Row, error) {
	rows, err := s.Repo.Select(ctx, "ecommerce_integrations", `ORDER BY t."createdAt" DESC`)
	if err != nil {
		return nil, err
	}
	out := make([]Row, 0, len(rows))
	for _, r := range rows {
		out = append(out, publicIntegration(r, baseURL))
	}
	return out, nil
}

func publicIntegration(r Row, baseURL string) Row {
	pub := Row{}
	for _, k := range []string{"id", "name", "platform", "businessId", "currencyId", "bankId", "layoutId", "styleProfilesId",
		"defaultTaxRate", "autoIssue", "isActive", "lastEventAt", "createdAt", "updatedAt"} {
		pub[k] = r[k]
	}
	pub["webhookUrl"] = fmt.Sprintf("%s/api/webhooks/ecommerce/%v/%v", baseURL, r["platform"], r["id"])
	return pub
}

// NewIntegration is what the creation request asks for.
type NewIntegration struct {
	Name, Platform                    string
	BusinessID, CurrencyID            float64 // NaN when missing
	BankID, LayoutID, StyleProfilesID *float64
	DefaultTaxRate                    *float64
	AutoIssue                         *bool
	CreatedByUserID                   int64 // 0 for an API key
}

func newSecret() (string, error) {
	b := make([]byte, 32)
	if _, err := rand.Read(b); err != nil {
		return "", err
	}
	return "whsec_" + base64.RawURLEncoding.EncodeToString(b), nil
}

func opt(f *float64) any {
	if f == nil {
		return nil
	}
	return jsInt(*f)
}

func jsInt(f float64) any {
	if f == math.Trunc(f) && math.Abs(f) < 1e15 {
		return int64(f)
	}
	return f
}

// Create stores a new integration and returns it with its raw secret, which
// is not kept anywhere in readable form.
func (s *Service) Create(ctx context.Context, in NewIntegration) (id int64, platform, secret string, err error) {
	name := strings.TrimSpace(in.Name)
	if name == "" {
		return 0, "", "", &entity.Failure{Key: "error.invalidName"}
	}
	if in.BusinessID == 0 || math.IsNaN(in.BusinessID) || in.CurrencyID == 0 || math.IsNaN(in.CurrencyID) {
		return 0, "", "", &entity.Failure{Key: "error.missingRequiredFields"}
	}
	secret, err = newSecret()
	if err != nil {
		return 0, "", "", err
	}
	enc, err := s.Box.Encrypt(secret)
	if err != nil {
		return 0, "", "", err
	}
	tax := any(int64(0))
	if in.DefaultTaxRate != nil {
		tax = jsInt(*in.DefaultTaxRate)
	}
	auto := int64(1)
	if in.AutoIssue != nil && !*in.AutoIssue {
		auto = 0
	}
	var by any
	if in.CreatedByUserID != 0 {
		by = in.CreatedByUserID
	}
	id, err = s.Repo.Write(ctx, s.Repo.DB, integrationSpec, Row{"name": name, "platform": in.Platform, "webhookSecretEncrypted": enc,
		"businessId": jsInt(in.BusinessID), "currencyId": jsInt(in.CurrencyID), "bankId": opt(in.BankID), "layoutId": opt(in.LayoutID),
		"styleProfilesId": opt(in.StyleProfilesID), "defaultTaxRate": tax, "autoIssue": auto, "createdByUserId": by}, false, false)
	if err != nil {
		return 0, "", "", err
	}
	return id, in.Platform, secret, nil
}

// Deactivate switches an integration off; its webhook then answers 404.
func (s *Service) Deactivate(ctx context.Context, id int64) error {
	_, err := s.Repo.DB.ExecContext(ctx, `UPDATE ecommerce_integrations SET "isActive" = 0 WHERE "id" = ?`, id)
	return err
}

// Delete removes an integration and, with it, its order ledger.
func (s *Service) Delete(ctx context.Context, id int64) error {
	_, err := s.Repo.DB.ExecContext(ctx, `DELETE FROM ecommerce_integrations WHERE "id" = ?`, id)
	return err
}

// Active returns the integration if it exists and is switched on.
func (s *Service) Active(ctx context.Context, id int64) (*Integration, error) {
	var i Integration
	var auto, active int64
	err := s.Repo.DB.QueryRowContext(ctx, `SELECT "id","name","platform","webhookSecretEncrypted","businessId","currencyId","bankId","layoutId","styleProfilesId","defaultTaxRate","autoIssue","isActive" FROM ecommerce_integrations WHERE "id" = ?`, id).
		Scan(&i.ID, &i.Name, &i.Platform, &i.SecretEncrypted, &i.BusinessID, &i.CurrencyID, &i.BankID, &i.LayoutID, &i.StyleProfilesID, &i.DefaultTaxRate, &auto, &active)
	if errors.Is(err, sql.ErrNoRows) {
		return nil, nil
	}
	if err != nil {
		return nil, err
	}
	i.AutoIssue, i.IsActive = auto != 0, active != 0
	if !i.IsActive {
		return nil, nil
	}
	return &i, nil
}

// Secret decrypts an integration's webhook secret.
func (s *Service) Secret(i *Integration) (string, error) { return s.Box.Decrypt(i.SecretEncrypted) }

// ---- ledger ------------------------------------------------------------------------

// Existing is a recorded order.
type Existing struct {
	ID        int64
	Status    string
	InvoiceID sql.NullInt64
}

// FindOrder looks an order up by the store's own id for it.
func (s *Service) FindOrder(ctx context.Context, integrationID int64, externalID any) (*Existing, error) {
	var e Existing
	err := s.Repo.DB.QueryRowContext(ctx, `SELECT "id","status","invoiceId" FROM ecommerce_orders WHERE "integrationId" = ? AND "externalOrderId" = ?`,
		integrationID, externalID).Scan(&e.ID, &e.Status, &e.InvoiceID)
	if errors.Is(err, sql.ErrNoRows) {
		return nil, nil
	}
	return &e, err
}

// RecordReceived notes that an order arrived and returns its ledger id.
func (s *Service) RecordReceived(ctx context.Context, integrationID int64, externalID any, payloadHash string) (int64, error) {
	res, err := s.Repo.DB.ExecContext(ctx, `INSERT INTO ecommerce_orders ("integrationId","externalOrderId","status","rawPayloadHash") VALUES (?, ?, 'received', ?)`,
		integrationID, externalID, payloadHash)
	if err != nil {
		return 0, err
	}
	return res.LastInsertId()
}

// MarkProcessed links the order to the invoice made for it.
func (s *Service) MarkProcessed(ctx context.Context, orderID, invoiceID int64) error {
	_, err := s.Repo.DB.ExecContext(ctx, `UPDATE ecommerce_orders SET "status" = 'processed', "invoiceId" = ?, "processedAt" = ? WHERE "id" = ?`,
		invoiceID, s.now(), orderID)
	return err
}

// MarkFailed keeps the reason an order could not be invoiced.
func (s *Service) MarkFailed(ctx context.Context, orderID int64, message string) error {
	if len(message) > 500 {
		message = string([]rune(message)[:min(500, utf8.RuneCountInString(message))])
	}
	_, err := s.Repo.DB.ExecContext(ctx, `UPDATE ecommerce_orders SET "status" = 'failed', "errorMessage" = ?, "processedAt" = ? WHERE "id" = ?`,
		message, s.now(), orderID)
	return err
}

// Touch stamps the integration with the time of its latest webhook.
func (s *Service) Touch(ctx context.Context, integrationID int64) error {
	_, err := s.Repo.DB.ExecContext(ctx, `UPDATE ecommerce_integrations SET "lastEventAt" = ? WHERE "id" = ?`, s.now(), integrationID)
	return err
}
