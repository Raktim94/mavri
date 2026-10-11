package jsnum

import (
	"math"
	"testing"
)

func TestToFixedMatchesJavaScript(t *testing.T) {
	// Expected values are what Node prints for (n).toFixed(d).
	cases := []struct {
		n    float64
		d    int
		want string
	}{
		{0.125, 2, "0.13"}, {0.375, 2, "0.38"}, {2.5, 0, "3"}, {-2.5, 0, "-3"}, {1.005, 2, "1.00"}, {1.45, 1, "1.4"},
		{8.345, 2, "8.35"}, {0, 2, "0.00"}, {-0.001, 2, "-0.00"}, {10, 2, "10.00"}, {1234.5678, 2, "1234.57"},
		{0.000001, 2, "0.00"}, {99.995, 2, "100.00"}, {5, 4, "5.0000"}, {0.1 + 0.2, 2, "0.30"}, {1e21, 2, "1e+21"},
		{math.NaN(), 2, "NaN"}, {math.Inf(1), 2, "Infinity"}, {-1.5, 0, "-2"}, {123456789.125, 2, "123456789.13"},
	}
	for _, c := range cases {
		if got := ToFixed(c.n, c.d); got != c.want {
			t.Errorf("ToFixed(%v,%d) = %q, want %q", c.n, c.d, got, c.want)
		}
	}
}

func TestRoundIsMathRound(t *testing.T) {
	for in, want := range map[float64]float64{0.5: 1, 1.5: 2, 2.5: 3, -0.5: 0, -1.5: -1, -2.5: -2, 0.49999999999999994: 0, 2.4: 2, -2.6: -3} {
		if got := Round(in); got != want && !(got == 0 && want == 0) {
			t.Errorf("Round(%v) = %v, want %v", in, got, want)
		}
	}
}

func TestFormatIsJavaScriptString(t *testing.T) {
	tenth := 0.1
	for in, want := range map[float64]string{5: "5", tenth + 0.2: "0.30000000000000004", 12.5: "12.5", 1e21: "1e+21", 1.5e-7: "1.5e-7",
		123456789012: "123456789012", -0.25: "-0.25", 0: "0", 1e-6: "0.000001"} {
		if got := Format(in); got != want {
			t.Errorf("Format(%v) = %q, want %q", in, got, want)
		}
	}
}

func TestNum(t *testing.T) {
	for in, want := range map[string]float64{"12.5": 12.5, "": 0, " 7 ": 7, "1e3": 1000} {
		if got := Num(in); got != want {
			t.Errorf("Num(%q) = %v", in, got)
		}
	}
	if !math.IsNaN(Num("abc")) || !math.IsNaN(Num(map[string]any{})) {
		t.Error("non-numbers are NaN")
	}
}
