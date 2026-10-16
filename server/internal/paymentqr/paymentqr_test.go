package paymentqr

import (
	"strings"
	"testing"

	"github.com/Raktim94/mavri/server/internal/model"
)

func TestIBAN(t *testing.T) {
	for _, ok := range []string{"DE89 3704 0044 0532 0130 00", "GB82WEST12345698765432", "nl91abna0417164300", "FR1420041010050500013M02606"} {
		if !IsIBAN(ok) {
			t.Errorf("%q should be valid", ok)
		}
	}
	for _, bad := range []string{"", "DE89 3704 0044 0532 0130 01", "DE8937040044053201300", "1234567890123456", "GB82WEST1234569876543"} {
		if IsIBAN(bad) {
			t.Errorf("%q should be invalid", bad)
		}
	}
}

func TestEPC(t *testing.T) {
	p, err := EPC("Red Cross", "BE68 5390 0754 7034", "GEBABEBB", 123456, "INV-7")
	if err != nil {
		t.Fatal(err)
	}
	want := "BCD\n002\n1\nSCT\nGEBABEBB\nRed Cross\nBE68539007547034\nEUR1234.56\n\n\nINV-7\n"
	if p != want {
		t.Fatalf("payload\n%q\nwant\n%q", p, want)
	}
	if _, err := EPC("x", "BE00 0000 0000 0000", "", 100, "r"); err == nil {
		t.Fatal("bad IBAN accepted")
	}
	if _, err := EPC("x", "BE68 5390 0754 7034", "", 0, "r"); err == nil {
		t.Fatal("zero amount accepted")
	}
	if q, _ := EPC("x", "BE68 5390 0754 7034", "bad", 100, "r"); strings.Split(q, "\n")[4] != "" {
		t.Fatal("a malformed BIC must be left out")
	}
}

func TestUPI(t *testing.T) {
	p, err := UPI("shop@okbank", "Northwind Studio", 94400, "INV 42")
	if err != nil {
		t.Fatal(err)
	}
	want := "upi://pay?am=944.00&cu=INR&pa=shop%40okbank&pn=Northwind%20Studio&tn=INV%2042"
	if p != want {
		t.Fatalf("got %s\nwant %s", p, want)
	}
	for _, bad := range []string{"", "nobank", "a@", "@bank"} {
		if _, err := UPI(bad, "x", 100, ""); err == nil {
			t.Errorf("%q accepted", bad)
		}
	}
	if _, err := UPI("a1@bank", "x", 0, ""); err == nil {
		t.Error("zero amount accepted")
	}
}

func invoice(cur string, bank model.BankAccount) model.Document {
	return model.Document{Kind: model.KindInvoice, FullNumber: "INV-9", Status: model.StatusUnpaid,
		Currency: model.Currency{Code: cur}, Bank: bank, Issuer: model.Party{Name: "Studio"},
		Totals: model.Totals{TotalCents: 50000}, PaidCents: 10000}
}

func TestForAsksForTheBalanceOnly(t *testing.T) {
	d := invoice("INR", model.BankAccount{Label: "Main", UPI: "studio@bank", AccountNumber: "123"})
	opts := For(d)
	if len(opts) != 2 || opts[0].Kind != "upi" || opts[1].Kind != "bank" {
		t.Fatalf("options: %+v", opts)
	}
	if opts[0].AmountCents != 40000 || !strings.Contains(opts[0].Payload, "am=400.00") {
		t.Fatalf("must ask for the 400.00 balance: %+v", opts[0])
	}
}

func TestForSepaNeedsEuroAndIBAN(t *testing.T) {
	b := model.BankAccount{Label: "Main", AccountNumber: "NL91 ABNA 0417 1643 00", Holder: "Studio BV", Swift: "ABNANL2A"}
	if o := For(invoice("EUR", b)); len(o) != 2 || o[0].Kind != "sepa" {
		t.Fatalf("EUR with IBAN: %+v", o)
	}
	if o := For(invoice("USD", b)); len(o) != 1 || o[0].Kind != "bank" {
		t.Fatalf("USD must fall back to plain details: %+v", o)
	}
}

func TestForNothingToPay(t *testing.T) {
	b := model.BankAccount{Label: "Main", AccountNumber: "123"}
	paid := invoice("INR", b)
	paid.Status = model.StatusPaid
	quote := invoice("INR", b)
	quote.Kind = model.KindQuote
	nobank := invoice("INR", model.BankAccount{})
	for name, d := range map[string]model.Document{"paid": paid, "quote": quote, "no bank": nobank} {
		if o := For(d); len(o) != 0 {
			t.Errorf("%s: %+v", name, o)
		}
	}
}
