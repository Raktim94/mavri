package billing

import (
	"errors"
	"reflect"
	"strings"
	"testing"
	"time"

	"github.com/Raktim94/nodedr-invoice/rewrite/internal/money"
)

func newInv(total int64) *Invoice {
	return &Invoice{Status: Draft, Currency: "INR", Total: total, Due: d("2026-11-01")}
}

func TestInvoiceLifecycle(t *testing.T) {
	inv := newInv(10000)
	if !inv.CanEdit() {
		t.Fatal("drafts are editable")
	}
	if err := inv.RecordPayment(100); !errors.Is(err, ErrInvalidStatus) {
		t.Fatal("cannot pay a draft")
	}
	if err := inv.Issue(); err != nil || inv.CanEdit() {
		t.Fatal("issued invoices are immutable")
	}
	if err := inv.Issue(); !errors.Is(err, ErrInvalidStatus) {
		t.Fatal("cannot issue twice")
	}
	if err := inv.RecordPayment(4000); err != nil || inv.Status != PartiallyPaid || inv.Outstanding() != 6000 {
		t.Fatalf("%v %s %d", err, inv.Status, inv.Outstanding())
	}
	if err := inv.RecordPayment(6001); !errors.Is(err, ErrOverpayment) {
		t.Fatal("overpayment must be rejected")
	}
	if err := inv.RecordPayment(0); !errors.Is(err, ErrInvalidAmount) {
		t.Fatal("zero payment")
	}
	if err := inv.RecordPayment(6000); err != nil || inv.Status != Paid || inv.Outstanding() != 0 {
		t.Fatalf("%v %s", err, inv.Status)
	}
	if err := inv.RecordPayment(1); !errors.Is(err, ErrInvalidStatus) {
		t.Fatal("paid invoices take no more payments")
	}
}

func TestVoidRules(t *testing.T) {
	draft := newInv(100)
	if err := draft.Void(); err != nil || draft.Status != Void {
		t.Fatal(err)
	}
	if err := draft.Void(); !errors.Is(err, ErrInvalidStatus) {
		t.Fatal("already void")
	}
	issued := newInv(100)
	_ = issued.Issue()
	if err := issued.Void(); err != nil {
		t.Fatal("unpaid issued invoice can be voided")
	}
	partly := newInv(100)
	_ = partly.Issue()
	_ = partly.RecordPayment(10)
	if err := partly.Void(); !errors.Is(err, ErrUseCreditNote) {
		t.Fatal("paid invoice needs a credit note")
	}
}

func TestDisplayStatusOverdue(t *testing.T) {
	inv := newInv(100)
	_ = inv.Issue()
	if inv.DisplayStatus(d("2026-11-01")) != "issued" || inv.DisplayStatus(d("2026-11-02")) != "overdue" {
		t.Fatal("overdue is derived from the due date")
	}
	_ = inv.RecordPayment(100)
	if inv.DisplayStatus(d("2027-01-01")) != "paid" {
		t.Fatal("paid invoices are never overdue")
	}
}

func cn(amount int64) CreditNote {
	return CreditNote{Currency: "INR", Amount: amount, OriginalNumber: "INV/2026-27/0001", OriginalDate: d("2026-10-01"), Reason: "returned goods"}
}

func TestCreditNotes(t *testing.T) {
	inv := newInv(10000)
	_ = inv.Issue()
	if ex, err := inv.ApplyCreditNote(cn(2500)); err != nil || ex != 0 || inv.Outstanding() != 7500 || inv.Status != PartiallyPaid {
		t.Fatalf("%d %v %d %s", ex, err, inv.Outstanding(), inv.Status)
	}
	if _, err := inv.ApplyCreditNote(cn(7501)); !errors.Is(err, ErrCreditTooLarge) {
		t.Fatal("total credits cannot exceed the invoice total")
	}
	if ex, err := inv.ApplyCreditNote(cn(7500)); err != nil || ex != 0 || inv.Status != Credited || inv.Outstanding() != 0 {
		t.Fatalf("fully credited: %d %v %s", ex, err, inv.Status)
	}
	if err := inv.RecordPayment(1); !errors.Is(err, ErrInvalidStatus) {
		t.Fatal("no payment on a credited invoice")
	}
}

func TestCreditAfterPaymentReturnsExcess(t *testing.T) {
	inv := newInv(10000)
	_ = inv.Issue()
	_ = inv.RecordPayment(10000)
	ex, err := inv.ApplyCreditNote(cn(3000))
	if err != nil || ex != 3000 || inv.Status != Paid {
		t.Fatalf("customer already paid, so 3000 must be refunded or held: %d %v %s", ex, err, inv.Status)
	}
	partly := newInv(10000)
	_ = partly.Issue()
	_ = partly.RecordPayment(8000)
	if ex, _ = partly.ApplyCreditNote(cn(5000)); ex != 3000 { // 2000 outstanding absorbed, 3000 excess
		t.Fatalf("excess %d", ex)
	}
}

func TestCreditNoteValidation(t *testing.T) {
	inv := newInv(1000)
	if _, err := inv.ApplyCreditNote(cn(100)); !errors.Is(err, ErrInvalidStatus) {
		t.Fatal("draft cannot be credited")
	}
	_ = inv.Issue()
	bad := cn(100)
	bad.Currency = "USD"
	if _, err := inv.ApplyCreditNote(bad); !errors.Is(err, ErrCurrencyMismatch) {
		t.Fatal("currency")
	}
	for name, mut := range map[string]func(*CreditNote){
		"no number": func(c *CreditNote) { c.OriginalNumber = "" }, "bad number": func(c *CreditNote) { c.OriginalNumber = "has space" },
		"no date": func(c *CreditNote) { c.OriginalDate = time.Time{} }, "no reason": func(c *CreditNote) { c.Reason = "" },
	} {
		c := cn(100)
		mut(&c)
		if _, err := inv.ApplyCreditNote(c); !errors.Is(err, ErrCreditReference) {
			t.Errorf("%s: %v", name, err)
		}
	}
	if _, err := inv.ApplyCreditNote(cn(0)); !errors.Is(err, ErrInvalidAmount) {
		t.Fatal("zero")
	}
}

func TestNumbering(t *testing.T) {
	s := Series{Prefix: "INV", Width: 4}
	got, err := s.Format("2026-27", 1)
	if err != nil || got != "INV/2026-27/0001" || len(got) != 16 {
		t.Fatalf("%q %v", got, err)
	}
	if _, err := (Series{Prefix: "INVOICE", Width: 4}).Format("2026-27", 1); !errors.Is(err, ErrInvalidNumber) {
		t.Fatal("must stay within 16 characters")
	}
	if _, err := s.Format("2026-27", 0); !errors.Is(err, ErrInvalidNumber) {
		t.Fatal("sequence starts at 1")
	}
	if _, err := (Series{Prefix: "IN V", Width: 2}).Format("2026-27", 1); !errors.Is(err, ErrInvalidNumber) {
		t.Fatal("spaces are not allowed")
	}
	if NextSequence(nil) != 1 || NextSequence([]int{1, 2, 7}) != 8 {
		t.Fatal("next sequence")
	}
	if !reflect.DeepEqual(FindGaps([]int{1, 2, 5, 7}), []int{3, 4, 6}) || len(FindGaps([]int{1, 2, 3})) != 0 || len(FindGaps(nil)) != 0 {
		t.Fatal("gaps")
	}
}

func dates(ts []time.Time) string {
	var s []string
	for _, t := range ts {
		s = append(s, t.Format("2006-01-02"))
	}
	return strings.Join(s, " ")
}

func TestRecurringMonthEndDoesNotDrift(t *testing.T) {
	s := Schedule{Frequency: Monthly, Interval: 1, Start: d("2026-01-31")}
	got, err := s.Next(d("2026-01-01"), 5)
	if err != nil || dates(got) != "2026-01-31 2026-02-28 2026-03-31 2026-04-30 2026-05-31" {
		t.Fatalf("%s %v", dates(got), err)
	}
	if got, _ = s.Next(d("2026-01-31"), 2); dates(got) != "2026-02-28 2026-03-31" {
		t.Fatalf("strictly after: %s", dates(got))
	}
}

func TestRecurringFrequencies(t *testing.T) {
	cases := []struct {
		s    Schedule
		want string
	}{
		{Schedule{Frequency: Yearly, Interval: 1, Start: d("2028-02-29")}, "2028-02-29 2029-02-28 2030-02-28 2031-02-28 2032-02-29"},
		{Schedule{Frequency: Quarterly, Interval: 1, Start: d("2026-11-30")}, "2026-11-30 2027-02-28 2027-05-30 2027-08-30 2027-11-30"},
		{Schedule{Frequency: Weekly, Interval: 2, Start: d("2026-10-11")}, "2026-10-11 2026-10-25 2026-11-08 2026-11-22 2026-12-06"},
		{Schedule{Frequency: Daily, Interval: 3, Start: d("2026-12-30")}, "2026-12-30 2027-01-02 2027-01-05 2027-01-08 2027-01-11"},
		{Schedule{Frequency: Monthly, Interval: 2, Start: d("2026-10-15")}, "2026-10-15 2026-12-15 2027-02-15 2027-04-15 2027-06-15"},
	}
	for _, c := range cases {
		got, err := c.s.Next(d("2020-01-01"), 5)
		if err != nil || dates(got) != c.want {
			t.Errorf("%s: got %s want %s (%v)", c.s.Frequency, dates(got), c.want, err)
		}
	}
}

func TestRecurringLimitsAndValidation(t *testing.T) {
	s := Schedule{Frequency: Monthly, Interval: 1, Start: d("2026-01-15"), MaxRuns: 3}
	if got, _ := s.Next(d("2020-01-01"), 10); len(got) != 3 {
		t.Fatalf("max runs: %s", dates(got))
	}
	s = Schedule{Frequency: Monthly, Interval: 1, Start: d("2026-01-15"), End: d("2026-03-15")}
	if got, _ := s.Next(d("2020-01-01"), 10); dates(got) != "2026-01-15 2026-02-15 2026-03-15" {
		t.Fatalf("end inclusive: %s", dates(got))
	}
	if got, _ := s.Next(d("2026-03-15"), 10); len(got) != 0 {
		t.Fatal("nothing after the end")
	}
	for _, bad := range []Schedule{{Frequency: "hourly", Interval: 1, Start: d("2026-01-01")}, {Frequency: Daily, Interval: 0, Start: d("2026-01-01")},
		{Frequency: Daily, Interval: 1}, {Frequency: Daily, Interval: 1, Start: d("2026-02-01"), End: d("2026-01-01")}, {Frequency: Daily, Interval: 1, Start: d("2026-01-01"), MaxRuns: -1}} {
		if _, err := bad.Next(d("2026-01-01"), 1); !errors.Is(err, ErrInvalidSchedule) {
			t.Errorf("%+v should be invalid", bad)
		}
	}
}

func TestDunning(t *testing.T) {
	p := Policy{Steps: []Step{{-3, "before"}, {0, "due"}, {7, "week"}, {14, "fortnight"}}}
	due := d("2026-10-20")
	if pl := p.DueNow(Issued, due, d("2026-10-10"), nil); pl.Send != nil {
		t.Fatal("too early")
	}
	pl := p.DueNow(Issued, due, d("2026-10-17"), nil)
	if pl.Send == nil || pl.Send.Template != "before" || len(pl.Skipped) != 0 {
		t.Fatalf("%+v", pl)
	}
	pl = p.DueNow(Issued, due, d("2026-10-28"), []int{-3, 0}) // 8 days late, day-7 step now due
	if pl.Send == nil || pl.Send.Template != "week" {
		t.Fatalf("%+v", pl)
	}
	// Service was down: only the newest eligible step is sent; older ones are reported skipped.
	pl = p.DueNow(Issued, due, d("2026-11-10"), []int{-3})
	if pl.Send == nil || pl.Send.Template != "fortnight" || len(pl.Skipped) != 2 {
		t.Fatalf("%+v", pl)
	}
	if pl = p.DueNow(Issued, due, d("2026-11-10"), []int{-3, 0, 7, 14}); pl.Send != nil {
		t.Fatal("everything already sent")
	}
	for _, st := range []Status{Draft, Paid, Void, Credited} {
		if pl = p.DueNow(st, due, d("2026-11-10"), nil); pl.Send != nil {
			t.Fatalf("%s must not be chased", st)
		}
	}
	if pl = p.DueNow(PartiallyPaid, due, d("2026-10-20"), nil); pl.Send == nil {
		t.Fatal("partially paid invoices are chased")
	}
}

func TestQuoteLifecycle(t *testing.T) {
	q := &Quote{Status: QuoteDraft, ValidUntil: d("2026-10-31"), Version: 1}
	if err := q.Accept(d("2026-10-11")); !errors.Is(err, ErrQuoteTransition) {
		t.Fatal("cannot accept a draft")
	}
	_ = q.Send()
	if q.EffectiveStatus(d("2026-10-31")) != QuoteSent || q.EffectiveStatus(d("2026-11-01")) != QuoteExpired {
		t.Fatal("validity is inclusive of the last day")
	}
	if err := q.Accept(d("2026-11-01")); !errors.Is(err, ErrQuoteTransition) {
		t.Fatal("cannot accept an expired quote")
	}
	if err := q.Accept(d("2026-10-31")); err != nil {
		t.Fatal(err)
	}
	if err := q.Revise(); !errors.Is(err, ErrQuoteTransition) {
		t.Fatal("accepted quotes are commitments")
	}
	if err := q.Convert(""); !errors.Is(err, ErrQuoteTransition) {
		t.Fatal("needs an invoice id")
	}
	if err := q.Convert("inv-1"); err != nil || q.Status != QuoteConverted || q.ConvertedInvoiceID != "inv-1" {
		t.Fatal("convert")
	}
	if err := q.Convert("inv-2"); !errors.Is(err, ErrQuoteTransition) {
		t.Fatal("convert once")
	}
}

func TestQuoteRevise(t *testing.T) {
	q := &Quote{Status: QuoteDraft, Version: 1}
	_ = q.Send()
	_ = q.Decline(d("2026-10-11"))
	if q.Status != QuoteDeclined {
		t.Fatal("declined")
	}
	if err := q.Revise(); err != nil || q.Version != 2 || q.Status != QuoteDraft {
		t.Fatalf("%v %+v", err, q)
	}
}

func TestStatement(t *testing.T) {
	entries := []Entry{
		{d("2026-10-05"), "Payment", "INR", 0, 3000},
		{d("2026-09-01"), "Invoice 1", "INR", 5000, 0},
		{d("2026-10-01"), "Invoice 2", "INR", 2000, 0},
		{d("2026-11-15"), "Invoice 3", "INR", 9999, 0},
	}
	lines, closing, err := Statement("INR", 100, entries, d("2026-10-01"), d("2026-10-31"))
	if err != nil || closing != 4100 || len(lines) != 2 {
		t.Fatalf("%v %d %v", err, closing, lines)
	}
	// Opening 100 + September invoice 5000 = 5100; then +2000 = 7100; then -3000 = 4100.
	if lines[0].Description != "Invoice 2" || lines[0].Balance != 7100 || lines[1].Balance != 4100 {
		t.Fatalf("%+v", lines)
	}
	if _, _, err = Statement("INR", 0, []Entry{{d("2026-10-01"), "x", "USD", 1, 0}}, d("2026-01-01"), d("2026-12-31")); !errors.Is(err, ErrCurrencyMismatch) {
		t.Fatal("statements are per currency")
	}
}

func TestFXConversion(t *testing.T) {
	at := d("2026-10-11")
	c, err := Convert("INR", "USD", 100000, 2, 2, money.MustDecimal("0.012"), "RBI reference rate", at)
	if err != nil || c.Converted != 1200 || c.Rounding != "half_up" || c.RateSource == "" {
		t.Fatalf("%+v %v", c, err)
	}
	// JPY has no minor unit: 1000.00 INR x 1.78 = 1780 JPY.
	if c, err = Convert("INR", "JPY", 100000, 2, 0, money.MustDecimal("1.78"), "test", at); err != nil || c.Converted != 1780 {
		t.Fatalf("%+v %v", c, err)
	}
	// Half-up at the last digit: 0.01 INR x 0.5 = 0.005 -> 0.01 target units? (1 paisa -> 0.5 cent -> 1 cent)
	if c, _ = Convert("INR", "USD", 1, 2, 2, money.MustDecimal("0.5"), "test", at); c.Converted != 1 {
		t.Fatalf("half up: %d", c.Converted)
	}
	bad := []struct {
		src, dst string
		rate     *money.Rat
		source   string
		eff      time.Time
		want     error
	}{
		{"INR", "INR", money.MustDecimal("1"), "x", at, ErrInvalidRate},
		{"INR", "USD", nil, "x", at, ErrInvalidRate},
		{"INR", "USD", money.MustDecimal("0"), "x", at, ErrInvalidRate},
		{"INR", "USD", money.MustDecimal("-1"), "x", at, ErrInvalidRate},
		{"INR", "USD", money.MustDecimal("1"), "", at, ErrRateMetadata},
		{"INR", "USD", money.MustDecimal("1"), "x", time.Time{}, ErrRateMetadata},
	}
	for i, b := range bad {
		if _, err := Convert(b.src, b.dst, 100, 2, 2, b.rate, b.source, b.eff); !errors.Is(err, b.want) {
			t.Errorf("case %d: got %v want %v", i, err, b.want)
		}
	}
}
