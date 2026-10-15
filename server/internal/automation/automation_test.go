package automation

import (
	"context"
	"strings"
	"testing"
	"time"

	"github.com/Raktim94/mavri/server/internal/activity"
	"github.com/Raktim94/mavri/server/internal/db"
	"github.com/Raktim94/mavri/server/internal/mailer"
	"github.com/Raktim94/mavri/server/internal/model"
	"github.com/Raktim94/mavri/server/internal/share"
	"github.com/Raktim94/mavri/server/internal/shop"
	"github.com/Raktim94/mavri/server/internal/store"
)

type env struct {
	s      *Service
	issuer model.Party
	cust   model.Party
	now    *time.Time
	sent   *[]string
}

func setup(t *testing.T, today string) env {
	t.Helper()
	d, err := db.Open(":memory:")
	if err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() { d.Close() })
	box, _ := shop.NewBox(t.TempDir(), "")
	day, _ := time.Parse("2006-01-02", today)
	st := &store.Store{DB: d, Now: func() time.Time { return day }}
	hub := &activity.Hub{DB: d, Box: box}
	var sent []string
	ml := &mailer.Service{DB: d, Box: box, Store: st, Links: &share.Links{DB: d}, Hub: hub,
		Send: func(_ mailer.Config, _ string, to []string, raw []byte) error {
			sent = append(sent, to[0]+"|"+string(raw))
			return nil
		}}
	cfg := mailer.Defaults()
	cfg.Enabled, cfg.Host, cfg.From = true, "smtp.test", "me@x.co"
	if err := ml.Save(context.Background(), cfg); err != nil {
		t.Fatal(err)
	}
	s := &Service{DB: d, Store: st, Mail: ml, Hub: hub, BaseURL: func(context.Context) string { return "https://inv.test" }}
	ctx := context.Background()
	issuer := model.Party{Kind: "issuer", Name: "Me"}
	cust := model.Party{Kind: "customer", Name: "Client", Email: "client@x.co"}
	store.Parties.Insert(ctx, d, &issuer)
	store.Parties.Insert(ctx, d, &cust)
	return env{s: s, issuer: issuer, cust: cust, now: &day, sent: &sent}
}

func (e env) invoice(t *testing.T, issued, due string) model.Document {
	t.Helper()
	d, err := e.s.Store.CreateDocument(context.Background(), model.Document{Kind: "invoice", IssuerID: e.issuer.ID, CustomerID: e.cust.ID, CurrencyID: 1,
		IssuedOn: issued, DueOn: due, Lines: []model.Line{{Name: "Work", Quantity: 1, UnitCents: 10000}}}, store.SaveOptions{})
	if err != nil {
		t.Fatal(err)
	}
	return d
}

func TestRemindersGoOutOncePerDay(t *testing.T) {
	e := setup(t, "2026-10-12")
	ctx := context.Background()
	e.invoice(t, "2026-10-01", "2026-10-15") // due in 3 days
	if n, _ := e.s.RunReminders(ctx); n != 0 {
		t.Fatal("reminders are off until switched on")
	}
	cfg := DefaultConfig()
	cfg.RemindersEnabled = true
	e.s.Save(ctx, cfg)
	if n, err := e.s.RunReminders(ctx); err != nil || n != 1 {
		t.Fatalf("sent %d, %v", n, err)
	}
	if n, _ := e.s.RunReminders(ctx); n != 0 {
		t.Fatal("the same reminder was sent twice")
	}
	if !strings.Contains((*e.sent)[0], "client@x.co") {
		t.Fatalf("recipient: %s", (*e.sent)[0])
	}
	// Other days of the schedule: nothing on a day with no rule, a nudge 7 days after the due date.
	*e.now = time.Date(2026, 10, 13, 0, 0, 0, 0, time.UTC)
	if n, _ := e.s.RunReminders(ctx); n != 0 {
		t.Fatalf("no rule for 2 days before: sent %d", n)
	}
	*e.now = time.Date(2026, 10, 22, 0, 0, 0, 0, time.UTC)
	if n, _ := e.s.RunReminders(ctx); n != 1 {
		t.Fatalf("7 days overdue should remind: sent %d", n)
	}
}

func TestRemindersRespectPaymentsAndClientOptOut(t *testing.T) {
	e := setup(t, "2026-10-15")
	ctx := context.Background()
	cfg := DefaultConfig()
	cfg.RemindersEnabled = true
	e.s.Save(ctx, cfg)
	paid := e.invoice(t, "2026-10-01", "2026-10-15")
	paid.Payments = []model.Payment{{AmountCents: 10000, PaidOn: "2026-10-10"}}
	if _, err := e.s.Store.UpdateDocument(ctx, paid.ID, paid, store.SaveOptions{}); err != nil {
		t.Fatal(err)
	}
	if n, _ := e.s.RunReminders(ctx); n != 0 {
		t.Fatal("a paid invoice must not be chased")
	}
	e.invoice(t, "2026-10-02", "2026-10-15")
	e.cust.NoReminders = true
	store.Parties.Update(ctx, e.s.DB, &e.cust)
	if n, _ := e.s.RunReminders(ctx); n != 0 {
		t.Fatal("a client who opted out must not be chased")
	}
	e.cust.NoReminders = false
	store.Parties.Update(ctx, e.s.DB, &e.cust)
	e.s.BaseURL = func(context.Context) string { return "" }
	if n, _ := e.s.RunReminders(ctx); n != 0 {
		t.Fatal("without a public address a reminder link would be broken: nothing should be sent")
	}
}

func TestRecurringIssuesOnScheduleAndCatchesUp(t *testing.T) {
	e := setup(t, "2026-10-31")
	ctx := context.Background()
	tpl := e.invoice(t, "2026-08-31", "2026-09-14")
	sc, err := e.s.Create(ctx, Schedule{DocumentID: tpl.ID, Every: "month", Interval: 1, StartOn: "2026-08-31"})
	if err != nil {
		t.Fatal(err)
	}
	pv, err := e.s.Preview(ctx, sc.ID, 4)
	if err != nil {
		t.Fatal(err)
	}
	// Month ends are clamped, not skipped or pushed into the next month.
	want := []string{"2026-08-31", "2026-09-30", "2026-10-31", "2026-11-30"}
	for i, u := range pv.Upcoming {
		if u.IssuedOn != want[i] {
			t.Fatalf("upcoming %d: %s, want %s", i, u.IssuedOn, want[i])
		}
	}
	if pv.Upcoming[1].DueOn != "2026-10-14" { // the 14-day term is kept
		t.Fatalf("due: %s", pv.Upcoming[1].DueOn)
	}
	n, err := e.s.RunRecurring(ctx)
	if err != nil || n != 3 {
		t.Fatalf("catch-up issued %d: %v", n, err)
	}
	if n, _ := e.s.RunRecurring(ctx); n != 0 {
		t.Fatalf("ran again with nothing due: %d", n)
	}
	list, _ := e.s.List(ctx)
	if list[0].IssuedCount != 3 || list[0].NextOn != "2026-11-30" || !list[0].Active {
		t.Fatalf("schedule: %+v", list[0])
	}
	items, _, _ := e.s.Store.ListDocuments(ctx, store.Filter{Kind: "invoice"})
	if len(items) != 4 { // the template and three copies
		t.Fatalf("invoices: %d", len(items))
	}
}

func TestRecurringStopsAtTheEndDate(t *testing.T) {
	e := setup(t, "2026-12-01")
	ctx := context.Background()
	tpl := e.invoice(t, "2026-10-01", "")
	sc, _ := e.s.Create(ctx, Schedule{DocumentID: tpl.ID, Every: "week", Interval: 2, StartOn: "2026-10-01", EndOn: "2026-10-20"})
	if n, _ := e.s.RunRecurring(ctx); n != 2 { // 10-01 and 10-15
		t.Fatalf("issued %d", n)
	}
	list, _ := e.s.List(ctx)
	if list[0].ID != sc.ID || list[0].Active {
		t.Fatalf("the schedule should have finished: %+v", list[0])
	}
}

func TestRecurringValidation(t *testing.T) {
	e := setup(t, "2026-10-01")
	ctx := context.Background()
	inv := e.invoice(t, "2026-10-01", "")
	q, _ := e.s.Store.CreateDocument(ctx, model.Document{Kind: "quote", IssuerID: e.issuer.ID, CustomerID: e.cust.ID, CurrencyID: 1, IssuedOn: "2026-10-01",
		Lines: []model.Line{{Name: "x", Quantity: 1}}}, store.SaveOptions{})
	for name, sc := range map[string]Schedule{
		"a quote":        {DocumentID: q.ID, Every: "month", StartOn: "2026-10-01"},
		"bad interval":   {DocumentID: inv.ID, Every: "fortnight", StartOn: "2026-10-01"},
		"bad date":       {DocumentID: inv.ID, Every: "month", StartOn: "next week"},
		"end before":     {DocumentID: inv.ID, Every: "month", StartOn: "2026-10-01", EndOn: "2026-09-01"},
		"missing source": {DocumentID: 999, Every: "month", StartOn: "2026-10-01"},
	} {
		if _, err := e.s.Create(ctx, sc); err == nil {
			t.Errorf("%s was accepted", name)
		}
	}
}

func TestQuoteAcceptedRule(t *testing.T) {
	e := setup(t, "2026-10-01")
	ctx := context.Background()
	q, _ := e.s.Store.CreateDocument(ctx, model.Document{Kind: "quote", IssuerID: e.issuer.ID, CustomerID: e.cust.ID, CurrencyID: 1, IssuedOn: "2026-10-01",
		Lines: []model.Line{{Name: "x", Quantity: 1, UnitCents: 500}}}, store.SaveOptions{})
	if inv, _ := e.s.OnQuoteAccepted(ctx, q.ID); inv != nil {
		t.Fatal("the rule is off by default")
	}
	cfg := DefaultConfig()
	cfg.QuoteAcceptedMakesInvoice = true
	e.s.Save(ctx, cfg)
	inv, err := e.s.OnQuoteAccepted(ctx, q.ID)
	if err != nil || inv == nil || inv.Kind != "invoice" || *inv.ConvertedFrom != q.ID {
		t.Fatalf("invoice: %+v %v", inv, err)
	}
	if again, err := e.s.OnQuoteAccepted(ctx, q.ID); again != nil || err != nil {
		t.Fatal("a second acceptance must not create a second invoice")
	}
}

func TestOverdueList(t *testing.T) {
	e := setup(t, "2026-10-20")
	ctx := context.Background()
	e.invoice(t, "2026-10-01", "2026-10-10")
	e.invoice(t, "2026-10-02", "2026-10-18")
	e.invoice(t, "2026-10-03", "2026-10-30")
	items, err := e.s.Overdue(ctx)
	if err != nil || len(items) != 2 || items[0].DaysOverdue != 10 || items[1].DaysOverdue != 2 {
		t.Fatalf("overdue: %+v %v", items, err)
	}
}

func TestConfigValidation(t *testing.T) {
	e := setup(t, "2026-10-01")
	ctx := context.Background()
	if _, err := e.s.Save(ctx, Config{RemindAfter: []int{0}}); err == nil {
		t.Fatal("day 0 is not an 'after' day")
	}
	if _, err := e.s.Save(ctx, Config{PublicURL: "invoices.example.com"}); err == nil {
		t.Fatal("a public address needs a scheme")
	}
	c, err := e.s.Save(ctx, Config{RemindAfter: []int{7, 3, 7}, PublicURL: "https://inv.example/ "})
	if err != nil || len(c.RemindAfter) != 2 || c.RemindAfter[0] != 3 || c.PublicURL != "https://inv.example" {
		t.Fatalf("normalised: %+v %v", c, err)
	}
}
