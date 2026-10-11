// Package einvoice builds the electronic invoice XML (UBL 2.1 / PEPPOL BIS
// Billing 3.0 and XRechnung) from an invoice read with everything attached.
// Amounts use floating-point arithmetic and JavaScript's number printing on
// purpose: the output must match what the old server produced.
package einvoice

import (
	"fmt"
	"regexp"
	"strconv"
	"strings"
	"time"

	"github.com/Raktim94/nodedr-invoice/rewrite/internal/entity"
	"github.com/Raktim94/nodedr-invoice/rewrite/internal/jsnum"
)

// Row is an invoice or one of its parts.
type Row = entity.Row

// strOf is String(v) for the values that can reach the XML.
func strOf(v any) string {
	switch x := v.(type) {
	case nil:
		return ""
	case string:
		return x
	case bool:
		return strconv.FormatBool(x)
	case int64:
		return strconv.FormatInt(x, 10)
	case float64:
		return jsnum.Format(x)
	}
	return fmt.Sprint(v)
}

// xmlEscape escapes & < > ' and the two-character sequence backslash+quote;
// a plain double quote is left alone, exactly as the old function did.
func xmlEscape(v any) string {
	s := strOf(v)
	s = strings.ReplaceAll(s, "&", "&amp;")
	s = strings.ReplaceAll(s, "<", "&lt;")
	s = strings.ReplaceAll(s, ">", "&gt;")
	s = strings.ReplaceAll(s, `\"`, "&quot;")
	s = strings.ReplaceAll(s, "'", "&apos;")
	return s
}

// address is a postal address cut out of one free-text line.
type address struct {
	street, city, postalZone, country, countryCode string
}

var postalRegex = regexp.MustCompile(`\b[A-Z]{0,2}-?\d{4,6}\b`)
var digitRegex = regexp.MustCompile(`\d`)
var countryRegex = regexp.MustCompile(`^[A-Z]{2,3}$`)

// splitAddress guesses street, city, postal code and country from
// "street, city, postcode, country".
func splitAddress(addr string) address {
	if addr == "" {
		return address{}
	}
	raw := strings.Split(addr, ",")
	parts := make([]string, len(raw))
	for i, p := range raw {
		parts[i] = strings.TrimSpace(p)
	}
	country := parts[len(parts)-1]
	parts = parts[:len(parts)-1]

	postal := ""
	if len(parts) > 0 {
		if m := postalRegex.FindString(parts[len(parts)-1]); m != "" {
			postal = m
			parts = parts[:len(parts)-1]
		}
	}
	street := ""
	for i := range parts {
		if digitRegex.MatchString(parts[i]) {
			street = parts[i]
			parts = append(parts[:i], parts[i+1:]...)
			break
		}
	}
	a := address{street: street, postalZone: postal, country: country}
	if len(parts) > 0 {
		a.city = parts[0]
	}
	if country != "" && countryRegex.MatchString(country) && len(country) == 3 {
		a.countryCode = country[:2]
	}
	return a
}

var isoRegex = regexp.MustCompile(`^(\d{4})-(\d{2})-(\d{2})(?:[T ](\d{2})(?::(\d{2})(?::(\d{2})(?:[.,](\d+))?)?)?(Z|[+-]\d{2}(?::?\d{2})?)?)?$`)

// formatDate is format(parseISO(date), "yyyy-MM-dd"): a date alone and a date
// and time without a zone are read in local time, one with a zone is an
// instant shown in local time. Unreadable input gives "".
func formatDate(v string) string {
	m := isoRegex.FindStringSubmatch(strings.TrimSpace(v))
	if m == nil {
		return ""
	}
	atoi := func(s string) int { n, _ := strconv.Atoi(s); return n }
	year, month, day := atoi(m[1]), atoi(m[2]), atoi(m[3])
	hour, min, sec := atoi(m[4]), atoi(m[5]), atoi(m[6])
	if month < 1 || month > 12 || day < 1 || day > 31 || hour > 24 || min > 59 || sec > 59 {
		return ""
	}
	loc := time.Local
	if z := m[8]; z != "" {
		if z == "Z" {
			loc = time.UTC
		} else {
			sign := 1
			if z[0] == '-' {
				sign = -1
			}
			digits := strings.ReplaceAll(z[1:], ":", "")
			oh, om := atoi(digits[:2]), 0
			if len(digits) >= 4 {
				om = atoi(digits[2:4])
			}
			loc = time.FixedZone("", sign*(oh*3600+om*60))
		}
	}
	t := time.Date(year, time.Month(month), day, hour, min, sec, 0, loc)
	if t.Day() != day { // 31 February and the like
		return ""
	}
	return t.In(time.Local).Format("2006-01-02")
}

var (
	closingTag  = regexp.MustCompile(`^</[^>]+>`)
	openingTag  = regexp.MustCompile(`^<[^\\/?][^>]*>$`)
	selfClosing = regexp.MustCompile(`<[^>]+/>$`)
	declaration = regexp.MustCompile(`^<\?`)
	betweenTags = regexp.MustCompile(`>[\s\p{Z}\x{FEFF}]*<`)
)

// formatXML indents the XML one tag per line.
func formatXML(xml string) string {
	xml = strings.TrimSpace(xml)
	xml = betweenTags.ReplaceAllString(xml, ">\n<")
	indent := 0
	var out []string
	for _, line := range strings.Split(xml, "\n") {
		line = strings.TrimSpace(line)
		if line == "" {
			continue
		}
		if closingTag.MatchString(line) {
			if indent > 0 {
				indent--
			}
		}
		out = append(out, strings.Repeat("  ", indent)+line)
		if openingTag.MatchString(line) && !selfClosing.MatchString(line) && !declaration.MatchString(line) {
			indent++
		}
	}
	return strings.Join(out, "\n")
}
