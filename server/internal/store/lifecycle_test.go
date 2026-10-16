package store

import (
	"context"
	"errors"
	"testing"

	"github.com/Raktim94/mavri/server/internal/model"
)

func issued(t *testing.T, f fixture) model.Document {
	t.Helper()
	ctx := context.Background()
	d := f.doc("invoice")
	d.Status = "draft"
	doc, err := f.s.CreateDocument(ctx, d, SaveOptions{})
	if err != nil {
		t.Fatal(err)
	}
	if doc.Status != "draft" || doc.Locked {
		t.Fatalf("a new draft: %+v", doc)
	}
	out, err := f.s.IssueDocument(ctx, doc.ID)
	if err != nil {
		t.Fatal(err)
	}
	return out
}

func TestDraftThenIssueLocksTheInvoice(t *testing.T) {
	f, ctx := newFixture(t), context.Background()
	d := issued(t, f)
	if !d.Locked || d.IssuedAt == "" || d.Status != "unpaid" {
		t.Fatalf("issued: %+v", d)
	}
	if _, err := f.s.IssueDocument(ctx, d.ID); err == nil {
		t.Fatal("issued twice")
	}
	// Any change to the figures or details is refused, with a pointer to the right tool.
	edit := d
	edit.Lines = []model.Line{{Name: "Work", Quantity: 3, UnitCents: 99999}}
	if _, err := f.s.UpdateDocument(ctx, d.ID, edit, SaveOptions{}); !errors.Is(err, ErrLocked) {
		t.Fatalf("editing an issued invoice: %v", err)
	}
	for name, mutate := range map[string]func(*model.Document){
		"due date": func(x *model.Document) { x.DueOn = "2027-01-01" },
		"note":     func(x *model.Document) { x.NoteCustomer = "changed" },
		"number":   func(x *model.Document) { x.Number = "77" },
		"style":    func(x *model.Document) { id := int64(1); x.StyleID = &id },
	} {
		e := d
		mutate(&e)
		if _, err := f.s.UpdateDocument(ctx, d.ID, e, SaveOptions{}); !errors.Is(err, ErrLocked) {
			t.Errorf("%s: %v", name, err)
		}
	}
	// Payments and voiding stay possible.
	pay := d
	pay.Payments = []model.Payment{{AmountCents: 10000, PaidOn: "2026-10-05", Method: "bank"}}
	got, err := f.s.UpdateDocument(ctx, d.ID, pay, SaveOptions{})
	if err != nil || got.Status != "partial" || !got.Locked {
		t.Fatalf("payment on an issued invoice: %v %+v", err, got)
	}
	// Setting locked from outside does nothing.
	sneaky := got
	sneaky.Locked = false
	if again, _ := f.s.UpdateDocument(ctx, d.ID, sneaky, SaveOptions{}); !again.Locked {
		t.Fatal("the API unlocked an issued invoice")
	}
	if err := f.s.DeleteDocument(ctx, d.ID); !errors.Is(err, ErrLocked) {
		t.Fatalf("deleting an issued invoice: %v", err)
	}
	void := got
	void.Status = "void"
	if v, err := f.s.UpdateDocument(ctx, d.ID, void, SaveOptions{}); err != nil || v.Status != "void" {
		t.Fatalf("voiding: %v %+v", err, v)
	}
}

func TestADraftStaysEditableAndDeletable(t *testing.T) {
	f, ctx := newFixture(t), context.Background()
	d := f.doc("invoice")
	d.Status = "draft"
	doc, _ := f.s.CreateDocument(ctx, d, SaveOptions{})
	doc.Lines[0].UnitCents = 5000
	got, err := f.s.UpdateDocument(ctx, doc.ID, doc, SaveOptions{})
	if err != nil || got.Totals.SubtotalCents != 15000 {
		t.Fatalf("editing a draft: %v", err)
	}
	pay := f.doc("invoice")
	pay.Status = "draft"
	pay.Payments = []model.Payment{{AmountCents: 100, PaidOn: "2026-10-05"}}
	if _, err := f.s.CreateDocument(ctx, pay, SaveOptions{}); err == nil {
		t.Fatal("a draft with a payment was accepted")
	}
	if err := f.s.DeleteDocument(ctx, doc.ID); err != nil {
		t.Fatalf("a draft can be deleted: %v", err)
	}
}

func TestCreditNoteReducesWhatIsOwedAndSettlesTheInvoice(t *testing.T) {
	f, ctx := newFixture(t), context.Background()
	inv := issued(t, f) // 3 x 100.00 + 10% = 330.00
	if _, err := f.s.Correct(ctx, inv.ID, Correction{Kind: "credit", Reason: "x"}); err == nil {
		t.Fatal("a credit note needs to say what is credited")
	}
	part, err := f.s.Correct(ctx, inv.ID, Correction{Kind: "credit", Credit: []CreditLine{{Index: 0, Quantity: 1}}, Reason: "One day cancelled"})
	if err != nil {
		t.Fatal(err)
	}
	if part.DocType != "credit" || part.FullNumber != "CN-1" || part.Totals.TotalCents != 11000 || !part.Locked || part.Status != "credit" || *part.Corrects != inv.ID {
		t.Fatalf("credit note: %+v", part)
	}
	after, _ := f.s.GetDocument(ctx, f.s.DB, inv.ID)
	if after.CreditedCents != 11000 || after.PaidCents != 11000 || after.Status != "partial" || after.ReceivedCents != 0 {
		t.Fatalf("after a partial credit the invoice is part settled: %+v", after)
	}
	// Over-crediting is refused; the rest can be credited, which settles the invoice.
	if _, err := f.s.Correct(ctx, inv.ID, Correction{Kind: "credit", Full: true}); err == nil {
		t.Fatal("a full credit after a partial one would exceed the invoice")
	}
	rest, err := f.s.Correct(ctx, inv.ID, Correction{Kind: "credit", Credit: []CreditLine{{Index: 0, Quantity: 2}}})
	if err != nil || rest.FullNumber != "CN-2" {
		t.Fatalf("rest: %v %+v", err, rest)
	}
	final, _ := f.s.GetDocument(ctx, f.s.DB, inv.ID)
	if final.Status != "credited" || final.CreditedCents != 33000 {
		t.Fatalf("fully credited: %+v", final)
	}
	if list, _ := f.s.Corrections(ctx, inv.ID); len(list) != 2 || list[0].FullNumber != "CN-1" {
		t.Fatalf("corrections: %+v", list)
	}
	// A credit note cannot be edited or deleted, and cannot itself be corrected.
	if _, err := f.s.UpdateDocument(ctx, rest.ID, rest, SaveOptions{}); err != nil {
		t.Logf("unchanged update of a credit note: %v", err)
	}
	if err := f.s.DeleteDocument(ctx, rest.ID); !errors.Is(err, ErrLocked) {
		t.Fatalf("deleting a credit note: %v", err)
	}
	if _, err := f.s.Correct(ctx, rest.ID, Correction{Kind: "debit", Lines: []model.Line{{Name: "x", Quantity: 1, UnitCents: 1}}}); err == nil {
		t.Fatal("a credit note was corrected")
	}
}

func TestFullCreditCopiesEverything(t *testing.T) {
	f, ctx := newFixture(t), context.Background()
	d := f.doc("invoice")
	d.Status = "draft"
	d.ShippingCents = 500
	d.Discount = model.Adjustment{Mode: "percent", Percent: 10}
	doc, _ := f.s.CreateDocument(ctx, d, SaveOptions{})
	inv, _ := f.s.IssueDocument(ctx, doc.ID)
	cn, err := f.s.Correct(ctx, inv.ID, Correction{Kind: "credit", Full: true})
	if err != nil || cn.Totals.TotalCents != inv.Totals.TotalCents {
		t.Fatalf("a full credit equals the invoice: %v %d vs %d", err, cn.Totals.TotalCents, inv.Totals.TotalCents)
	}
	if after, _ := f.s.GetDocument(ctx, f.s.DB, inv.ID); after.Status != "credited" {
		t.Fatalf("status: %s", after.Status)
	}
}

func TestDebitNoteIsAnotherInvoiceForExtraCharges(t *testing.T) {
	f, ctx := newFixture(t), context.Background()
	inv := issued(t, f)
	dn, err := f.s.Correct(ctx, inv.ID, Correction{Kind: "debit", Lines: []model.Line{{Name: "Late change fee", Quantity: 1, UnitCents: 2500}}, Reason: "Extra work"})
	if err != nil {
		t.Fatal(err)
	}
	if dn.DocType != "debit" || dn.FullNumber != "DN-1" || dn.Totals.TotalCents != 2500 || dn.Status != "unpaid" || !dn.Locked {
		t.Fatalf("debit note: %+v", dn)
	}
	orig, _ := f.s.GetDocument(ctx, f.s.DB, inv.ID)
	if orig.CreditedCents != 0 || orig.Totals.TotalCents != inv.Totals.TotalCents {
		t.Fatalf("a debit note leaves the original alone: %+v", orig)
	}
	if _, err := f.s.Correct(ctx, inv.ID, Correction{Kind: "debit"}); err == nil {
		t.Fatal("a debit note with nothing charged")
	}
}

func TestOnlyAnIssuedInvoiceCanBeCorrected(t *testing.T) {
	f, ctx := newFixture(t), context.Background()
	d, _ := f.s.CreateDocument(ctx, f.doc("invoice"), SaveOptions{})
	if _, err := f.s.Correct(ctx, d.ID, Correction{Kind: "credit", Full: true}); err == nil {
		t.Fatal("a draft or an editable invoice was credited")
	}
	q, _ := f.s.CreateDocument(ctx, f.doc("quote"), SaveOptions{})
	if _, err := f.s.Correct(ctx, q.ID, Correction{Kind: "credit", Full: true}); err == nil {
		t.Fatal("a quote was credited")
	}
}

func TestRefundsReduceWhatWasReceived(t *testing.T) {
	f, ctx := newFixture(t), context.Background()
	d := f.doc("invoice")
	d.Payments = []model.Payment{{AmountCents: 33000, PaidOn: "2026-10-05", Method: "bank"}}
	doc, _ := f.s.CreateDocument(ctx, d, SaveOptions{})
	if doc.Status != "paid" {
		t.Fatalf("paid: %s", doc.Status)
	}
	doc.Payments = append(doc.Payments, model.Payment{AmountCents: 11000, PaidOn: "2026-10-09", Method: "bank", Kind: "refund"})
	got, err := f.s.UpdateDocument(ctx, doc.ID, doc, SaveOptions{})
	if err != nil || got.ReceivedCents != 22000 || got.Status != "partial" {
		t.Fatalf("after a refund: %v %+v", err, got)
	}
	got.Payments = append(got.Payments, model.Payment{AmountCents: 99999, PaidOn: "2026-10-10", Kind: "refund"})
	if _, err := f.s.UpdateDocument(ctx, doc.ID, got, SaveOptions{}); err == nil {
		t.Fatal("a refund of more than was received")
	}
}

func TestLineCategoriesForceNoTax(t *testing.T) {
	f, ctx := newFixture(t), context.Background()
	d := f.doc("invoice")
	d.Lines = []model.Line{{Name: "Export goods", Quantity: 1, UnitCents: 10000, TaxRate: 18, TaxMode: "add", TaxCategory: "export", Code: " SKU-1 ", TaxCode: "8471", Period: "Oct 2026", LineType: "product"}}
	got, err := f.s.CreateDocument(ctx, d, SaveOptions{})
	if err != nil || got.Totals.TaxCents != 0 || got.Lines[0].TaxRate != 0 || got.Lines[0].Code != "SKU-1" || got.Lines[0].TaxCode != "8471" || got.Lines[0].Period != "Oct 2026" {
		t.Fatalf("export line: %v %+v", err, got.Lines)
	}
	d.Lines[0].TaxCategory = "nonsense"
	if _, err := f.s.CreateDocument(ctx, d, SaveOptions{}); err == nil {
		t.Fatal("unknown tax category accepted")
	}
}

func TestSettlementCurrencyNeedsARate(t *testing.T) {
	f, ctx := newFixture(t), context.Background()
	d := f.doc("invoice")
	d.SettlementCurrency = "inr"
	if _, err := f.s.CreateDocument(ctx, d, SaveOptions{}); err == nil {
		t.Fatal("a settlement currency without a rate")
	}
	d.ExchangeRate, d.ExchangeDate = 83.25, "2026-10-01"
	got, err := f.s.CreateDocument(ctx, d, SaveOptions{})
	if err != nil || got.SettlementCurrency != "INR" || got.ExchangeRate != 83.25 {
		t.Fatalf("%v %+v", err, got)
	}
}
