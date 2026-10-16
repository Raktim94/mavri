package shop

import (
	"context"
	"crypto/rand"
	"database/sql"
	"encoding/base64"
	"errors"
	"fmt"
	"strings"

	"github.com/Raktim94/mavri/server/internal/db"
	"github.com/Raktim94/mavri/server/internal/model"
	"github.com/Raktim94/mavri/server/internal/money"
	"github.com/Raktim94/mavri/server/internal/store"
)

// Platforms a store can send from.
var Platforms = []string{"shopify", "woocommerce", "generic"}

// ValidPlatform reports whether p is one of Platforms.
func ValidPlatform(p string) bool {
	for _, k := range Platforms {
		if k == p {
			return true
		}
	}
	return false
}

// Errors the HTTP layer maps to status codes.
var (
	ErrBadSignature = errors.New("signature does not match")
	ErrInactive     = errors.New("this store connection is paused")
	ErrBadOrder     = errors.New("the order could not be read")
)

// Service owns the store connections.
type Service struct {
	Store *store.Store
	Box   *Box
}

func (s *Service) db() *sql.DB { return s.Store.DB }

// Create adds a connection and returns it with its signing secret, shown once.
func (s *Service) Create(ctx context.Context, sh model.Shop, createdBy int64) (model.Shop, string, error) {
	sh.Name = strings.TrimSpace(sh.Name)
	if sh.Name == "" || !ValidPlatform(sh.Platform) {
		return sh, "", store.Validation{Msg: "a name and a platform (shopify, woocommerce or generic) are required"}
	}
	if sh.DefaultTax < 0 || sh.DefaultTax > 100 {
		return sh, "", store.Validation{Msg: "default tax must be between 0 and 100"}
	}
	if _, err := store.Parties.Get(ctx, s.db(), sh.IssuerID); err != nil {
		return sh, "", store.Validation{Msg: "choose the issuer that sends these invoices"}
	}
	if _, err := store.Currencies.Get(ctx, s.db(), sh.CurrencyID); err != nil {
		return sh, "", store.Validation{Msg: "choose a currency"}
	}
	raw := make([]byte, 24)
	if _, err := rand.Read(raw); err != nil {
		return sh, "", err
	}
	secret := base64.RawURLEncoding.EncodeToString(raw)
	sealed, err := s.Box.Seal(secret)
	if err != nil {
		return sh, "", err
	}
	sh.SecretSeal, sh.Active, sh.ID = sealed, true, 0
	if createdBy != 0 {
		sh.CreatedBy = &createdBy
	}
	if err := store.Shops.Insert(ctx, s.db(), &sh); err != nil {
		return sh, "", err
	}
	return sh, secret, nil
}

// List returns every connection, newest first.
func (s *Service) List(ctx context.Context) ([]model.Shop, error) {
	return store.Shops.Select(ctx, s.db(), "ORDER BY id DESC")
}

// Pause stops a connection from accepting orders.
func (s *Service) Pause(ctx context.Context, id int64) error {
	res, err := s.db().ExecContext(ctx, `UPDATE shops SET active = 0 WHERE id = ?`, id)
	if err != nil {
		return err
	}
	if n, _ := res.RowsAffected(); n == 0 {
		return db.ErrNotFound
	}
	return nil
}

// Delete removes a connection; invoices it made stay.
func (s *Service) Delete(ctx context.Context, id int64) error {
	return store.Shops.Delete(ctx, s.db(), id)
}

// Receive handles a webhook: it verifies the signature, reads the order for
// the platform and records it. The second result is true for a repeated order.
func (s *Service) Receive(ctx context.Context, shopID int64, platform string, body []byte, signature string) (int64, bool, error) {
	sh, err := store.Shops.Get(ctx, s.db(), shopID)
	if err != nil || sh.Platform != platform {
		return 0, false, db.ErrNotFound
	}
	secret, err := s.Box.Open(sh.SecretSeal)
	if err != nil {
		return 0, false, err
	}
	if !Verify(platform, body, signature, secret) {
		return 0, false, ErrBadSignature
	}
	if !sh.Active {
		return 0, false, ErrInactive
	}
	order, err := ParseOrder(platform, body)
	if err != nil {
		return 0, false, fmt.Errorf("%w: %v", ErrBadOrder, err)
	}
	return s.Ingest(ctx, sh, order)
}

// Ingest turns an order into an invoice, once per external id.
func (s *Service) Ingest(ctx context.Context, sh model.Shop, o Order) (int64, bool, error) {
	if strings.TrimSpace(o.ExternalID) == "" || len(o.Lines) == 0 {
		return 0, false, fmt.Errorf("%w: an order id and at least one line are needed", ErrBadOrder)
	}
	var docID int64
	dup := false
	err := db.WithTx(ctx, s.db(), func(tx *sql.Tx) error {
		var existing sql.NullInt64
		err := tx.QueryRowContext(ctx, `SELECT document_id FROM shop_orders WHERE shop_id = ? AND external_id = ?`, sh.ID, o.ExternalID).Scan(&existing)
		if err == nil {
			docID, dup = existing.Int64, true
			return nil
		}
		if !errors.Is(err, sql.ErrNoRows) {
			return err
		}
		return nil
	})
	if err != nil || dup {
		return docID, dup, err
	}

	cur, err := store.Currencies.Get(ctx, s.db(), sh.CurrencyID)
	if err != nil {
		return 0, false, err
	}
	if o.Currency != "" && !strings.EqualFold(o.Currency, cur.Code) {
		if cs, _ := store.Currencies.Select(ctx, s.db(), "WHERE code = ?", strings.ToUpper(o.Currency)); len(cs) == 1 {
			cur = cs[0]
		}
	}
	cust, err := s.customerFor(ctx, o.Customer)
	if err != nil {
		return 0, false, err
	}
	rate := sh.DefaultTax
	if o.TaxRatePercent != nil {
		rate = *o.TaxRatePercent
	}
	doc := model.Document{Kind: model.KindInvoice, IssuerID: sh.IssuerID, CustomerID: cust.ID, CurrencyID: cur.ID,
		BankID: sh.BankID, StyleID: sh.StyleID, IssuedOn: s.Store.Today(), NoteCustomer: o.Notes,
		ShippingCents: money.ToMinor(o.ShippingMajor, cur.Decimals)}
	for _, l := range o.Lines {
		line := model.Line{Name: l.Name, Quantity: l.Quantity, UnitCents: money.ToMinor(l.UnitPriceMajor, cur.Decimals)}
		if rate > 0 {
			line.TaxRate, line.TaxMode = rate, "add"
		}
		doc.Lines = append(doc.Lines, line)
	}
	totals := money.Compute(&doc)
	if o.Paid && sh.MarkPaid {
		doc.Payments = []model.Payment{{AmountCents: totals.TotalCents, PaidOn: s.Store.Today(), Method: sh.Platform}}
	}
	created, err := s.Store.CreateDocument(ctx, doc, store.SaveOptions{})
	if err != nil {
		return 0, false, err
	}
	// A concurrent delivery of the same order loses here and reports the winner's invoice.
	res, err := s.db().ExecContext(ctx, `INSERT INTO shop_orders (shop_id, external_id, document_id, received_at) VALUES (?, ?, ?, ?)
		ON CONFLICT(shop_id, external_id) DO NOTHING`, sh.ID, o.ExternalID, created.ID, db.Now())
	if err != nil {
		return 0, false, err
	}
	if n, _ := res.RowsAffected(); n == 0 {
		_ = s.Store.DeleteDocument(ctx, created.ID)
		var winner int64
		if err := s.db().QueryRowContext(ctx, `SELECT document_id FROM shop_orders WHERE shop_id = ? AND external_id = ?`, sh.ID, o.ExternalID).Scan(&winner); err != nil {
			return 0, false, err
		}
		return winner, true, nil
	}
	_, _ = s.db().ExecContext(ctx, `UPDATE shops SET last_event_at = ? WHERE id = ?`, db.Now(), sh.ID)
	return created.ID, false, nil
}

// customerFor finds a customer by email (or exact name), creating one if needed.
func (s *Service) customerFor(ctx context.Context, c Customer) (model.Party, error) {
	name := strings.TrimSpace(c.Name)
	if name == "" {
		name = strings.TrimSpace(c.Email)
	}
	if name == "" {
		name = "Online customer"
	}
	if c.Email != "" {
		ps, err := store.Parties.Select(ctx, s.db(), "WHERE kind = 'customer' AND lower(email) = lower(?) ORDER BY id LIMIT 1", c.Email)
		if err != nil {
			return model.Party{}, err
		}
		if len(ps) == 1 {
			return ps[0], nil
		}
	} else {
		ps, err := store.Parties.Select(ctx, s.db(), "WHERE kind = 'customer' AND name = ? ORDER BY id LIMIT 1", name)
		if err != nil {
			return model.Party{}, err
		}
		if len(ps) == 1 {
			return ps[0], nil
		}
	}
	p := model.Party{Kind: "customer", Name: name, Email: c.Email, Phone: c.Phone, Address: c.Address, Country: strings.ToUpper(c.Country)}
	if len(p.Country) != 2 {
		p.Country = ""
	}
	if err := store.Parties.Insert(ctx, s.db(), &p); err != nil {
		return p, err
	}
	return p, nil
}

// Preview is what Ingest would do with an order, without doing it.
type Preview struct {
	DryRun     bool            `json:"dryRun"`
	Duplicate  bool            `json:"duplicate"` // this order id was already turned into an invoice
	DocumentID int64           `json:"documentId,omitempty"`
	Customer   PreviewCustomer `json:"customer"`
	Currency   string          `json:"currency"`
	Lines      []PreviewLine   `json:"lines"`
	Shipping   int64           `json:"shippingCents"`
	TaxRate    float64         `json:"taxRate"`
	Totals     model.Totals    `json:"totals"`
	MarkPaid   bool            `json:"markPaid"`
	Warnings   []string        `json:"warnings"`
}

// PreviewCustomer says whether the order's customer already exists.
type PreviewCustomer struct {
	ID         int64  `json:"id,omitempty"`
	Name       string `json:"name"`
	Email      string `json:"email"`
	WillCreate bool   `json:"willCreate"`
}

// PreviewLine is one line as it would be stored.
type PreviewLine struct {
	Name      string  `json:"name"`
	Quantity  float64 `json:"quantity"`
	UnitCents int64   `json:"unitCents"`
}

// Preview shows the invoice an order would become and writes nothing: no customer, no invoice, no record of the order.
func (s *Service) Preview(ctx context.Context, sh model.Shop, o Order) (Preview, error) {
	p := Preview{DryRun: true, Warnings: []string{}, Lines: []PreviewLine{}}
	if strings.TrimSpace(o.ExternalID) == "" || len(o.Lines) == 0 {
		return p, fmt.Errorf("%w: an order id and at least one line are needed", ErrBadOrder)
	}
	var existing sql.NullInt64
	err := s.db().QueryRowContext(ctx, `SELECT document_id FROM shop_orders WHERE shop_id = ? AND external_id = ?`, sh.ID, o.ExternalID).Scan(&existing)
	if err == nil {
		p.Duplicate, p.DocumentID = true, existing.Int64
		p.Warnings = append(p.Warnings, "This order was already turned into an invoice, so sending it again changes nothing.")
	} else if !errors.Is(err, sql.ErrNoRows) {
		return p, err
	}
	cur, err := store.Currencies.Get(ctx, s.db(), sh.CurrencyID)
	if err != nil {
		return p, err
	}
	if o.Currency != "" && !strings.EqualFold(o.Currency, cur.Code) {
		if cs, _ := store.Currencies.Select(ctx, s.db(), "WHERE code = ?", strings.ToUpper(o.Currency)); len(cs) == 1 {
			cur = cs[0]
		} else {
			p.Warnings = append(p.Warnings, fmt.Sprintf("The order is in %s, which is not one of your currencies, so the store's currency %s is used.", strings.ToUpper(o.Currency), cur.Code))
		}
	}
	p.Currency = cur.Code
	p.Customer = PreviewCustomer{Name: strings.TrimSpace(o.Customer.Name), Email: o.Customer.Email, WillCreate: true}
	if p.Customer.Name == "" {
		p.Customer.Name = firstText(o.Customer.Email, "Online customer")
	}
	if o.Customer.Email != "" {
		if ps, _ := store.Parties.Select(ctx, s.db(), "WHERE kind = 'customer' AND lower(email) = lower(?) ORDER BY id LIMIT 1", o.Customer.Email); len(ps) == 1 {
			p.Customer.ID, p.Customer.WillCreate = ps[0].ID, false
		}
	} else if ps, _ := store.Parties.Select(ctx, s.db(), "WHERE kind = 'customer' AND name = ? ORDER BY id LIMIT 1", p.Customer.Name); len(ps) == 1 {
		p.Customer.ID, p.Customer.WillCreate = ps[0].ID, false
	}
	rate := sh.DefaultTax
	if o.TaxRatePercent != nil {
		rate = *o.TaxRatePercent
	}
	p.TaxRate = rate
	doc := model.Document{Kind: model.KindInvoice, ShippingCents: money.ToMinor(o.ShippingMajor, cur.Decimals)}
	for _, l := range o.Lines {
		line := model.Line{Name: l.Name, Quantity: l.Quantity, UnitCents: money.ToMinor(l.UnitPriceMajor, cur.Decimals)}
		if rate > 0 {
			line.TaxRate, line.TaxMode = rate, "add"
		}
		doc.Lines = append(doc.Lines, line)
		p.Lines = append(p.Lines, PreviewLine{l.Name, l.Quantity, line.UnitCents})
	}
	p.Shipping = doc.ShippingCents
	p.Totals = money.Compute(&doc)
	p.MarkPaid = o.Paid && sh.MarkPaid
	if rate > 0 {
		p.Warnings = append(p.Warnings, fmt.Sprintf("%v%% tax will be added on top of the line prices. If the store's prices already include tax, or the store or marketplace collected the tax itself, set the store's default tax to 0 so it is not charged twice.", rate))
	}
	if o.Paid && !sh.MarkPaid {
		p.Warnings = append(p.Warnings, "The order says it is paid, but this store connection does not record payments; the invoice will be unpaid.")
	}
	return p, nil
}

func firstText(vals ...string) string {
	for _, v := range vals {
		if strings.TrimSpace(v) != "" {
			return strings.TrimSpace(v)
		}
	}
	return ""
}
