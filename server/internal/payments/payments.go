// Package payments lets clients pay an invoice online through Stripe Checkout.
// Card details never reach Mavri: the client pays on Stripe's page, and Stripe
// tells Mavri about the result with a signed webhook, which records the payment.
package payments

import (
	"context"
	"crypto/hmac"
	"crypto/sha256"
	"database/sql"
	"encoding/hex"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"strconv"
	"strings"
	"time"

	"github.com/Raktim94/mavri/server/internal/activity"
	"github.com/Raktim94/mavri/server/internal/model"
	"github.com/Raktim94/mavri/server/internal/money"
	"github.com/Raktim94/mavri/server/internal/shop"
	"github.com/Raktim94/mavri/server/internal/store"
)

// Errors the HTTP layer maps to answers.
var (
	ErrInvalid      = errors.New("invalid")
	ErrNotAvailable = errors.New("online payment is not available for this document")
	ErrSignature    = errors.New("the signature does not match")
)

// Config is the gateway setup. Secrets are never returned.
type Config struct {
	Enabled          bool   `json:"enabled"`
	SecretKey        string `json:"secretKey,omitempty"`
	SecretKeySet     bool   `json:"secretKeySet"`
	WebhookSecret    string `json:"webhookSecret,omitempty"`
	WebhookSecretSet bool   `json:"webhookSecretSet"`

	keySealed, whSealed string
}

// Service talks to Stripe and applies its events.
type Service struct {
	DB      *sql.DB
	Box     *shop.Box
	Store   *store.Store
	Hub     *activity.Hub
	APIBase string // https://api.stripe.com; tests point it at a local server
	HTTP    *http.Client
	Now     func() time.Time
}

func (s *Service) now() time.Time {
	if s.Now != nil {
		return s.Now()
	}
	return time.Now()
}

type stored struct {
	Enabled   bool   `json:"enabled"`
	KeySealed string `json:"keySealed"`
	WHSealed  string `json:"whSealed"`
}

// Load returns the saved setup without secrets.
func (s *Service) Load(ctx context.Context) (Config, error) {
	var raw string
	err := s.DB.QueryRowContext(ctx, `SELECT value FROM settings WHERE key = 'payments'`).Scan(&raw)
	if errors.Is(err, sql.ErrNoRows) {
		return Config{}, nil
	}
	if err != nil {
		return Config{}, err
	}
	var st stored
	_ = json.Unmarshal([]byte(raw), &st)
	return Config{Enabled: st.Enabled, SecretKeySet: st.KeySealed != "", WebhookSecretSet: st.WHSealed != "", keySealed: st.KeySealed, whSealed: st.WHSealed}, nil
}

// Save validates and stores the setup. Empty secrets keep the saved ones.
func (s *Service) Save(ctx context.Context, in Config) error {
	old, err := s.Load(ctx)
	if err != nil {
		return err
	}
	key, wh := old.keySealed, old.whSealed
	if k := strings.TrimSpace(in.SecretKey); k != "" {
		if !strings.HasPrefix(k, "sk_") && !strings.HasPrefix(k, "rk_") {
			return fmt.Errorf("%w: the Stripe secret key starts with sk_ (or rk_ for a restricted key)", ErrInvalid)
		}
		if key, err = s.Box.Seal(k); err != nil {
			return err
		}
	}
	if w := strings.TrimSpace(in.WebhookSecret); w != "" {
		if !strings.HasPrefix(w, "whsec_") {
			return fmt.Errorf("%w: the webhook signing secret starts with whsec_", ErrInvalid)
		}
		if wh, err = s.Box.Seal(w); err != nil {
			return err
		}
	}
	if in.Enabled && (key == "" || wh == "") {
		return fmt.Errorf("%w: add the secret key and the webhook signing secret before switching online payments on", ErrInvalid)
	}
	raw, _ := json.Marshal(stored{Enabled: in.Enabled, KeySealed: key, WHSealed: wh})
	_, err = s.DB.ExecContext(ctx, `INSERT INTO settings (key, value) VALUES ('payments', ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value`, string(raw))
	return err
}

// Enabled reports whether clients can pay online.
func (s *Service) Enabled(ctx context.Context) bool {
	c, err := s.Load(ctx)
	return err == nil && c.Enabled
}

func (s *Service) base() string {
	if s.APIBase != "" {
		return strings.TrimRight(s.APIBase, "/")
	}
	return "https://api.stripe.com"
}

func (s *Service) client() *http.Client {
	if s.HTTP != nil {
		return s.HTTP
	}
	return &http.Client{Timeout: 20 * time.Second}
}

// Payable is what a client can pay now for a document, in minor units; 0 means nothing.
func Payable(d model.Document) int64 {
	if d.Kind != model.KindInvoice || (d.Status != model.StatusUnpaid && d.Status != model.StatusPartial) {
		return 0
	}
	if bal := d.Totals.TotalCents - d.PaidCents; bal > 0 {
		return bal
	}
	return 0
}

// CreateCheckout makes a Stripe Checkout page for the balance of an invoice and returns its address.
func (s *Service) CreateCheckout(ctx context.Context, d model.Document, successURL, cancelURL string) (string, error) {
	cfg, err := s.Load(ctx)
	if err != nil {
		return "", err
	}
	amount := Payable(d)
	if !cfg.Enabled || amount == 0 {
		return "", ErrNotAvailable
	}
	if d.Currency.Decimals != 0 && d.Currency.Decimals != 2 {
		return "", fmt.Errorf("%w: online payment supports currencies with 0 or 2 decimals", ErrNotAvailable)
	}
	key, err := s.Box.Open(cfg.keySealed)
	if err != nil {
		return "", errors.New("the saved Stripe key cannot be read; enter it again")
	}
	f := url.Values{}
	f.Set("mode", "payment")
	f.Set("success_url", successURL)
	f.Set("cancel_url", cancelURL)
	f.Set("client_reference_id", strconv.FormatInt(d.ID, 10))
	f.Set("metadata[mavri_document]", strconv.FormatInt(d.ID, 10))
	f.Set("payment_intent_data[metadata][mavri_document]", strconv.FormatInt(d.ID, 10))
	f.Set("payment_intent_data[description]", fmt.Sprintf("Invoice %s from %s", d.FullNumber, d.Issuer.Name))
	f.Set("line_items[0][quantity]", "1")
	f.Set("line_items[0][price_data][currency]", strings.ToLower(d.Currency.Code))
	f.Set("line_items[0][price_data][unit_amount]", strconv.FormatInt(amount, 10))
	f.Set("line_items[0][price_data][product_data][name]", fmt.Sprintf("Invoice %s", d.FullNumber))
	if d.Customer.Email != "" {
		f.Set("customer_email", d.Customer.Email)
	}
	req, err := http.NewRequestWithContext(ctx, http.MethodPost, s.base()+"/v1/checkout/sessions", strings.NewReader(f.Encode()))
	if err != nil {
		return "", err
	}
	req.Header.Set("Authorization", "Bearer "+key)
	req.Header.Set("Content-Type", "application/x-www-form-urlencoded")
	resp, err := s.client().Do(req)
	if err != nil {
		return "", fmt.Errorf("could not reach Stripe: %w", err)
	}
	defer resp.Body.Close()
	body, _ := io.ReadAll(io.LimitReader(resp.Body, 1<<20))
	var out struct {
		ID    string `json:"id"`
		URL   string `json:"url"`
		Error struct {
			Message string `json:"message"`
		} `json:"error"`
	}
	_ = json.Unmarshal(body, &out)
	if resp.StatusCode/100 != 2 || out.URL == "" {
		msg := out.Error.Message
		if msg == "" {
			msg = fmt.Sprintf("Stripe answered %d", resp.StatusCode)
		}
		return "", errors.New("Stripe could not start the payment: " + msg)
	}
	return out.URL, nil
}

// Verify checks a Stripe-Signature header: "t=<unix>,v1=<hex>[,v1=<hex>]" with v1 = HMAC-SHA256(secret, "<t>.<body>").
func Verify(secret string, body []byte, header string, now time.Time, tolerance time.Duration) error {
	var t string
	var sigs []string
	for _, part := range strings.Split(header, ",") {
		k, v, ok := strings.Cut(strings.TrimSpace(part), "=")
		switch {
		case ok && k == "t":
			t = v
		case ok && k == "v1":
			sigs = append(sigs, v)
		}
	}
	ts, err := strconv.ParseInt(t, 10, 64)
	if err != nil || len(sigs) == 0 {
		return ErrSignature
	}
	if d := now.Sub(time.Unix(ts, 0)); d > tolerance || d < -tolerance {
		return fmt.Errorf("%w: the timestamp is too old", ErrSignature)
	}
	m := hmac.New(sha256.New, []byte(secret))
	m.Write([]byte(t + "."))
	m.Write(body)
	want := hex.EncodeToString(m.Sum(nil))
	for _, s := range sigs {
		if hmac.Equal([]byte(s), []byte(want)) {
			return nil
		}
	}
	return ErrSignature
}

type event struct {
	ID   string `json:"id"`
	Type string `json:"type"`
	Data struct {
		Object struct {
			ID                string            `json:"id"`
			PaymentStatus     string            `json:"payment_status"`
			AmountTotal       int64             `json:"amount_total"`
			Amount            int64             `json:"amount"`
			Currency          string            `json:"currency"`
			ClientReferenceID string            `json:"client_reference_id"`
			Metadata          map[string]string `json:"metadata"`
			LastPaymentError  struct {
				Message string `json:"message"`
			} `json:"last_payment_error"`
		} `json:"object"`
	} `json:"data"`
}

// HandleWebhook verifies and applies one Stripe event. Each event id is applied once.
func (s *Service) HandleWebhook(ctx context.Context, body []byte, header string) error {
	cfg, err := s.Load(ctx)
	if err != nil {
		return err
	}
	if cfg.whSealed == "" {
		return fmt.Errorf("%w: online payments are not set up", ErrNotAvailable)
	}
	secret, err := s.Box.Open(cfg.whSealed)
	if err != nil {
		return errors.New("the saved webhook secret cannot be read")
	}
	if err := Verify(secret, body, header, s.now(), 5*time.Minute); err != nil {
		return err
	}
	var ev event
	if err := json.Unmarshal(body, &ev); err != nil || ev.ID == "" {
		return fmt.Errorf("%w: unreadable event", ErrInvalid)
	}
	obj := ev.Data.Object
	docID, _ := strconv.ParseInt(firstNonEmpty(obj.Metadata["mavri_document"], obj.ClientReferenceID), 10, 64)
	ctx = activity.WithSource(ctx, activity.SourceHook, "Stripe")

	switch ev.Type {
	case "checkout.session.completed", "checkout.session.async_payment_succeeded":
		if obj.PaymentStatus != "paid" {
			return nil // completed but not yet paid (a delayed method): wait for async_payment_succeeded
		}
		return s.applyPayment(ctx, ev, docID, obj.AmountTotal, obj.Currency, obj.ID)
	case "checkout.session.async_payment_failed", "payment_intent.payment_failed":
		return s.recordFailure(ctx, ev, docID, firstNonEmpty(obj.LastPaymentError.Message, "the payment did not go through"))
	}
	return nil // other events are not needed
}

func firstNonEmpty(a ...string) string {
	for _, v := range a {
		if v != "" {
			return v
		}
	}
	return ""
}

// claim reserves the event id; false means it was already handled.
func (s *Service) claim(ctx context.Context, ev event, docID, amount int64, outcome string) (bool, error) {
	res, err := s.DB.ExecContext(ctx, `INSERT OR IGNORE INTO gateway_events (event_id, provider, type, document_id, amount_cents, outcome, created_at)
		VALUES (?, 'stripe', ?, NULLIF(?, 0), ?, ?, ?)`, ev.ID, ev.Type, docID, amount, outcome, s.now().UTC().Format(time.RFC3339))
	if err != nil {
		return false, err
	}
	n, _ := res.RowsAffected()
	return n == 1, nil
}

func (s *Service) applyPayment(ctx context.Context, ev event, docID, amount int64, currency, session string) error {
	if docID == 0 || amount <= 0 {
		return fmt.Errorf("%w: the event does not say which invoice was paid", ErrInvalid)
	}
	fresh, err := s.claim(ctx, ev, docID, amount, "applied")
	if err != nil || !fresh {
		return err
	}
	old, err := s.Store.GetDocument(ctx, s.DB, docID)
	if err != nil {
		return s.outcome(ctx, ev, "document not found")
	}
	if !strings.EqualFold(currency, old.Currency.Code) {
		s.Hub.Record(ctx, activity.Event{Action: "payment not applied", Entity: old.Kind, EntityID: old.ID, Label: old.FullNumber,
			Detail: fmt.Sprintf("Stripe reported %s but the invoice is in %s; check it in your Stripe dashboard", strings.ToUpper(currency), old.Currency.Code)})
		return s.outcome(ctx, ev, "currency mismatch")
	}
	cur := old
	cur.Payments = append(append([]model.Payment{}, old.Payments...), model.Payment{AmountCents: amount, PaidOn: s.now().UTC().Format("2006-01-02"),
		Method: "card (Stripe)", Note: session})
	out, err := s.Store.UpdateDocument(ctx, old.ID, cur, store.SaveOptions{})
	if err != nil {
		_, _ = s.DB.ExecContext(ctx, `DELETE FROM gateway_events WHERE event_id = ?`, ev.ID) // let Stripe retry
		return err
	}
	for _, e := range activity.DocEvents(&old, out) {
		e.Detail = strings.TrimSpace(e.Detail + " (online, Stripe " + session + ")")
		s.Hub.Record(ctx, e)
	}
	return nil
}

func (s *Service) recordFailure(ctx context.Context, ev event, docID int64, reason string) error {
	fresh, err := s.claim(ctx, ev, docID, 0, "failed")
	if err != nil || !fresh || docID == 0 {
		return err
	}
	d, err := s.Store.GetDocument(ctx, s.DB, docID)
	if err != nil {
		return nil
	}
	data := activity.DocData(d)
	data["reason"] = reason
	s.Hub.Record(ctx, activity.Event{Action: "payment failed", Entity: d.Kind, EntityID: d.ID, Label: d.FullNumber, Detail: reason, Name: "payment.failed", Data: data})
	return nil
}

func (s *Service) outcome(ctx context.Context, ev event, outcome string) error {
	_, err := s.DB.ExecContext(ctx, `UPDATE gateway_events SET outcome = ? WHERE event_id = ?`, outcome, ev.ID)
	return err
}

// Describe formats a balance for the pay button.
func Describe(d model.Document) string { return money.Format(Payable(d), d.Currency) }
