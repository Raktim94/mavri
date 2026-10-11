package api

import (
	"fmt"
	"os"
	"path/filepath"
	"strings"
	"testing"
)

// The golden files in testdata/einvoice were written by the original
// TypeScript server for these exact requests, so the Go output has to match
// them character for character (amounts, rounding, escaping, layout).
func TestEInvoiceXMLMatchesTheOriginalServer(t *testing.T) {
	requests, err := filepath.Glob("testdata/einvoice/*.request.json")
	if err != nil || len(requests) == 0 {
		t.Fatalf("no fixtures: %v", err)
	}
	for _, path := range requests {
		tag := strings.TrimSuffix(filepath.Base(path), ".request.json")
		t.Run(tag, func(t *testing.T) {
			_, do := invoiceEnv(t)
			do("POST", "/api/items", `{"name":"Gizmo","amount":"1"}`)
			do("POST", "/api/banks", `{"name":"Main","bankName":"First","accountNumber":"1"}`)
			body, _ := os.ReadFile(path)
			made := do("POST", "/api/invoices", string(body))
			if made.Body["success"] != true {
				t.Fatalf("create: %v", made.Body)
			}
			id := made.data()["id"]
			for _, profile := range []string{"ubl21", "xrechnung"} {
				want, err := os.ReadFile(fmt.Sprintf("testdata/einvoice/%s.%s.xml", tag, profile))
				if err != nil {
					t.Fatal(err)
				}
				rec := rawGet(t, do, fmt.Sprintf("/api/invoices/xml?invoiceId=%v&einvoice=%s", id, profile))
				if rec.code != 200 || rec.disposition != fmt.Sprintf(`attachment; filename="einvoice-%v.xml"`, id) {
					t.Fatalf("%s: %d %q", profile, rec.code, rec.disposition)
				}
				if rec.body != string(want) {
					t.Errorf("%s differs from the original server's output:\n%s", profile, firstDifference(rec.body, string(want)))
				}
			}
		})
	}
}

func firstDifference(got, want string) string {
	g, w := strings.Split(got, "\n"), strings.Split(want, "\n")
	for i := 0; i < len(g) && i < len(w); i++ {
		if g[i] != w[i] {
			return fmt.Sprintf("line %d\n got:  %s\n want: %s", i+1, g[i], w[i])
		}
	}
	return fmt.Sprintf("lengths differ: %d vs %d lines", len(g), len(w))
}

func TestEInvoiceRefusesWhatCannotBeExported(t *testing.T) {
	_, do := invoiceEnv(t)
	do("POST", "/api/invoices", invoiceBody(t, "0001", nil)) // no Peppol details, no due date
	cases := []struct{ path, message string }{
		{"/api/invoices/xml?invoiceId=1&einvoice=ubl21", "error.peppolBusinessSchema"},
		{"/api/invoices/xml?invoiceId=1&einvoice=xrechnung", "error.xrechnungBusinessSchema"},
		{"/api/invoices/xml?invoiceId=999&einvoice=ubl21", "error.invoiceNotFound"},
		{"/api/invoices/xml?invoiceId=1&einvoice=bogus", "unknown e-invoice profile"},
		{"/api/invoices/xml?invoiceId=abc&einvoice=ubl21", "error.invoiceNotFound"},
		{"/api/invoices/xml?invoiceId=1%20OR%201%3D1&einvoice=ubl21", "error.invoiceNotFound"},
	}
	for _, c := range cases {
		rec := rawGet(t, do, c.path)
		if rec.code != 500 || !strings.Contains(rec.body, `"message":"`+c.message+`"`) {
			t.Errorf("%s: %d %s", c.path, rec.code, rec.body)
		}
	}
}
