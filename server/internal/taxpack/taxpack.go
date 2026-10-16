// Package taxpack holds Mavri's tax guidance by country: rates with the dates
// they apply, how to read a tax registration number, and a plain-language
// explanation of which treatment usually applies to a sale.
//
// It guides; it does not decide. Mavri never applies a rate on its own, every
// rate in a pack is something a person chooses, and anything that depends on
// facts Mavri does not have is reported as a missing fact or an open decision.
// Rates and rules are data below, each with a source and an effective date, and
// a pack is only called reviewed once a person has checked it against that source.
package taxpack

import "sort"

// Status of a pack.
const (
	Beta     = "beta"     // rates, number checks and explanations; not filing, not certified
	Estimate = "estimate" // no rates: the rate depends on the place and the product, so the person supplies it
	Planned  = "planned"  // not built
)

// Rate is one rate that applies between two dates (To empty: still current).
type Rate struct {
	Code    string  `json:"code"`
	Label   string  `json:"label"`
	Percent float64 `json:"percent"`
	// Use says in plain words when this rate is the usual choice.
	Use  string `json:"use"`
	From string `json:"from"`
	To   string `json:"to,omitempty"`
}

// Pack is the guidance for one tax system.
type Pack struct {
	ID       string `json:"id"`
	Name     string `json:"name"`
	Country  string `json:"country"` // ISO 3166 code, or "EU"
	Status   string `json:"status"`
	Currency string `json:"currency"`
	TaxName  string `json:"taxName"`
	IDName   string `json:"idName"` // what the registration number is called
	// Source is the official page the rates and rules were taken from.
	Source string `json:"source"`
	// ReviewedOn is the date a person last checked the pack against Source. Empty means nobody has.
	ReviewedOn string `json:"reviewedOn"`
	// Version changes whenever rates or rules change; it is stored in the explanation so an old result can be told apart.
	Version string `json:"version"`
	Owner   string `json:"owner"`
	// Covers lists what the pack does, and Excludes what it deliberately does not.
	Covers   []string `json:"covers"`
	Excludes []string `json:"excludes"`
	Rates    []Rate   `json:"rates"`
}

// RatesOn returns the rates in force on a day (YYYY-MM-DD; empty means today's pack as listed).
func (p Pack) RatesOn(day string) []Rate {
	out := []Rate{}
	for _, r := range p.Rates {
		if day == "" {
			if r.To == "" {
				out = append(out, r)
			}
			continue
		}
		if r.From <= day && (r.To == "" || day <= r.To) {
			out = append(out, r)
		}
	}
	return out
}

// Packs lists every pack, built ones first.
func Packs() []Pack {
	out := []Pack{indiaGST, ukVAT, euVAT, uaeVAT, usSalesTax}
	sort.SliceStable(out, func(i, j int) bool { return out[i].Status != Planned && out[j].Status == Planned })
	return out
}

// ByID finds a pack.
func ByID(id string) (Pack, bool) {
	for _, p := range Packs() {
		if p.ID == id {
			return p, true
		}
	}
	return Pack{}, false
}

// ForCountry picks the pack for the country the seller is established in.
func ForCountry(country string) (Pack, bool) {
	switch {
	case country == "IN":
		return indiaGST, true
	case country == "GB":
		return ukVAT, true
	case country == "AE":
		return uaeVAT, true
	case country == "US":
		return usSalesTax, true
	case IsEU(country):
		return euVAT, true
	}
	return Pack{}, false
}
