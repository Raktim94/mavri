package billing

import (
	"errors"
	"fmt"
	"sort"

	"github.com/Raktim94/nodedr-invoice/rewrite/internal/gst"
)

// ErrInvalidNumber is returned when a formatted number breaks the Rule 46
// shape (at most 16 characters: letters, digits, hyphen, slash).
var ErrInvalidNumber = errors.New("error.billing.invalidInvoiceNumber")

// Series formats numbers like PREFIX/2026-27/0001. Uniqueness within a
// financial year is enforced by a database unique index on
// (series, financial year, sequence); this type only formats and checks.
type Series struct {
	Prefix string
	Width  int // zero-padding width of the sequence
}

// Format returns the invoice number for a financial year and sequence.
func (s Series) Format(financialYear string, seq int) (string, error) {
	if seq < 1 {
		return "", ErrInvalidNumber
	}
	n := fmt.Sprintf("%s/%s/%0*d", s.Prefix, financialYear, s.Width, seq)
	if !gst.ValidInvoiceNumber(n) {
		return "", ErrInvalidNumber
	}
	return n, nil
}

// NextSequence returns the next unused sequence number (highest + 1).
func NextSequence(used []int) int {
	max := 0
	for _, u := range used {
		if u > max {
			max = u
		}
	}
	return max + 1
}

// FindGaps lists missing numbers below the highest used one. Gaps in an
// issued series are an audit finding and should be explained, not silently
// refilled.
func FindGaps(used []int) []int {
	seen := map[int]bool{}
	max := 0
	for _, u := range used {
		seen[u] = true
		if u > max {
			max = u
		}
	}
	var gaps []int
	for n := 1; n < max; n++ {
		if !seen[n] {
			gaps = append(gaps, n)
		}
	}
	sort.Ints(gaps)
	return gaps
}
