package gst

import (
	"math/big"
	"sort"
)

// SummaryRow totals lines that share an HSN/SAC code, rate and class.
type SummaryRow struct {
	Code                            string
	Rate                            string // exact rate text such as "18" or "9/2"; "0" when none
	Class                           Class
	Lines                           int
	Taxable, CGST, SGST, IGST, Cess *big.Int
}

// HSNSummary groups the lines of many calculated documents by HSN/SAC code,
// rate and class, the shape used for HSN-wise and rate-wise summaries. Only
// documents in the same currency (INR) should be passed together.
func HSNSummary(results []Result) []SummaryRow {
	rows := map[string]*SummaryRow{}
	for _, r := range results {
		for _, l := range r.Lines {
			rate := "0"
			if l.Rate != nil {
				rate = l.Rate.RatString()
			}
			key := l.Code + "|" + rate + "|" + string(l.Class)
			row, ok := rows[key]
			if !ok {
				row = &SummaryRow{Code: l.Code, Rate: rate, Class: l.Class,
					Taxable: new(big.Int), CGST: new(big.Int), SGST: new(big.Int), IGST: new(big.Int), Cess: new(big.Int)}
				rows[key] = row
			}
			row.Lines++
			row.Taxable.Add(row.Taxable, l.Taxable)
			row.CGST.Add(row.CGST, l.CGST)
			row.SGST.Add(row.SGST, l.SGST)
			row.IGST.Add(row.IGST, l.IGST)
			row.Cess.Add(row.Cess, l.Cess)
		}
	}
	out := make([]SummaryRow, 0, len(rows))
	for _, r := range rows {
		out = append(out, *r)
	}
	sort.Slice(out, func(i, j int) bool {
		if out[i].Code != out[j].Code {
			return out[i].Code < out[j].Code
		}
		if out[i].Rate != out[j].Rate {
			return out[i].Rate < out[j].Rate
		}
		return out[i].Class < out[j].Class
	})
	return out
}
