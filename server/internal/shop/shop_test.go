package shop

import (
	"context"
	"errors"
	"testing"
	"time"

	"github.com/Raktim94/mavri/server/internal/db"
	"github.com/Raktim94/mavri/server/internal/model"
	"github.com/Raktim94/mavri/server/internal/store"
)

func newShop(t *testing.T, markPaid bool) (*Service, model.Shop, string) {
	t.Helper()
	d, err := db.Open(":memory:")
	if err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() { d.Close() })
	ctx := context.Background()
	st := &store.Store{DB: d, Now: func() time.Time { return time.Date(2026, 10, 12, 9, 0, 0, 0, time.UTC) }}
	issuer := model.Party{Kind: "issuer", Name: "Me"}
	if err := store.Parties.Insert(ctx, d, &issuer); err != nil {
		t.Fatal(err)
	}
	box, err := NewBox(t.TempDir(), "")
	if err != nil {
		t.Fatal(err)
	}
	svc := &Service{Store: st, Box: box}
	sh, secret, err := svc.Create(ctx, model.Shop{Name: "Shop", Platform: "generic", IssuerID: issuer.ID, CurrencyID: 1, DefaultTax: 10, MarkPaid: markPaid}, 0)
	if err != nil {
		t.Fatal(err)
	}
	return svc, sh, secret
}

const generic = `{"externalOrderId":"A-1","customer":{"name":"Zed","email":"zed@example.com"},"lineItems":[{"name":"Thing","quantity":2,"unitPriceMajor":"12.50"}],"shippingMajor":5,"paid":true}`

func TestBoxRoundTrip(t *testing.T) {
	b, _ := NewBox(t.TempDir(), "")
	s, _ := b.Seal("hunter2")
	if s == "hunter2" {
		t.Fatal("not sealed")
	}
	if got, err := b.Open(s); err != nil || got != "hunter2" {
		t.Fatalf("open: %q %v", got, err)
	}
	if _, err := b.Open(s + "x"); err == nil {
		t.Fatal("tampered value opened")
	}
	if _, err := NewBox("", "short"); err == nil {
		t.Fatal("bad key accepted")
	}
	dir := t.TempDir()
	b1, _ := NewBox(dir, "")
	b2, _ := NewBox(dir, "")
	sealed, _ := b1.Seal("x")
	if got, err := b2.Open(sealed); err != nil || got != "x" {
		t.Fatal("key file was not reused")
	}
}

func TestSignatures(t *testing.T) {
	body := []byte(`{"a":1}`)
	for _, p := range Platforms {
		sig := Sign(p, body, "s3cret")
		if !Verify(p, body, sig, "s3cret") || Verify(p, body, sig, "other") || Verify(p, []byte(`{"a":2}`), sig, "s3cret") || Verify(p, body, "", "s3cret") {
			t.Errorf("%s: verification", p)
		}
	}
	if Sign("generic", body, "k") == Sign("shopify", body, "k") {
		t.Error("generic is hex, shopify is base64")
	}
}

func TestReceiveCreatesInvoiceOnce(t *testing.T) {
	svc, sh, secret := newShop(t, true)
	ctx := context.Background()
	body := []byte(generic)
	id, dup, err := svc.Receive(ctx, sh.ID, "generic", body, Sign("generic", body, secret))
	if err != nil || dup || id == 0 {
		t.Fatalf("first: %d %v %v", id, dup, err)
	}
	doc, _ := svc.Store.GetDocument(ctx, svc.Store.DB, id)
	// 2 x 12.50 = 25.00, +10% tax = 27.50, + 5.00 shipping = 32.50, paid in full.
	if doc.Totals.TotalCents != 3250 || doc.Status != "paid" || doc.Customer.Name != "Zed" || doc.Customer.Email != "zed@example.com" {
		t.Fatalf("doc: %+v %+v", doc.Totals, doc.Customer)
	}
	id2, dup, err := svc.Receive(ctx, sh.ID, "generic", body, Sign("generic", body, secret))
	if err != nil || !dup || id2 != id {
		t.Fatalf("repeat: %d %v %v", id2, dup, err)
	}
	// The same customer email reuses the customer.
	body2 := []byte(`{"externalOrderId":"A-2","customer":{"name":"Zed Z","email":"ZED@example.com"},"lineItems":[{"name":"X","quantity":1,"unitPriceMajor":1}]}`)
	id3, _, err := svc.Receive(ctx, sh.ID, "generic", body2, Sign("generic", body2, secret))
	if err != nil {
		t.Fatal(err)
	}
	doc3, _ := svc.Store.GetDocument(ctx, svc.Store.DB, id3)
	if doc3.CustomerID != doc.CustomerID || doc3.Status != "unpaid" {
		t.Fatalf("second order: %+v", doc3)
	}
}

func TestReceiveRejections(t *testing.T) {
	svc, sh, secret := newShop(t, false)
	ctx := context.Background()
	body := []byte(generic)
	if _, _, err := svc.Receive(ctx, sh.ID, "generic", body, "nope"); !errors.Is(err, ErrBadSignature) {
		t.Fatalf("bad signature: %v", err)
	}
	if _, _, err := svc.Receive(ctx, sh.ID, "shopify", body, Sign("shopify", body, secret)); !errors.Is(err, db.ErrNotFound) {
		t.Fatalf("wrong platform: %v", err)
	}
	if _, _, err := svc.Receive(ctx, 999, "generic", body, "x"); !errors.Is(err, db.ErrNotFound) {
		t.Fatalf("unknown shop: %v", err)
	}
	bad := []byte(`{"externalOrderId":"B","lineItems":[]}`)
	if _, _, err := svc.Receive(ctx, sh.ID, "generic", bad, Sign("generic", bad, secret)); !errors.Is(err, ErrBadOrder) {
		t.Fatalf("empty order: %v", err)
	}
	if err := svc.Pause(ctx, sh.ID); err != nil {
		t.Fatal(err)
	}
	if _, _, err := svc.Receive(ctx, sh.ID, "generic", body, Sign("generic", body, secret)); !errors.Is(err, ErrInactive) {
		t.Fatalf("paused: %v", err)
	}
}

func TestParsePlatforms(t *testing.T) {
	shopify := `{"id":820982911946154508,"email":"j@x.com","currency":"EUR","financial_status":"paid","note":"hi",
	  "customer":{"first_name":"Jo","last_name":"Doe"},"billing_address":{"address1":"1 Main","zip":"12345","city":"Town","country_code":"DE"},
	  "line_items":[{"title":"Hat","quantity":2,"price":"10.00"}],"shipping_lines":[{"price":"3.50"}],"tax_lines":[{"rate":0.19}]}`
	o, err := ParseOrder("shopify", []byte(shopify))
	if err != nil || o.ExternalID != "820982911946154508" || o.Customer.Name != "Jo Doe" || o.Customer.Address != "1 Main\n12345 Town" ||
		!o.Paid || o.ShippingMajor != 3.5 || o.TaxRatePercent == nil || int(*o.TaxRatePercent*100) != 1900 || o.Lines[0].UnitPriceMajor != 10 {
		t.Fatalf("shopify: %+v %v", o, err)
	}
	woo := `{"id":727,"status":"processing","currency":"USD","billing":{"first_name":"Ann","last_name":"Lee","email":"a@x.com","phone":"1","address_1":"2 Rd","postcode":"9","city":"C","country":"US"},
	  "line_items":[{"name":"Mug","quantity":3,"price":4,"total":"12.00"}],"shipping_total":"2.00"}`
	o, err = ParseOrder("woocommerce", []byte(woo))
	if err != nil || o.ExternalID != "727" || o.Customer.Email != "a@x.com" || !o.Paid || o.ShippingMajor != 2 || o.Lines[0].Quantity != 3 {
		t.Fatalf("woo: %+v %v", o, err)
	}
	if _, err := ParseOrder("generic", []byte(`{"externalOrderId":"x","lineItems":[{"name":"","quantity":1,"unitPriceMajor":1}]}`)); err == nil {
		t.Fatal("blank line name accepted")
	}
	if _, err := ParseOrder("nope", nil); err == nil {
		t.Fatal("unknown platform")
	}
}
