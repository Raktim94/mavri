package gst

import (
	"regexp"
	"strings"
)

const base36 = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ"

var (
	panRe    = regexp.MustCompile(`^[A-Z]{5}[0-9]{4}[A-Z]$`)
	gstinRe  = regexp.MustCompile(`^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][1-9A-Z]Z[0-9A-Z]$`)
	invNumRe = regexp.MustCompile(`^[A-Za-z0-9/-]{1,16}$`)
)

// GSTIN is a parsed GST identification number.
type GSTIN struct {
	Raw        string
	StateCode  string
	PAN        string
	Entity     string // 13th character: registration number of the PAN holder in the state
	CheckChar  string
	FormatOK   bool // 15 characters in the documented layout
	StateKnown bool // state code is a current code
	// ChecksumOK reports whether the last character matches the mod-36
	// checksum. The algorithm comes from public descriptions and reproduced two
	// widely cited sample GSTINs; it has not been checked against the GSTN
	// specification, so callers should warn, not block, on a mismatch.
	ChecksumOK bool
}

// ParseGSTIN normalises (trim, upper-case) and checks a GSTIN. It never
// claims the number is registered or active; only the GST portal can say that.
func ParseGSTIN(s string) GSTIN {
	g := GSTIN{Raw: strings.ToUpper(strings.TrimSpace(s))}
	if !gstinRe.MatchString(g.Raw) {
		return g
	}
	g.StateCode, g.PAN, g.Entity, g.CheckChar = g.Raw[:2], g.Raw[2:12], g.Raw[12:13], g.Raw[14:]
	g.FormatOK = panRe.MatchString(g.PAN)
	if st, ok := LookupState(g.StateCode); ok && st.Status == StateCurrent {
		g.StateKnown = true
	}
	g.ChecksumOK = g.FormatOK && checksum(g.Raw[:14]) == g.CheckChar
	return g
}

// checksum is the mod-36 check character for the first 14 characters.
func checksum(first14 string) string {
	sum := 0
	for i := 0; i < len(first14); i++ {
		v := strings.IndexByte(base36, first14[i])
		if v < 0 {
			return ""
		}
		if i%2 == 1 {
			v *= 2
		}
		sum += v/36 + v%36
	}
	return string(base36[(36-sum%36)%36])
}
