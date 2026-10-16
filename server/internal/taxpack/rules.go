package taxpack

import (
	"sort"
	"strconv"
	"strings"
)

// IndiaStates maps the first two digits of a GSTIN to its state or union territory.
var IndiaStates = map[string]string{
	"01": "Jammu and Kashmir", "02": "Himachal Pradesh", "03": "Punjab", "04": "Chandigarh", "05": "Uttarakhand", "06": "Haryana",
	"07": "Delhi", "08": "Rajasthan", "09": "Uttar Pradesh", "10": "Bihar", "11": "Sikkim", "12": "Arunachal Pradesh", "13": "Nagaland",
	"14": "Manipur", "15": "Mizoram", "16": "Tripura", "17": "Meghalaya", "18": "Assam", "19": "West Bengal", "20": "Jharkhand",
	"21": "Odisha", "22": "Chhattisgarh", "23": "Madhya Pradesh", "24": "Gujarat", "26": "Dadra and Nagar Haveli and Daman and Diu",
	"27": "Maharashtra", "28": "Andhra Pradesh (old)", "29": "Karnataka", "30": "Goa", "31": "Lakshadweep", "32": "Kerala", "33": "Tamil Nadu",
	"34": "Puducherry", "35": "Andaman and Nicobar Islands", "36": "Telangana", "37": "Andhra Pradesh", "38": "Ladakh",
	"97": "Other Territory", "99": "Centre Jurisdiction",
}

// EUStandardRates holds each member state's standard VAT rate and the date it took effect.
var EUStandardRates = map[string]struct {
	Name    string
	Percent float64
	From    string
}{
	"AT": {"Austria", 20, "1984-01-01"}, "BE": {"Belgium", 21, "1996-01-01"}, "BG": {"Bulgaria", 20, "1999-01-01"},
	"HR": {"Croatia", 25, "2012-03-01"}, "CY": {"Cyprus", 19, "2014-01-13"}, "CZ": {"Czechia", 21, "2013-01-01"},
	"DK": {"Denmark", 25, "1992-01-01"}, "EE": {"Estonia", 24, "2025-07-01"}, "FI": {"Finland", 25.5, "2024-09-01"},
	"FR": {"France", 20, "2014-01-01"}, "DE": {"Germany", 19, "2007-01-01"}, "GR": {"Greece", 24, "2016-06-01"},
	"HU": {"Hungary", 27, "2012-01-01"}, "IE": {"Ireland", 23, "2012-01-01"}, "IT": {"Italy", 22, "2013-10-01"},
	"LV": {"Latvia", 21, "2012-07-01"}, "LT": {"Lithuania", 21, "2009-09-01"}, "LU": {"Luxembourg", 17, "2015-01-01"},
	"MT": {"Malta", 18, "2004-01-01"}, "NL": {"Netherlands", 21, "2012-10-01"}, "PL": {"Poland", 23, "2011-01-01"},
	"PT": {"Portugal", 23, "2011-01-01"}, "RO": {"Romania", 21, "2025-08-01"}, "SK": {"Slovakia", 23, "2025-01-01"},
	"SI": {"Slovenia", 22, "2013-07-01"}, "ES": {"Spain", 21, "2012-09-01"}, "SE": {"Sweden", 25, "1990-01-01"},
}

// IsEU reports whether a country code is an EU member state.
func IsEU(c string) bool { _, ok := EUStandardRates[strings.ToUpper(c)]; return ok }

// EUCountries lists the member-state codes.
func EUCountries() []string {
	out := make([]string, 0, len(EUStandardRates))
	for c := range EUStandardRates {
		out = append(out, c)
	}
	sort.Strings(out)
	return out
}

var indiaGST = Pack{
	ID: "in-gst", Name: "India GST", Country: "IN", Status: Beta, Currency: "INR", TaxName: "GST", IDName: "GSTIN",
	Source: "https://www.gst.gov.in/", Version: "2026.10-1", Owner: "NodeDR Infotech maintainers", ReviewedOn: "",
	Covers: []string{"GSTIN structure and check character", "Intra-state (CGST + SGST) or inter-state (IGST) from the two GSTINs", "Rates by effective date",
		"A tax summary by rate on the GST templates"},
	Excludes: []string{"Filing returns", "HSN/SAC validation", "e-Invoice (IRN) and e-Way Bill submission and their signed QR codes", "Reverse charge, composition and SEZ rules"},
	Rates: []Rate{
		{"gst-0", "0%", 0, "Nil-rated and exempt supplies", "2017-07-01", ""},
		{"gst-025", "0.25%", 0.25, "Rough diamonds and precious stones", "2017-07-01", ""},
		{"gst-3", "3%", 3, "Gold, silver and jewellery", "2017-07-01", ""},
		{"gst-5", "5%", 5, "Goods and services in the lower slab", "2017-07-01", ""},
		{"gst-12", "12%", 12, "Former standard slab, replaced from 22 September 2025", "2017-07-01", "2025-09-21"},
		{"gst-18", "18%", 18, "Most goods and services (standard slab)", "2017-07-01", ""},
		{"gst-28", "28%", 28, "Former top slab, replaced from 22 September 2025", "2017-07-01", "2025-09-21"},
		{"gst-40", "40%", 40, "Demerit and luxury goods (from 22 September 2025)", "2025-09-22", ""},
	},
}

var ukVAT = Pack{
	ID: "uk-vat", Name: "United Kingdom VAT", Country: "GB", Status: Beta, Currency: "GBP", TaxName: "VAT", IDName: "VAT number",
	Source: "https://www.gov.uk/vat-rates", Version: "2026.10-1", Owner: "NodeDR Infotech maintainers", ReviewedOn: "",
	Covers:   []string{"VAT number check digits", "Standard, reduced and zero rates", "Domestic or overseas customer, with what to decide for overseas sales"},
	Excludes: []string{"Making Tax Digital submissions", "Flat rate and margin schemes", "Domestic reverse charge (for example construction)", "Northern Ireland protocol rules"},
	Rates: []Rate{
		{"vat-20", "20%", 20, "Standard rate", "2011-01-04", ""},
		{"vat-5", "5%", 5, "Reduced rate, for example some energy and children's car seats", "1991-04-01", ""},
		{"vat-0", "0%", 0, "Zero-rated, for example most food and children's clothes", "1973-04-01", ""},
	},
}

var euVAT = Pack{
	ID: "eu-vat", Name: "European Union VAT", Country: "EU", Status: Beta, Currency: "EUR", TaxName: "VAT", IDName: "VAT ID",
	Source: "https://taxation-customs.ec.europa.eu/taxation/vat/vat-directive/how-does-vat-work_en", Version: "2026.10-1",
	Owner: "NodeDR Infotech maintainers", ReviewedOn: "",
	Covers:   []string{"Standard rate of each member state by effective date", "Shape of each member state's VAT number", "Domestic, intra-EU and outside-EU sales, with what to decide"},
	Excludes: []string{"Reduced and super-reduced rates (they differ by country and product)", "VIES look-ups", "OSS and IOSS returns", "National invoice wording and e-invoicing formats other than UBL and XRechnung"},
	Rates:    nil,
}

var uaeVAT = Pack{
	ID: "ae-vat", Name: "United Arab Emirates VAT", Country: "AE", Status: Beta, Currency: "AED", TaxName: "VAT", IDName: "TRN",
	Source: "https://tax.gov.ae/en/taxes/vat.aspx", Version: "2026.10-1", Owner: "NodeDR Infotech maintainers", ReviewedOn: "",
	Covers:   []string{"TRN shape", "Standard and zero rates", "Domestic or overseas customer, with what to decide"},
	Excludes: []string{"Free zone and designated zone rules", "The UAE e-invoicing regime and its approved providers", "Excise tax"},
	Rates: []Rate{
		{"vat-5", "5%", 5, "Standard rate", "2018-01-01", ""},
		{"vat-0", "0%", 0, "Zero-rated, for example exports of goods and some international services", "2018-01-01", ""},
	},
}

var usSalesTax = Pack{
	ID: "us-sales-tax", Name: "United States sales tax", Country: "US", Status: Estimate, Currency: "USD", TaxName: "Sales tax", IDName: "EIN",
	Source: "https://www.irs.gov/publications/p334", Version: "2026.10-1", Owner: "NodeDR Infotech maintainers", ReviewedOn: "",
	Covers:   []string{"EIN shape", "Pointing out when the customer is marked exempt or the sale is cross-border"},
	Excludes: []string{"Any rate: US sales tax depends on the state, county and city, the product and nexus, so Mavri holds no rate table", "Marketplace facilitator rules", "Exemption certificate validation", "Filing"},
	Rates:    nil,
}

func init() {
	// The EU pack lists each member state's standard rate with its own effective date.
	for _, c := range EUCountries() {
		r := EUStandardRates[c]
		euVAT.Rates = append(euVAT.Rates, Rate{Code: "vat-" + strings.ToLower(c), Label: r.Name + " " + trimPct(r.Percent), Percent: r.Percent,
			Use: "Standard rate in " + r.Name, From: r.From})
	}
}

func trimPct(p float64) string { return strconv.FormatFloat(p, 'f', -1, 64) + "%" }
