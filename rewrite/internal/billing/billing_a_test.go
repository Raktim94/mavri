package billing

import (
	"errors"
	"testing"
	"time"

	"github.com/Raktim94/nodedr-invoice/rewrite/internal/money"
)

func d(s string) time.Time { t, _ := time.Parse("2006-01-02", s); return t }

func TestDueDates(t *testing.T) {
	cases := []struct {
		terms Terms
		issue string
		want  string
	}{
		{Terms{Kind: DueOnReceipt}, "2026-10-11", "2026-10-11"},
		{Terms{Kind: NetDays, Days: 30}, "2026-10-11", "2026-11-10"},
		{Terms{Kind: NetDays, Days: 30}, "2026-12-15", "2027-01-14"},
		{Terms{Kind: NetDays, Days: 0}, "2026-10-11", "2026-10-11"},
		{Terms{Kind: EndOfMonthPlus, Days: 0}, "2026-10-11", "2026-10-31"},
		{Terms{Kind: EndOfMonthPlus, Days: 15}, "2026-02-10", "2026-03-15"},
		{Terms{Kind: EndOfMonthPlus, Days: 0}, "2028-02-10", "2028-02-29"}, // leap year
		{Terms{Kind: FixedDate, Date: d("2026-12-31")}, "2026-10-11", "2026-12-31"},
	}
	for _, c := range cases {
		got, err := c.terms.DueDate(d(c.issue))
		if err != nil || got.Format("2006-01-02") != c.want {
			t.Errorf("%+v issue %s: got %v %v want %s", c.terms, c.issue, got, err, c.want)
		}
	}
	for _, bad := range []Terms{{Kind: "weird"}, {Kind: NetDays, Days: -1}, {Kind: NetDays, Days: 99999},
		{Kind: FixedDate}, {Kind: FixedDate, Date: d("2020-01-01")}} {
		if _, err := bad.DueDate(d("2026-10-11")); !errors.Is(err, ErrInvalidTerms) {
			t.Errorf("%+v should be invalid", bad)
		}
	}
}

func TestDueDateIgnoresTimeOfDayAndZone(t *testing.T) {
	ist := time.FixedZone("IST", 5*3600+1800)
	late := time.Date(2026, 10, 11, 23, 59, 0, 0, ist)
	got, _ := Terms{Kind: NetDays, Days: 1}.DueDate(late)
	if got.Format("2006-01-02") != "2026-10-12" {
		t.Fatalf("got %v", got)
	}
}

func TestEarlyDiscount(t *testing.T) {
	e := EarlyDiscount{Percent: money.MustDecimal("2"), WithinDays: 10}
	if got := e.For(d("2026-10-01"), d("2026-10-11"), 100000); got != 2000 {
		t.Fatalf("on day 10: %d", got)
	}
	if got := e.For(d("2026-10-01"), d("2026-10-12"), 100000); got != 0 {
		t.Fatalf("day 11: %d", got)
	}
	if got := e.For(d("2026-10-01"), d("2026-10-02"), 12345); got != 247 { // 246.9 rounds up
		t.Fatalf("rounding: %d", got)
	}
	if (EarlyDiscount{}).For(d("2026-10-01"), d("2026-10-02"), 100) != 0 {
		t.Fatal("empty discount")
	}
}

func TestDaysOverdueAndBuckets(t *testing.T) {
	due := d("2026-10-01")
	cases := map[string]int{"2026-09-30": 0, "2026-10-01": 0, "2026-10-02": 1, "2026-10-31": 30, "2026-11-01": 31, "2027-01-01": 92}
	for asOf, want := range cases {
		if got := DaysOverdue(due, d(asOf)); got != want {
			t.Errorf("%s: got %d want %d", asOf, got, want)
		}
	}
	for days, want := range map[int]Bucket{-5: NotDue, 0: NotDue, 1: Days1to30, 30: Days1to30, 31: Days31to60, 60: Days31to60, 61: Days61to90, 90: Days61to90, 91: Over90} {
		if got := BucketFor(days); got != want {
			t.Errorf("%d: got %s want %s", days, got, want)
		}
	}
}

func TestAgingKeepsCurrenciesSeparate(t *testing.T) {
	asOf := d("2026-10-11")
	rep := Aging([]OpenItem{
		{"INR", 1000, d("2026-10-20")}, {"INR", 2000, d("2026-10-01")}, {"INR", 500, d("2026-05-01")},
		{"USD", 700, d("2026-10-01")}, {"INR", 0, d("2026-01-01")}, {"INR", -50, d("2026-01-01")},
	}, asOf)
	if rep["INR"][NotDue] != 1000 || rep["INR"][Days1to30] != 2000 || rep["INR"][Over90] != 500 || rep["USD"][Days1to30] != 700 {
		t.Fatalf("%v", rep)
	}
	if len(rep) != 2 {
		t.Fatal("zero and negative balances must be ignored")
	}
}

func TestLateFee(t *testing.T) {
	due := d("2026-10-01")
	p := LateFeePolicy{GraceDays: 5, FixedFee: 5000, AnnualPercent: money.MustDecimal("18")}
	if p.Compute(1000000, due, d("2026-10-06")) != 0 {
		t.Fatal("inside grace")
	}
	// 10 days overdue, 5 after grace: 5000 + 1,000,000*18%*5/365 = 5000 + 2465.75 -> 2466
	if got := p.Compute(1000000, due, d("2026-10-11")); got != 7466 {
		t.Fatalf("got %d", got)
	}
	capped := p
	capped.Cap = 6000
	if got := capped.Compute(1000000, due, d("2026-10-11")); got != 6000 {
		t.Fatalf("cap: %d", got)
	}
	if (LateFeePolicy{}).Compute(1000, due, d("2027-01-01")) != 0 {
		t.Fatal("empty policy charges nothing")
	}
	if p.Compute(0, due, d("2027-01-01")) != 0 {
		t.Fatal("nothing outstanding")
	}
}

func TestAllocateOldestFirst(t *testing.T) {
	invs := []OpenInvoice{
		{"c", "INR", d("2026-10-20"), 3000}, {"a", "INR", d("2026-09-01"), 1000}, {"b", "INR", d("2026-09-01"), 2000},
	}
	allocs, left, err := Allocate("INR", 3500, invs, OldestDueFirst)
	want := []Allocation{{"a", 1000}, {"b", 2000}, {"c", 500}}
	if err != nil || left != 0 || len(allocs) != 3 {
		t.Fatalf("%v %d %v", allocs, left, err)
	}
	for i := range want {
		if allocs[i] != want[i] {
			t.Fatalf("got %v want %v", allocs, want)
		}
	}
	if invs[0].ID != "c" {
		t.Fatal("input slice must not be reordered")
	}
}

func TestAllocateOverpaymentAndOrder(t *testing.T) {
	invs := []OpenInvoice{{"x", "INR", d("2026-12-01"), 1000}, {"y", "INR", d("2026-01-01"), 1000}}
	allocs, left, _ := Allocate("INR", 5000, invs, InGivenOrder)
	if left != 3000 || allocs[0].InvoiceID != "x" || allocs[1].InvoiceID != "y" {
		t.Fatalf("%v %d", allocs, left)
	}
	var sum int64
	for _, a := range allocs {
		sum += a.Amount
	}
	if sum+left != 5000 {
		t.Fatal("money must be conserved")
	}
}

func TestAllocateRejects(t *testing.T) {
	if _, _, err := Allocate("INR", 0, nil, OldestDueFirst); !errors.Is(err, ErrInvalidAmount) {
		t.Fatal(err)
	}
	if _, _, err := Allocate("INR", 100, []OpenInvoice{{"u", "USD", d("2026-01-01"), 50}}, OldestDueFirst); !errors.Is(err, ErrCurrencyMismatch) {
		t.Fatal(err)
	}
	allocs, left, err := Allocate("INR", 100, []OpenInvoice{{"p", "INR", d("2026-01-01"), 0}}, OldestDueFirst)
	if err != nil || len(allocs) != 0 || left != 100 {
		t.Fatalf("paid invoices get nothing: %v %d %v", allocs, left, err)
	}
}
