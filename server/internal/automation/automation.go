// Package automation runs Mavri's built-in rules: payment reminders around the
// due date, recurring invoices, and "when a quote is accepted, draft an invoice".
package automation

import (
	"context"
	"database/sql"
	"encoding/json"
	"errors"
	"fmt"
	"strings"
	"time"

	"github.com/Raktim94/mavri/server/internal/activity"
	"github.com/Raktim94/mavri/server/internal/mailer"
	"github.com/Raktim94/mavri/server/internal/model"
	"github.com/Raktim94/mavri/server/internal/store"
)

// ErrInvalid is a problem with what the caller sent.
var ErrInvalid = errors.New("invalid")

// Config holds the switches and the reminder schedule.
type Config struct {
	RemindersEnabled bool  `json:"remindersEnabled"`
	RemindBefore     []int `json:"remindBefore"` // days before the due date
	RemindOnDue      bool  `json:"remindOnDue"`
	RemindAfter      []int `json:"remindAfter"` // days after the due date
	// QuoteAcceptedMakesInvoice drafts an invoice as soon as a quote is accepted.
	QuoteAcceptedMakesInvoice bool `json:"quoteAcceptedMakesInvoice"`
	// PublicURL is the address clients use to reach this Mavri, e.g. https://invoices.example.com.
	// Automatic emails link to it; without it they cannot be sent.
	PublicURL string `json:"publicUrl"`
}

// DefaultConfig is off until the owner opts in, with a sensible schedule ready.
func DefaultConfig() Config {
	return Config{RemindBefore: []int{3}, RemindOnDue: true, RemindAfter: []int{3, 7, 14}}
}

// Service runs the rules.
type Service struct {
	DB    *sql.DB
	Store *store.Store
	Mail  *mailer.Service
	Hub   *activity.Hub
	// BaseURL is the public address of this installation, used in links of automatic emails.
	BaseURL func(ctx context.Context) string
}

// Load returns the saved configuration.
func (s *Service) Load(ctx context.Context) (Config, error) {
	cfg := DefaultConfig()
	var raw string
	err := s.DB.QueryRowContext(ctx, `SELECT value FROM settings WHERE key = 'automation'`).Scan(&raw)
	if errors.Is(err, sql.ErrNoRows) {
		return cfg, nil
	}
	if err != nil {
		return cfg, err
	}
	_ = json.Unmarshal([]byte(raw), &cfg)
	return cfg, nil
}

// Save validates and stores the configuration.
func (s *Service) Save(ctx context.Context, c Config) (Config, error) {
	c.PublicURL = strings.TrimRight(strings.TrimSpace(c.PublicURL), "/")
	if c.PublicURL != "" && !strings.HasPrefix(c.PublicURL, "https://") && !strings.HasPrefix(c.PublicURL, "http://") {
		return c, fmt.Errorf("%w: the public address must start with https:// (or http://)", ErrInvalid)
	}
	for _, list := range [][]int{c.RemindBefore, c.RemindAfter} {
		if len(list) > 6 {
			return c, fmt.Errorf("%w: at most six reminder days on each side", ErrInvalid)
		}
		for _, d := range list {
			if d < 1 || d > 365 {
				return c, fmt.Errorf("%w: reminder days must be between 1 and 365", ErrInvalid)
			}
		}
	}
	c.RemindBefore, c.RemindAfter = uniqSorted(c.RemindBefore), uniqSorted(c.RemindAfter)
	raw, _ := json.Marshal(c)
	_, err := s.DB.ExecContext(ctx, `INSERT INTO settings (key, value) VALUES ('automation', ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value`, string(raw))
	return c, err
}

func uniqSorted(in []int) []int {
	seen := map[int]bool{}
	out := []int{}
	for _, v := range in {
		if !seen[v] {
			seen[v] = true
			out = append(out, v)
		}
	}
	for i := range out {
		for j := i + 1; j < len(out); j++ {
			if out[j] < out[i] {
				out[i], out[j] = out[j], out[i]
			}
		}
	}
	return out
}

func parseDay(s string) (time.Time, bool) {
	t, err := time.Parse("2006-01-02", s)
	return t, err == nil
}

// whenText describes the due date relative to today for the reminder email.
func whenText(daysUntilDue int) string {
	switch {
	case daysUntilDue > 1:
		return fmt.Sprintf("is due in %d days", daysUntilDue)
	case daysUntilDue == 1:
		return "is due tomorrow"
	case daysUntilDue == 0:
		return "is due today"
	case daysUntilDue == -1:
		return "is 1 day overdue"
	}
	return fmt.Sprintf("is %d days overdue", -daysUntilDue)
}

// WhenText is the {{when}} phrase for a document's due date, for reminders sent by hand.
func (s *Service) WhenText(d model.Document) string {
	today, _ := parseDay(s.Store.Today())
	due, ok := parseDay(d.DueOn)
	if !ok {
		return "is outstanding"
	}
	return whenText(int(due.Sub(today).Hours() / 24))
}

// RunReminders sends every reminder that is due today. Each (invoice, day) pair is sent once.
func (s *Service) RunReminders(ctx context.Context) (sent int, err error) {
	cfg, err := s.Load(ctx)
	if err != nil || !cfg.RemindersEnabled {
		return 0, err
	}
	mc, err := s.Mail.Load(ctx)
	if err != nil || !mc.Enabled {
		return 0, err
	}
	if s.BaseURL(ctx) == "" {
		return 0, nil // no public address: a reminder would carry a link that goes nowhere
	}
	today, _ := parseDay(s.Store.Today())
	rows, err := s.DB.QueryContext(ctx, `SELECT id, due_on FROM documents WHERE kind = 'invoice' AND status IN ('unpaid', 'partial') AND due_on <> ''`)
	if err != nil {
		return 0, err
	}
	type cand struct {
		id   int64
		days int
	}
	var todo []cand
	for rows.Next() {
		var id int64
		var due string
		if rows.Scan(&id, &due) != nil {
			continue
		}
		dd, ok := parseDay(due)
		if !ok {
			continue
		}
		days := int(dd.Sub(today).Hours() / 24) // positive: not yet due
		if matches(cfg, days) {
			todo = append(todo, cand{id, days})
		}
	}
	rows.Close()
	ctx = activity.WithSource(ctx, activity.SourceSystem, "reminders")
	for _, c := range todo {
		doc, err := s.Store.GetDocument(ctx, s.DB, c.id)
		if err != nil {
			continue
		}
		party, err := store.Parties.Get(ctx, s.DB, doc.CustomerID)
		if err != nil || party.NoReminders || strings.TrimSpace(party.Email) == "" {
			continue
		}
		key := fmt.Sprintf("rem:%d:%d", c.id, c.days)
		var n int
		_ = s.DB.QueryRowContext(ctx, `SELECT COUNT(*) FROM mail_log WHERE reminder_key = ?`, key).Scan(&n)
		if n > 0 {
			continue
		}
		if _, err := s.Mail.SendDocument(ctx, mailer.Request{DocumentID: c.id, Kind: "reminder", To: party.Email, BaseURL: s.BaseURL(ctx), ReminderKey: key, When: whenText(c.days)}); err == nil {
			sent++
		}
	}
	return sent, nil
}

func matches(cfg Config, days int) bool {
	if days == 0 {
		return cfg.RemindOnDue
	}
	list := cfg.RemindBefore
	d := days
	if days < 0 {
		list, d = cfg.RemindAfter, -days
	}
	for _, v := range list {
		if v == d {
			return true
		}
	}
	return false
}

// OnQuoteAccepted applies the rule "when a quote is accepted, draft an invoice".
// It returns the new invoice, or nil when the rule is off or one already exists.
func (s *Service) OnQuoteAccepted(ctx context.Context, quoteID int64) (*model.Document, error) {
	cfg, err := s.Load(ctx)
	if err != nil || !cfg.QuoteAcceptedMakesInvoice {
		return nil, err
	}
	inv, err := s.Store.Convert(ctx, quoteID)
	var v store.Validation
	if errors.As(err, &v) { // already converted: nothing to do
		return nil, nil
	}
	if err != nil {
		return nil, err
	}
	s.Hub.Record(ctx, activity.Event{Action: "created", Entity: "invoice", EntityID: inv.ID, Label: inv.FullNumber,
		Detail: "drafted automatically from an accepted quote", Name: "invoice.created", Data: activity.DocData(inv)})
	return &inv, nil
}

// Overdue lists unpaid invoices past their due date, oldest first.
type OverdueItem struct {
	ID           int64  `json:"id"`
	Number       string `json:"number"`
	Customer     string `json:"customer"`
	DueOn        string `json:"dueOn"`
	DaysOverdue  int    `json:"daysOverdue"`
	BalanceCents int64  `json:"balanceCents"`
	Currency     string `json:"currency"`
}

// Overdue returns the unpaid invoices whose due date has passed.
func (s *Service) Overdue(ctx context.Context) ([]OverdueItem, error) {
	items, _, err := s.Store.ListDocuments(ctx, store.Filter{Kind: model.KindInvoice, To: "", Limit: 1000})
	if err != nil {
		return nil, err
	}
	today, _ := parseDay(s.Store.Today())
	out := []OverdueItem{}
	for _, it := range items {
		if (it.Status != model.StatusUnpaid && it.Status != model.StatusPartial) || it.DueOn == "" {
			continue
		}
		due, ok := parseDay(it.DueOn)
		if !ok || !due.Before(today) {
			continue
		}
		out = append(out, OverdueItem{it.ID, it.FullNumber, it.CustomerName, it.DueOn, int(today.Sub(due).Hours() / 24),
			it.TotalCents - it.PaidCents, it.CurrencyCode})
	}
	for i := range out {
		for j := i + 1; j < len(out); j++ {
			if out[j].DaysOverdue > out[i].DaysOverdue {
				out[i], out[j] = out[j], out[i]
			}
		}
	}
	return out, nil
}

// Run checks reminders and recurring invoices now and then until ctx ends.
func (s *Service) Run(ctx context.Context, log func(msg string, args ...any)) {
	tick := time.NewTicker(5 * time.Minute)
	defer tick.Stop()
	for {
		if n, err := s.RunReminders(ctx); err != nil {
			log("reminders failed", "error", err)
		} else if n > 0 {
			log("reminders sent", "count", n)
		}
		if n, err := s.RunRecurring(ctx); err != nil {
			log("recurring invoices failed", "error", err)
		} else if n > 0 {
			log("recurring invoices issued", "count", n)
		}
		select {
		case <-ctx.Done():
			return
		case <-tick.C:
		}
	}
}
