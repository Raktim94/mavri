package gst

import (
	"errors"
	"sort"
	"time"

	"github.com/Raktim94/nodedr-invoice/rewrite/internal/money"
)

// Class is how a supply is treated for GST.
type Class string

const (
	Taxable  Class = "taxable"
	Exempt   Class = "exempt"
	NilRated Class = "nil_rated"
	NonGST   Class = "non_gst"
)

// Errors carry stable translation keys in their text.
var (
	ErrNoRule        = errors.New("error.gst.noRule")
	ErrAmbiguousRule = errors.New("error.gst.ambiguousRule")
)

// Rule says how supplies whose HSN/SAC code starts with CodePrefix are taxed
// between From (inclusive) and To (exclusive; zero means open-ended).
// Rate is the total GST percentage (CGST+SGST or IGST). CessRate is an
// optional ad valorem cess percentage. Source records the notification the
// values came from, for audit; the application never supplies defaults.
type Rule struct {
	ID         string
	CodePrefix string
	Class      Class
	Rate       *money.Rat
	CessRate   *money.Rat
	From, To   time.Time
	Source     string
}

// RuleBook is the set of rules a business has loaded.
type RuleBook struct{ Rules []Rule }

func day(t time.Time) string { return t.Format("2006-01-02") }

func (r Rule) effectiveOn(d time.Time) bool {
	if !r.From.IsZero() && day(d) < day(r.From) {
		return false
	}
	if !r.To.IsZero() && day(d) >= day(r.To) {
		return false
	}
	return true
}

// Resolve returns the most specific (longest code prefix) rule effective on
// the given date. Two equally specific rules effective on the same date are
// ambiguous and rejected rather than guessed between. No rule means ErrNoRule:
// the calculator never falls back to a default rate.
func (b RuleBook) Resolve(code string, on time.Time) (Rule, error) {
	var hits []Rule
	for _, r := range b.Rules {
		if r.CodePrefix != "" && len(code) >= len(r.CodePrefix) && code[:len(r.CodePrefix)] == r.CodePrefix && r.effectiveOn(on) {
			hits = append(hits, r)
		}
	}
	if len(hits) == 0 {
		return Rule{}, ErrNoRule
	}
	sort.SliceStable(hits, func(i, j int) bool { return len(hits[i].CodePrefix) > len(hits[j].CodePrefix) })
	if len(hits) > 1 && len(hits[0].CodePrefix) == len(hits[1].CodePrefix) {
		return Rule{}, ErrAmbiguousRule
	}
	return hits[0], nil
}
