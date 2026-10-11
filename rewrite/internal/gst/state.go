// Package gst is the India GST module: identifiers, place-of-supply review,
// effective-dated rate rules and tax calculation.
//
// It deliberately contains NO tax rates. Rates come from a RuleBook that the
// business or its tax professional loads, each rule with an effective date, so
// a change in law is a data change. Mavri assists with recordkeeping and
// invoice generation; it does not file returns or give tax advice.
package gst

import "sort"

// StateStatus says whether a code can be chosen for new documents.
type StateStatus string

const (
	StateCurrent StateStatus = "current"
	StateLegacy  StateStatus = "legacy" // seen in older lists; do not offer for new invoices
)

// State is one GST state / union territory code.
type State struct {
	Code   string
	Name   string
	Status StateStatus
	// UTGST is true for union territories without a legislature, where the
	// state-side tax is UTGST instead of SGST. Delhi, Puducherry and Jammu and
	// Kashmir levy SGST. Confirm against current law before relying on it.
	UTGST bool
}

// states: codes 01-24, 26, 27, 29-38 and 97 are listed identically by the
// Tally and Zoho code lists checked on 2026-10-11. Codes 25 (Daman and Diu)
// and 28 (Andhra Pradesh, old) appear only in Tally's list and are kept as
// legacy. 96 (other country, used for exports) and 99 (centre jurisdiction)
// are NOT included until verified against the GSTN/e-invoice master data.
var states = []State{
	{"01", "Jammu and Kashmir", StateCurrent, false},
	{"02", "Himachal Pradesh", StateCurrent, false},
	{"03", "Punjab", StateCurrent, false},
	{"04", "Chandigarh", StateCurrent, true},
	{"05", "Uttarakhand", StateCurrent, false},
	{"06", "Haryana", StateCurrent, false},
	{"07", "Delhi", StateCurrent, false},
	{"08", "Rajasthan", StateCurrent, false},
	{"09", "Uttar Pradesh", StateCurrent, false},
	{"10", "Bihar", StateCurrent, false},
	{"11", "Sikkim", StateCurrent, false},
	{"12", "Arunachal Pradesh", StateCurrent, false},
	{"13", "Nagaland", StateCurrent, false},
	{"14", "Manipur", StateCurrent, false},
	{"15", "Mizoram", StateCurrent, false},
	{"16", "Tripura", StateCurrent, false},
	{"17", "Meghalaya", StateCurrent, false},
	{"18", "Assam", StateCurrent, false},
	{"19", "West Bengal", StateCurrent, false},
	{"20", "Jharkhand", StateCurrent, false},
	{"21", "Odisha", StateCurrent, false},
	{"22", "Chhattisgarh", StateCurrent, false},
	{"23", "Madhya Pradesh", StateCurrent, false},
	{"24", "Gujarat", StateCurrent, false},
	{"25", "Daman and Diu", StateLegacy, true},
	{"26", "Dadra and Nagar Haveli and Daman and Diu", StateCurrent, true},
	{"27", "Maharashtra", StateCurrent, false},
	{"28", "Andhra Pradesh (old)", StateLegacy, false},
	{"29", "Karnataka", StateCurrent, false},
	{"30", "Goa", StateCurrent, false},
	{"31", "Lakshadweep", StateCurrent, true},
	{"32", "Kerala", StateCurrent, false},
	{"33", "Tamil Nadu", StateCurrent, false},
	{"34", "Puducherry", StateCurrent, false},
	{"35", "Andaman and Nicobar Islands", StateCurrent, true},
	{"36", "Telangana", StateCurrent, false},
	{"37", "Andhra Pradesh", StateCurrent, false},
	{"38", "Ladakh", StateCurrent, true},
	{"97", "Other Territory", StateCurrent, true},
}

var stateByCode = func() map[string]State {
	m := make(map[string]State, len(states))
	for _, s := range states {
		m[s.Code] = s
	}
	return m
}()

// LookupState returns the state for a two-digit code.
func LookupState(code string) (State, bool) { s, ok := stateByCode[code]; return s, ok }

// States returns the codes that may be chosen for new documents, sorted by code.
func States() []State {
	var out []State
	for _, s := range states {
		if s.Status == StateCurrent {
			out = append(out, s)
		}
	}
	sort.Slice(out, func(i, j int) bool { return out[i].Code < out[j].Code })
	return out
}
