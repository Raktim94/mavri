package taxpack

import (
	"fmt"
	"strings"
)

// Facts are what Mavri knows about a sale. Anything left empty is reported as missing, never guessed.
type Facts struct {
	IssuerCountry     string `json:"issuerCountry"`
	IssuerTaxID       string `json:"issuerTaxId"`
	CustomerCountry   string `json:"customerCountry"`
	CustomerTaxID     string `json:"customerTaxId"`
	CustomerTaxExempt bool   `json:"customerTaxExempt"`
	Date              string `json:"date"` // supply or invoice date, YYYY-MM-DD
}

// Treatments.
const (
	Domestic    = "domestic"
	IntraState  = "intra_state"
	InterState  = "inter_state"
	ReverseChrg = "reverse_charge"
	Export      = "export"
	Undecided   = "undecided"
	NoGuidance  = "no_guidance"
)

// Confidence in a result.
const (
	Clear         = "clear"
	NeedsDecision = "needs_decision"
	NoPack        = "no_pack"
)

// SplitPart is one component of a tax that is shown in parts, as a share of the whole rate.
type SplitPart struct {
	Name  string  `json:"name"`
	Share float64 `json:"share"`
}

// PackInfo says which rules produced a result.
type PackInfo struct {
	ID         string `json:"id"`
	Name       string `json:"name"`
	Status     string `json:"status"`
	Version    string `json:"version"`
	Source     string `json:"source"`
	ReviewedOn string `json:"reviewedOn"`
}

// Result is the explanation: what usually applies, why, what is missing and what a person must decide.
type Result struct {
	Pack       *PackInfo   `json:"pack,omitempty"`
	Treatment  string      `json:"treatment"`
	Title      string      `json:"title"`
	Confidence string      `json:"confidence"`
	Trace      []string    `json:"trace"`
	Missing    []string    `json:"missing"`
	Decisions  []string    `json:"decisions"`
	Warnings   []string    `json:"warnings"`
	Suggested  []Rate      `json:"suggested"`
	Split      []SplitPart `json:"split,omitempty"`
	IDs        []IDCheck   `json:"ids"`
}

func (r *Result) tracef(f string, a ...any) { r.Trace = append(r.Trace, fmt.Sprintf(f, a...)) }

// Explain reads the facts of a sale against the seller's country pack.
func Explain(f Facts) Result {
	f.IssuerCountry = strings.ToUpper(strings.TrimSpace(f.IssuerCountry))
	f.CustomerCountry = strings.ToUpper(strings.TrimSpace(f.CustomerCountry))
	res := Result{Trace: []string{}, Missing: []string{}, Decisions: []string{}, Warnings: []string{}, Suggested: []Rate{}, IDs: []IDCheck{}}
	if f.IssuerCountry == "" {
		res.Treatment, res.Confidence, res.Title = NoGuidance, NoPack, "Set your business's country to get tax guidance"
		res.Missing = append(res.Missing, "The country of your business (Businesses, then Country)")
		return res
	}
	pack, ok := ForCountry(f.IssuerCountry)
	if !ok {
		res.Treatment, res.Confidence, res.Title = NoGuidance, NoPack, "Mavri has no tax guidance for "+f.IssuerCountry
		res.tracef("Tax packs exist for India, the United Kingdom, the EU, the UAE and the United States. Enter the rates your tax authority requires on each line.")
		return res
	}
	res.Pack = &PackInfo{pack.ID, pack.Name, pack.Status, pack.Version, pack.Source, pack.ReviewedOn}
	res.Suggested = pack.RatesOn(f.Date)
	res.tracef("Rules used: %s (version %s, %s).", pack.Name, pack.Version, reviewText(pack))

	issuer := CheckID(f.IssuerCountry, f.IssuerTaxID)
	if strings.TrimSpace(f.IssuerTaxID) != "" {
		res.IDs = append(res.IDs, issuer)
	}
	if strings.TrimSpace(f.CustomerTaxID) != "" {
		cc := f.CustomerCountry
		if cc == "" {
			cc = f.IssuerCountry
		}
		res.IDs = append(res.IDs, CheckID(cc, f.CustomerTaxID))
	}
	if f.CustomerTaxExempt {
		res.Warnings = append(res.Warnings, "The customer is marked tax-exempt. Keep the exemption evidence the rules ask for, and do not charge tax unless you are sure.")
	}
	switch pack.ID {
	case "in-gst":
		explainIndia(&res, f, issuer)
	case "uk-vat":
		explainUK(&res, f, issuer)
	case "eu-vat":
		explainEU(&res, f, issuer)
	case "ae-vat":
		explainUAE(&res, f, issuer)
	case "us-sales-tax":
		explainUS(&res, f)
	}
	for _, id := range res.IDs {
		if !id.Valid && id.Level != "none" {
			res.Warnings = append(res.Warnings, fmt.Sprintf("A %s number looks wrong: %s", id.Kind, id.Message))
		}
	}
	return res
}

func reviewText(p Pack) string {
	if p.ReviewedOn == "" {
		return "not independently reviewed: check the rates against " + p.Source
	}
	return "last reviewed " + p.ReviewedOn
}

func foreign(f Facts) bool { return f.CustomerCountry != "" && f.CustomerCountry != f.IssuerCountry }

func needIssuerID(res *Result, f Facts, name string) {
	if strings.TrimSpace(f.IssuerTaxID) == "" {
		res.Missing = append(res.Missing, "Your "+name+" (Businesses, then Tax ID)")
	}
}

func explainIndia(res *Result, f Facts, issuer IDCheck) {
	needIssuerID(res, f, "GSTIN")
	if f.CustomerCountry != "" && f.CustomerCountry != "IN" {
		res.Treatment, res.Confidence, res.Title = Export, NeedsDecision, "Sale to a customer outside India"
		res.tracef("The customer is in %s, so this is usually an export.", f.CustomerCountry)
		res.Decisions = append(res.Decisions, "Exports are commonly zero-rated under a Letter of Undertaking or bond, or taxed with IGST and refunded. Choose the route you use and set the rate to match.")
		return
	}
	cust := CheckID("IN", f.CustomerTaxID)
	switch {
	case issuer.Valid && cust.Valid:
		res.tracef("Your GSTIN is for %s.", issuer.State)
		res.tracef("The customer's GSTIN is for %s, which is the place of supply for a registered buyer.", cust.State)
		if f.IssuerTaxID != "" && issuerPrefix(f.IssuerTaxID) == issuerPrefix(f.CustomerTaxID) {
			res.Treatment, res.Confidence, res.Title = IntraState, Clear, "Same state: CGST and SGST"
			res.tracef("Both are in the same state, so the tax is split equally into CGST and SGST.")
			res.Split = []SplitPart{{"CGST", 0.5}, {"SGST", 0.5}}
		} else {
			res.Treatment, res.Confidence, res.Title = InterState, Clear, "Different states: IGST"
			res.tracef("The states differ, so the whole tax is charged as IGST.")
			res.Split = []SplitPart{{"IGST", 1}}
		}
	case issuer.Valid:
		res.Treatment, res.Confidence, res.Title = Undecided, NeedsDecision, "Place of supply needed"
		res.tracef("Your GSTIN is for %s.", issuer.State)
		if strings.TrimSpace(f.CustomerTaxID) == "" {
			res.Missing = append(res.Missing, "The customer's GSTIN, or their state if they are not registered (Customers, then Tax ID)")
		} else {
			res.Missing = append(res.Missing, "A valid customer GSTIN")
		}
		res.Decisions = append(res.Decisions, fmt.Sprintf("If the place of supply is %s, charge CGST and SGST. If it is another state, charge IGST.", issuer.State))
	default:
		res.Treatment, res.Confidence, res.Title = Undecided, NeedsDecision, "Your GSTIN is needed"
		res.Missing = append(res.Missing, "A valid GSTIN for your business, so Mavri knows your state")
	}
	res.Decisions = append(res.Decisions, "Confirm the rate for each item, and its HSN or SAC code, with your tax adviser or the GST portal.")
}

func issuerPrefix(g string) string {
	g = clean(g)
	if len(g) < 2 {
		return ""
	}
	return g[:2]
}

func explainUK(res *Result, f Facts, issuer IDCheck) {
	if strings.TrimSpace(f.IssuerTaxID) == "" {
		res.Missing = append(res.Missing, "Your VAT number, if you are VAT-registered (Businesses, then Tax ID)")
		res.Decisions = append(res.Decisions, "If you are not VAT-registered, do not charge VAT and leave the rates at 0.")
	}
	if foreign(f) {
		res.Treatment, res.Confidence, res.Title = Export, NeedsDecision, "Sale to a customer outside the UK"
		res.tracef("The customer is in %s.", f.CustomerCountry)
		res.Decisions = append(res.Decisions, "Goods sent abroad are usually zero-rated if you hold proof of export. Services to a business abroad are often outside the scope of UK VAT. The place-of-supply rules decide; check them for what you sell.")
		return
	}
	res.Treatment, res.Confidence, res.Title = Domestic, Clear, "UK sale: VAT at the rate for the item"
	res.tracef("The customer is in the UK, so UK VAT applies at the rate for what you sell.")
	res.Decisions = append(res.Decisions, "Use 20% unless the item is reduced-rated (5%) or zero-rated (0%). Exempt supplies are not on this list; leave VAT off them.")
	_ = issuer
}

func explainEU(res *Result, f Facts, issuer IDCheck) {
	needIssuerID(res, f, "VAT ID")
	own := EUStandardRates[f.IssuerCountry]
	switch {
	case f.CustomerCountry == "" || f.CustomerCountry == f.IssuerCountry:
		res.Treatment, res.Confidence, res.Title = Domestic, Clear, own.Name+" sale: "+trimPct(own.Percent)+" standard rate"
		res.tracef("The customer is in %s as well, so %s VAT applies. The standard rate there is %s since %s.", own.Name, own.Name, trimPct(own.Percent), own.From)
		res.Decisions = append(res.Decisions, "Some goods and services have reduced rates in "+own.Name+". Use the standard rate only where it applies.")
	case IsEU(f.CustomerCountry):
		dest := EUStandardRates[f.CustomerCountry]
		cust := CheckID(f.CustomerCountry, f.CustomerTaxID)
		if strings.TrimSpace(f.CustomerTaxID) != "" && cust.Valid {
			res.Treatment, res.Confidence, res.Title = ReverseChrg, Clear, "EU business customer: reverse charge, 0%"
			res.tracef("The customer is a business in %s with a VAT ID of the right shape.", dest.Name)
			res.Trace = append(res.Trace, "A sale of goods to a VAT-registered business in another member state is usually exempt (intra-Community supply), and services are usually reverse-charged: you charge 0% and the customer accounts for the VAT.")
			res.Decisions = append(res.Decisions, "Confirm the customer's VAT ID is active in the EU VIES service, put both VAT IDs on the invoice, and add the wording your country requires, such as “Reverse charge”.")
			res.Suggested = zeroOnly(res.Suggested)
		} else {
			res.Treatment, res.Confidence, res.Title = Undecided, NeedsDecision, "EU customer: business or consumer?"
			if strings.TrimSpace(f.CustomerTaxID) == "" {
				res.Missing = append(res.Missing, "The customer's VAT ID, if they are a business (Customers, then Tax ID)")
			} else {
				res.Missing = append(res.Missing, "A valid customer VAT ID")
			}
			res.Decisions = append(res.Decisions,
				"If the customer is a VAT-registered business, charge 0% and use the reverse charge.",
				fmt.Sprintf("If the customer is a consumer, you usually charge %s VAT (%s) until your yearly sales to other EU consumers pass EUR 10,000; after that you charge the customer's country rate (%s in %s) and report through the One Stop Shop.", own.Name, trimPct(own.Percent), trimPct(dest.Percent), dest.Name))
		}
	default:
		res.Treatment, res.Confidence, res.Title = Export, NeedsDecision, "Sale to a customer outside the EU"
		res.tracef("The customer is in %s, outside the EU.", f.CustomerCountry)
		res.Decisions = append(res.Decisions, "Exports of goods are usually exempt with proof of export; services depend on the place-of-supply rules. Check which applies, and set the rate to match.")
	}
	_ = issuer
}

func zeroOnly(in []Rate) []Rate {
	return []Rate{{Code: "vat-0", Label: "0%", Percent: 0, Use: "Reverse charge or intra-Community supply", From: "1993-01-01"}}
}

func explainUAE(res *Result, f Facts, issuer IDCheck) {
	needIssuerID(res, f, "TRN")
	if foreign(f) {
		res.Treatment, res.Confidence, res.Title = Export, NeedsDecision, "Sale to a customer outside the UAE"
		res.tracef("The customer is in %s.", f.CustomerCountry)
		res.Decisions = append(res.Decisions, "Exports of goods and many international services are zero-rated with evidence; other services follow place-of-supply rules. Check which applies, and set the rate to match.")
		return
	}
	res.Treatment, res.Confidence, res.Title = Domestic, Clear, "UAE sale: 5% VAT"
	res.Trace = append(res.Trace, "The customer is in the UAE, so VAT at 5% applies unless the supply is zero-rated or exempt.")
	res.Decisions = append(res.Decisions, "Use 0% only for supplies the FTA lists as zero-rated. Exempt supplies carry no VAT and are left at 0 without a rate.")
	_ = issuer
}

func explainUS(res *Result, f Facts) {
	res.Treatment, res.Confidence, res.Title = Undecided, NeedsDecision, "Sales tax depends on where the goods or service go"
	if foreign(f) {
		res.tracef("The customer is in %s. US sales tax generally does not apply to exports; confirm for your case.", f.CustomerCountry)
		return
	}
	res.tracef("Mavri holds no US sales tax rates: the rate depends on the state, county and city, on what is sold, and on whether you have nexus there.")
	res.Decisions = append(res.Decisions,
		"Look up the combined rate for the delivery address with the state's revenue department or a sales-tax service, and enter it on each taxable line.",
		"If the customer is exempt, keep their exemption or resale certificate on file.")
	if f.CustomerTaxExempt {
		res.Decisions = append(res.Decisions, "This customer is marked exempt: leave tax off and note the certificate number.")
	}
}
