package taxpack

import (
	"regexp"
	"strings"
)

// IDCheck is the result of reading a tax registration number.
type IDCheck struct {
	Country string `json:"country"`
	Kind    string `json:"kind"` // GSTIN, VAT, TRN, EIN
	Valid   bool   `json:"valid"`
	// Level says how much was checked: "checksum" means the number is internally consistent,
	// "format" means only its shape was checked. Neither proves the number is registered or belongs to the business.
	Level   string `json:"level"`
	Message string `json:"message"`
	State   string `json:"state,omitempty"` // India: the state or territory in the first two digits
}

func clean(s string) string {
	return strings.ToUpper(strings.NewReplacer(" ", "", "-", "", ".", "", "/", "").Replace(strings.TrimSpace(s)))
}

// CheckID reads a registration number for a country. An empty number is not an error here; callers decide whether one is needed.
func CheckID(country, id string) IDCheck {
	country = strings.ToUpper(strings.TrimSpace(country))
	id = clean(id)
	if id == "" {
		return IDCheck{Country: country, Message: "No number entered."}
	}
	switch {
	case country == "IN":
		return checkGSTIN(id)
	case country == "GB":
		return checkGB(id)
	case country == "AE":
		return checkTRN(id)
	case country == "US":
		return checkEIN(id)
	case IsEU(country):
		return checkEU(country, id)
	}
	return IDCheck{Country: country, Level: "none", Message: "Mavri has no check for numbers from this country."}
}

var gstinRE = regexp.MustCompile(`^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][1-9A-Z]Z[0-9A-Z]$`)

const alnum36 = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ"

func gstinCheckChar(first14 string) byte {
	total, factor := 0, 2
	for i := len(first14) - 1; i >= 0; i-- {
		v := strings.IndexByte(alnum36, first14[i])
		d := factor * v
		if factor == 2 {
			factor = 1
		} else {
			factor = 2
		}
		total += d/36 + d%36
	}
	return alnum36[(36-total%36)%36]
}

func checkGSTIN(id string) IDCheck {
	r := IDCheck{Country: "IN", Kind: "GSTIN", Level: "checksum"}
	if len(id) != 15 || !gstinRE.MatchString(id) {
		r.Message = "A GSTIN has 15 characters: 2 digits for the state, the 10-character PAN, an entity number, Z and a check character."
		return r
	}
	name, ok := IndiaStates[id[:2]]
	if !ok {
		r.Message = "The first two digits are not a GST state or territory code."
		return r
	}
	if gstinCheckChar(id[:14]) != id[14] {
		r.Message = "The check character does not match, so there is a typing mistake somewhere."
		return r
	}
	r.Valid, r.State = true, name
	r.Message = "Consistent GSTIN for " + name + ". Mavri cannot tell whether it is registered; check it on the GST portal."
	return r
}

var gbRE = regexp.MustCompile(`^(GB)?([0-9]{9}|[0-9]{12})$`)

func checkGB(id string) IDCheck {
	r := IDCheck{Country: "GB", Kind: "VAT", Level: "checksum"}
	m := gbRE.FindStringSubmatch(id)
	if m == nil {
		if len(id) >= 5 && (strings.HasPrefix(id, "GBGD") || strings.HasPrefix(id, "GBHA")) {
			r.Level, r.Valid = "format", true
			r.Message = "Government department or health authority number; Mavri does not check these."
			return r
		}
		r.Level = "format"
		r.Message = "A UK VAT number is 9 digits (12 for a branch), optionally starting with GB."
		return r
	}
	d := m[2]
	total := 0
	for i, w := range []int{8, 7, 6, 5, 4, 3, 2} {
		total += int(d[i]-'0') * w
	}
	cd := int(d[7]-'0')*10 + int(d[8]-'0')
	if (total+cd)%97 != 0 && (total+55+cd)%97 != 0 {
		r.Message = "The check digits do not match, so there is a typing mistake somewhere."
		return r
	}
	r.Valid = true
	r.Message = "Consistent UK VAT number. Mavri cannot tell whether it is registered; check it with HMRC."
	return r
}

var trnRE = regexp.MustCompile(`^[0-9]{15}$`)

func checkTRN(id string) IDCheck {
	r := IDCheck{Country: "AE", Kind: "TRN", Level: "format"}
	if !trnRE.MatchString(id) {
		r.Message = "A UAE Tax Registration Number has 15 digits."
		return r
	}
	r.Valid = true
	r.Message = "Right shape for a TRN. Mavri cannot tell whether it is registered; check it on the FTA portal."
	return r
}

var einRE = regexp.MustCompile(`^[0-9]{9}$`)

func checkEIN(id string) IDCheck {
	r := IDCheck{Country: "US", Kind: "EIN", Level: "format"}
	if !einRE.MatchString(id) {
		r.Message = "A US EIN has 9 digits, written 12-3456789."
		return r
	}
	r.Valid = true
	r.Message = "Right shape for an EIN. A sales tax permit number is a different number issued by each state."
	return r
}

// euVATRE holds the shape of each member state's VAT number (after the country prefix).
var euVATRE = map[string]*regexp.Regexp{
	"AT": regexp.MustCompile(`^U[0-9]{8}$`),
	"BE": regexp.MustCompile(`^[01][0-9]{9}$`),
	"BG": regexp.MustCompile(`^[0-9]{9,10}$`),
	"HR": regexp.MustCompile(`^[0-9]{11}$`),
	"CY": regexp.MustCompile(`^[0-9]{8}[A-Z]$`),
	"CZ": regexp.MustCompile(`^[0-9]{8,10}$`),
	"DK": regexp.MustCompile(`^[0-9]{8}$`),
	"EE": regexp.MustCompile(`^[0-9]{9}$`),
	"FI": regexp.MustCompile(`^[0-9]{8}$`),
	"FR": regexp.MustCompile(`^[0-9A-Z]{2}[0-9]{9}$`),
	"DE": regexp.MustCompile(`^[0-9]{9}$`),
	"GR": regexp.MustCompile(`^[0-9]{9}$`),
	"HU": regexp.MustCompile(`^[0-9]{8}$`),
	"IE": regexp.MustCompile(`^([0-9][0-9A-Z+*][0-9]{5}[A-Z]{1,2}|[0-9]{7}[A-W][A-I])$`),
	"IT": regexp.MustCompile(`^[0-9]{11}$`),
	"LV": regexp.MustCompile(`^[0-9]{11}$`),
	"LT": regexp.MustCompile(`^([0-9]{9}|[0-9]{12})$`),
	"LU": regexp.MustCompile(`^[0-9]{8}$`),
	"MT": regexp.MustCompile(`^[0-9]{8}$`),
	"NL": regexp.MustCompile(`^[0-9]{9}B[0-9]{2}$`),
	"PL": regexp.MustCompile(`^[0-9]{10}$`),
	"PT": regexp.MustCompile(`^[0-9]{9}$`),
	"RO": regexp.MustCompile(`^[0-9]{2,10}$`),
	"SK": regexp.MustCompile(`^[0-9]{10}$`),
	"SI": regexp.MustCompile(`^[0-9]{8}$`),
	"ES": regexp.MustCompile(`^[0-9A-Z][0-9]{7}[0-9A-Z]$`),
	"SE": regexp.MustCompile(`^[0-9]{12}$`),
}

func checkEU(country, id string) IDCheck {
	r := IDCheck{Country: country, Kind: "VAT", Level: "format"}
	prefix := country
	if country == "GR" {
		prefix = "EL" // Greece uses EL in VAT numbers
	}
	body := strings.TrimPrefix(id, prefix)
	if country == "GR" && strings.HasPrefix(id, "GR") {
		body = strings.TrimPrefix(id, "GR")
	}
	re := euVATRE[country]
	if re == nil || !re.MatchString(body) {
		r.Message = "That does not look like a " + country + " VAT number (expected " + prefix + " followed by the national number)."
		return r
	}
	r.Valid = true
	r.Message = "Right shape for a " + country + " VAT number. For a cross-border sale, confirm it is active in the EU VIES service; Mavri does not look it up."
	return r
}
