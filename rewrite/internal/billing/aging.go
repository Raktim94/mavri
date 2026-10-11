package billing

import "time"

// Bucket is an aging band.
type Bucket string

const (
	NotDue     Bucket = "not_due"
	Days1to30  Bucket = "1_30"
	Days31to60 Bucket = "31_60"
	Days61to90 Bucket = "61_90"
	Over90     Bucket = "over_90"
)

// Buckets lists the bands in report order.
var Buckets = []Bucket{NotDue, Days1to30, Days31to60, Days61to90, Over90}

// DaysOverdue is the number of whole calendar days asOf is past due; zero on
// or before the due date.
func DaysOverdue(due, asOf time.Time) int {
	d, a := Day(due), Day(asOf)
	if !a.After(d) {
		return 0
	}
	return int(a.Sub(d).Hours() / 24)
}

// BucketFor maps days overdue to a band.
func BucketFor(days int) Bucket {
	switch {
	case days <= 0:
		return NotDue
	case days <= 30:
		return Days1to30
	case days <= 60:
		return Days31to60
	case days <= 90:
		return Days61to90
	}
	return Over90
}

// OpenItem is an unpaid balance.
type OpenItem struct {
	Currency    string
	Outstanding int64
	Due         time.Time
}

// Aging totals open balances per currency and band. Currencies are never mixed.
func Aging(items []OpenItem, asOf time.Time) map[string]map[Bucket]int64 {
	out := map[string]map[Bucket]int64{}
	for _, it := range items {
		if it.Outstanding <= 0 {
			continue
		}
		if out[it.Currency] == nil {
			out[it.Currency] = map[Bucket]int64{}
		}
		out[it.Currency][BucketFor(DaysOverdue(it.Due, asOf))] += it.Outstanding
	}
	return out
}
