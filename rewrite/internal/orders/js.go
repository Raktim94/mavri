package orders

import (
	"encoding/json"
	"math"
	"strconv"
	"strings"
)

// The incoming orders were handled by JavaScript, whose Number() and String()
// accept almost anything. These helpers keep that behaviour so a store that
// sends "19.99" or 2 or null is read the same way as before.

// num is JavaScript's Number(v); NaN when it is not a number.
func num(v any) float64 {
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

// numString is how JavaScript prints a number.
func numString(f float64) string {
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
	if math.Abs(f) < 1e21 && math.Abs(f) >= 1e-6 {
		return strconv.FormatFloat(f, 'f', -1, 64)
	}
	s := strconv.FormatFloat(f, 'e', -1, 64) // 1e+21, 1.5e-7
	s = strings.Replace(s, "e+", "e+", 1)
	if i := strings.Index(s, "e-0"); i >= 0 {
		s = s[:i+2] + s[i+3:]
	}
	if i := strings.Index(s, "e+0"); i >= 0 {
		s = s[:i+2] + s[i+3:]
	}
	return s
}

// str is JavaScript's String(v).
func str(v any) string {
	switch x := v.(type) {
	case nil:
		return "null"
	case string:
		return x
	case bool:
		return strconv.FormatBool(x)
	case json.Number:
		return numString(num(x))
	case float64:
		return numString(x)
	case int64:
		return strconv.FormatInt(x, 10)
	}
	return "[object Object]"
}

// truthy is JavaScript's truthiness.
func truthy(v any) bool {
	switch x := v.(type) {
	case nil:
		return false
	case bool:
		return x
	case string:
		return x != ""
	case json.Number:
		f := num(x)
		return f != 0 && !math.IsNaN(f)
	case float64:
		return x != 0 && !math.IsNaN(x)
	}
	return true
}

// stringOr returns v when it is a string, otherwise nil (typeof v === 'string' ? v : undefined).
func stringOr(v any) any {
	if s, ok := v.(string); ok {
		return s
	}
	return nil
}

func obj(v any) map[string]any {
	if m, ok := v.(map[string]any); ok {
		return m
	}
	return map[string]any{}
}

func list(v any) []map[string]any {
	items, _ := v.([]any)
	out := make([]map[string]any, 0, len(items))
	for _, it := range items {
		out = append(out, obj(it))
	}
	return out
}

// firstDefined is a ?? b: b when a is null or missing.
func firstDefined(vals ...any) any {
	for _, v := range vals {
		if v != nil {
			return v
		}
	}
	return nil
}

// round is Math.round: halves go up.
func round(f float64) float64 { return math.Floor(f + 0.5) }

// Num, Str and Truthy expose the JavaScript conversions to request handlers.
func Num(v any) float64 { return num(v) }
func Str(v any) string  { return str(v) }
func Truthy(v any) bool { return truthy(v) }
