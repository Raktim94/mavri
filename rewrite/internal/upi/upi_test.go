package upi

import (
	"context"
	"errors"
	"net/http"
	"strings"
	"testing"
	"time"
)

var t0 = time.Date(2026, 10, 11, 10, 0, 0, 0, time.UTC)

func TestValidVPA(t *testing.T) {
	good := []string{"shop@okaxis", "9876543210@ybl", "my.shop-1_x@paytm", "ab@cd"}
	bad := []string{"", "shop", "@okaxis", "shop@", "shop@ok axis", "a@b", "shop@@bank", "-x@bank", "shop@1bank", "sh op@bank"}
	for _, s := range good {
		if !ValidVPA(s) {
			t.Errorf("%q should be valid", s)
		}
	}
	for _, s := range bad {
		if ValidVPA(s) {
			t.Errorf("%q should be invalid", s)
		}
	}
}

func TestIntentURL(t *testing.T) {
	got, err := IntentURL(Request{PayeeVPA: "shop@okaxis", PayeeName: "Raktim & Sons", AmountPaise: 123450,
		InvoiceNumber: "INV/2026-27/0001", Ref: "INV-2026-27-0001", Note: "Invoice INV/2026-27/0001"})
	if err != nil {
		t.Fatal(err)
	}
	want := "upi://pay?pa=shop%40okaxis&pn=Raktim%20%26%20Sons&am=1234.50&cu=INR&tr=INV-2026-27-0001&tn=Invoice%20INV%2F2026-27%2F0001"
	if got != want {
		t.Fatalf("\n got  %s\n want %s", got, want)
	}
	if strings.Contains(got, "+") {
		t.Fatal("spaces must be %20, not +")
	}
}

func TestAmountFormatting(t *testing.T) {
	for p, want := range map[int64]string{1: "0.01", 100: "1.00", 99: "0.99", 100000: "1000.00", 123456789: "1234567.89"} {
		if got := formatPaise(p); got != want {
			t.Errorf("%d: got %s want %s", p, got, want)
		}
	}
}

func TestRequestValidation(t *testing.T) {
	ok := Request{PayeeVPA: "shop@okaxis", PayeeName: "Shop", AmountPaise: 100, Ref: "R1"}
	cases := map[string]struct {
		mut  func(*Request)
		want error
	}{
		"bad vpa":     {func(r *Request) { r.PayeeVPA = "nope" }, ErrInvalidVPA},
		"zero amount": {func(r *Request) { r.AmountPaise = 0 }, ErrInvalidAmount},
		"negative":    {func(r *Request) { r.AmountPaise = -5 }, ErrInvalidAmount},
		"huge":        {func(r *Request) { r.AmountPaise = 1 << 60 }, ErrInvalidAmount},
		"bad ref":     {func(r *Request) { r.Ref = "has space" }, ErrInvalidRef},
		"long ref":    {func(r *Request) { r.Ref = strings.Repeat("a", 36) }, ErrInvalidRef},
		"empty payee": {func(r *Request) { r.PayeeName = " \x00 " }, ErrInvalidPayee},
	}
	for name, c := range cases {
		r := ok
		c.mut(&r)
		if _, err := IntentURL(r); !errors.Is(err, c.want) {
			t.Errorf("%s: got %v want %v", name, err, c.want)
		}
	}
	long := ok
	long.Note = strings.Repeat("é", 80)
	u, _ := IntentURL(long)
	if strings.Count(u, "%C3%A9") != 50 {
		t.Errorf("note must be truncated to 50 characters: %s", u)
	}
}

func TestDescribeAndStatic(t *testing.T) {
	s, err := Describe(Request{PayeeVPA: "shop@okaxis", PayeeName: "Shop", AmountPaise: 250, InvoiceNumber: "INV-1", Ref: "R1"})
	if err != nil || s.Amount != "INR 2.50" || s.PayeeVPA != "shop@okaxis" || s.InvoiceNumber != "INV-1" {
		t.Fatalf("%+v %v", s, err)
	}
	u, err := StaticURL("shop@okaxis", "My Shop")
	if err != nil || u != "upi://pay?pa=shop%40okaxis&pn=My%20Shop&cu=INR" || strings.Contains(u, "am=") {
		t.Fatalf("%s %v", u, err)
	}
}

func newPay(t *testing.T) *Payment {
	t.Helper()
	p, err := NewPayment("p1", "inv1", "REF-1", 50000, t0.Add(30*time.Minute))
	if err != nil {
		t.Fatal(err)
	}
	return p
}

func ev(src Source, id, txn string, amount int64) Evidence {
	return Evidence{Source: src, EventID: id, ProviderTxnID: txn, Ref: "REF-1", Amount: amount, Currency: "INR", At: t0}
}

func TestOnlyTrustedEvidenceMarksPaid(t *testing.T) {
	for _, src := range []Source{ClientRedirect, CustomerClaim, System, Source("anything")} {
		p := newPay(t)
		applied, err := p.ConfirmPaid(ev(src, "e1", "T1", 50000))
		if applied || !errors.Is(err, ErrUntrustedSource) || p.Status != Pending {
			t.Fatalf("%s must not mark paid: %v %v %s", src, applied, err, p.Status)
		}
	}
	for _, src := range []Source{ProviderLookup, ProviderWebhook} {
		p := newPay(t)
		applied, err := p.ConfirmPaid(ev(src, "e1", "T1", 50000))
		if !applied || err != nil || p.Status != Paid || p.PaidTxnID != "T1" {
			t.Fatalf("%s should mark paid: %v %v %s", src, applied, err, p.Status)
		}
	}
}

func TestEvidenceMustMatchExactly(t *testing.T) {
	bad := []Evidence{ev(ProviderWebhook, "a", "T", 49999), ev(ProviderWebhook, "b", "T", 50001)}
	wrongRef := ev(ProviderWebhook, "c", "T", 50000)
	wrongRef.Ref = "OTHER"
	wrongCur := ev(ProviderWebhook, "d", "T", 50000)
	wrongCur.Currency = "USD"
	bad = append(bad, wrongRef, wrongCur)
	for _, e := range bad {
		p := newPay(t)
		if _, err := p.ConfirmPaid(e); !errors.Is(err, ErrMismatch) || p.Status != Pending {
			t.Errorf("%+v: got %v status %s", e, err, p.Status)
		}
	}
}

func TestDuplicateWebhookDeliveryIsIdempotent(t *testing.T) {
	p := newPay(t)
	e := ev(ProviderWebhook, "evt-1", "T1", 50000)
	if a, err := p.ConfirmPaid(e); !a || err != nil {
		t.Fatal("first delivery should apply")
	}
	for i := 0; i < 3; i++ {
		if a, err := p.ConfirmPaid(e); a || err != nil {
			t.Fatalf("redelivery %d: applied=%v err=%v", i, a, err)
		}
	}
	// Same transaction reported under a new event id is also a no-op.
	if a, err := p.ConfirmPaid(ev(ProviderLookup, "evt-2", "T1", 50000)); a || err != nil {
		t.Fatalf("same txn new event: %v %v", a, err)
	}
	if p.Status != Paid {
		t.Fatal("status changed")
	}
}

func TestSecondDistinctTransactionIsFlaggedNotCredited(t *testing.T) {
	p := newPay(t)
	_, _ = p.ConfirmPaid(ev(ProviderWebhook, "e1", "T1", 50000))
	a, err := p.ConfirmPaid(ev(ProviderWebhook, "e2", "T2", 50000))
	if a || !errors.Is(err, ErrDuplicatePayment) || p.PaidTxnID != "T1" {
		t.Fatalf("%v %v %s", a, err, p.PaidTxnID)
	}
}

func TestLateConfirmationAfterExpiryIsAccepted(t *testing.T) {
	p := newPay(t)
	if p.ExpireIfDue(t0.Add(29 * time.Minute)) {
		t.Fatal("not yet due")
	}
	if !p.ExpireIfDue(t0.Add(31*time.Minute)) || p.Status != Expired {
		t.Fatal("should expire")
	}
	if a, err := p.ConfirmPaid(ev(ProviderWebhook, "e1", "T1", 50000)); !a || err != nil || p.Status != Paid {
		t.Fatalf("money really received must be recorded: %v %v %s", a, err, p.Status)
	}
	last := p.Audit[len(p.Audit)-1]
	if last.Event != "paid" || last.Detail != "late_confirmation" {
		t.Fatalf("audit %+v", last)
	}
}

func TestFailedThenCannotBecomePaidByAccident(t *testing.T) {
	p := newPay(t)
	if err := p.MarkFailed(ev(ClientRedirect, "f0", "", 0)); !errors.Is(err, ErrUntrustedSource) {
		t.Fatal("redirect must not mark failed")
	}
	if err := p.MarkFailed(ev(ProviderWebhook, "f1", "", 0)); err != nil || p.Status != Failed {
		t.Fatal(err)
	}
	if _, err := p.ConfirmPaid(ev(ProviderWebhook, "e1", "T1", 50000)); !errors.Is(err, ErrInvalidTransition) {
		t.Fatalf("failed -> paid must need a new request: %v", err)
	}
}

func TestRefunds(t *testing.T) {
	p := newPay(t)
	if err := p.Refund(ev(ProviderWebhook, "r0", "", 0), 100); !errors.Is(err, ErrInvalidTransition) {
		t.Fatal("cannot refund unpaid")
	}
	_, _ = p.ConfirmPaid(ev(ProviderWebhook, "e1", "T1", 50000))
	if err := p.Refund(ev(CustomerClaim, "r1", "", 0), 100); !errors.Is(err, ErrUntrustedSource) {
		t.Fatal("refund needs trusted evidence")
	}
	if err := p.Refund(ev(ProviderWebhook, "r2", "", 0), 20000); err != nil || p.Status != PartiallyRefunded || p.RefundedAmount != 20000 {
		t.Fatalf("%v %s", err, p.Status)
	}
	if err := p.Refund(ev(ProviderWebhook, "r2", "", 0), 20000); err != nil || p.RefundedAmount != 20000 {
		t.Fatal("redelivered refund must not double count")
	}
	if err := p.Refund(ev(ProviderWebhook, "r3", "", 0), 30001); !errors.Is(err, ErrInvalidRefund) {
		t.Fatal("cannot refund more than was paid")
	}
	if err := p.Refund(ev(ProviderWebhook, "r4", "", 0), 30000); err != nil || p.Status != Refunded {
		t.Fatalf("%v %s", err, p.Status)
	}
}

func TestAuditTrailRecordsRejections(t *testing.T) {
	p := newPay(t)
	_, _ = p.ConfirmPaid(ev(ClientRedirect, "e0", "T0", 50000))
	_, _ = p.ConfirmPaid(ev(ProviderWebhook, "e1", "T1", 50000))
	_, _ = p.ConfirmPaid(ev(ProviderWebhook, "e1", "T1", 50000))
	var events []string
	for _, a := range p.Audit {
		events = append(events, a.Event)
	}
	if strings.Join(events, ",") != "rejected,paid,duplicate_ignored" {
		t.Fatalf("audit = %v", events)
	}
}

func TestNewPaymentValidation(t *testing.T) {
	if _, err := NewPayment("p", "i", "REF", 0, t0); !errors.Is(err, ErrInvalidAmount) {
		t.Fatal(err)
	}
	if _, err := NewPayment("p", "i", "bad ref", 100, t0); !errors.Is(err, ErrInvalidRef) {
		t.Fatal(err)
	}
}

// fakeProvider shows the Provider boundary can be satisfied; it is a test double.
type fakeProvider struct{}

func (fakeProvider) Name() string { return "fake" }
func (fakeProvider) LookupStatus(context.Context, string) (ProviderStatus, error) {
	return ProviderStatus{Status: Paid}, nil
}
func (fakeProvider) ParseWebhook(http.Header, []byte) (Evidence, error) {
	return Evidence{Source: ProviderWebhook}, nil
}

var _ Provider = fakeProvider{}
