// Package jsnum reproduces the few JavaScript number behaviours the old
// server's output depended on: Number(), String(number), Math.round and
// Number.prototype.toFixed.
package jsnum

import (
	"encoding/json"
	"math"
	"math/big"
	"strconv"
	"strings"
)

// Num is JavaScript's Number(v); NaN when v is not a number.
func Num(v any) float64 {
	switch x := v.(type) {
	case nil:
		return 0
	case bool:
		if x {
			return 1
		}
		return 0
	case json.Number:
		f, err := x.Float64()
		if err != nil {
			return math.NaN()
		}
		return f
	case float64:
		return x
	case int64:
		return float64(x)
	case int:
		return float64(x)
	case string:
		t := strings.TrimSpace(x)
		if t == "" {
			return 0
		}
		f, err := strconv.ParseFloat(t, 64)
		if err != nil {
			return math.NaN()
		}
		return f
	}
	return math.NaN()
}

// Format is how JavaScript prints a number (String(n), `${n}`).
func Format(f float64) string {
	switch {
	case math.IsNaN(f):
		return "NaN"
	case math.IsInf(f, 1):
		return "Infinity"
	case math.IsInf(f, -1):
		return "-Infinity"
	case f == 0:
		return "0"
	}
	if a := math.Abs(f); a < 1e21 && a >= 1e-6 {
		return strconv.FormatFloat(f, 'f', -1, 64)
	}
	s := strconv.FormatFloat(f, 'e', -1, 64) // 1e+21, 1.5e-07
	if i := strings.Index(s, "e-0"); i >= 0 {
		s = s[:i+2] + s[i+3:]
	}
	if i := strings.Index(s, "e+0"); i >= 0 {
		s = s[:i+2] + s[i+3:]
	}
	return s
}

// Round is Math.round: halves go towards +Infinity.
func Round(f float64) float64 {
	if math.IsNaN(f) || math.IsInf(f, 0) {
		return f
	}
	r := math.Floor(f)
	if f-r >= 0.5 {
		r++
	}
	return r
}

// ToFixed is Number.prototype.toFixed(digits). The result is exact for the
// binary value, and a tie goes to the larger magnitude (0.125 -> "0.13").
func ToFixed(f float64, digits int) string {
	switch {
	case math.IsNaN(f):
		return "NaN"
	case math.IsInf(f, 1):
		return "Infinity"
	case math.IsInf(f, -1):
		return "-Infinity"
	}
	if math.Abs(f) >= 1e21 {
		return Format(f)
	}
	neg := f < 0
	if neg {
		f = -f
	}
	rat, _ := new(big.Rat).SetString(strconv.FormatFloat(f, 'f', -1, 64))
	// strconv gives the shortest decimal that round-trips, which can differ
	// from the exact binary value; use the exact one.
	exact := new(big.Float).SetFloat64(f)
	rat, _ = exact.Rat(nil)
	scale := new(big.Int).Exp(big.NewInt(10), big.NewInt(int64(digits)), nil)
	rat.Mul(rat, new(big.Rat).SetInt(scale))
	rat.Add(rat, big.NewRat(1, 2))
	n := new(big.Int).Div(rat.Num(), rat.Denom()) // floor for non-negative values
	s := n.String()
	if digits > 0 {
		if len(s) <= digits {
			s = strings.Repeat("0", digits-len(s)+1) + s
		}
		s = s[:len(s)-digits] + "." + s[len(s)-digits:]
	}
	if neg {
		s = "-" + s
	}
	return s
}

// Truthy is JavaScript's truthiness.
func Truthy(v any) bool {
	switch x := v.(type) {
	case nil:
		return false
	case bool:
		return x
	case string:
		return x != ""
	case json.Number, float64, int64, int:
		f := Num(x)
		return f != 0 && !math.IsNaN(f)
	}
	return true
}
