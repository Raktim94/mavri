// Package collections helps get invoices paid: it records what was agreed with
// a client (a promise to pay, a dispute, a pause on reminders) and builds the
// daily "needs attention" list. It never sends anything and never charges fees.
package collections

import (
	"context"
	"database/sql"
	"errors"
	"fmt"
	"sort"
	"strings"
	"time"

	"github.com/Raktim94/mavri/server/internal/activity"
	"github.com/Raktim94/mavri/server/internal/model"
	"github.com/Raktim94/mavri/server/internal/store"
)

// ErrInvalid is a problem with what the caller sent.
var ErrInvalid = errors.New("invalid")

// ErrNotFound means the invoice or follow-up does not exist.
var ErrNotFound = errors.New("not found")

// Kinds of follow-up.
const (
	Promise = "promise" // the client said they will pay by DueOn
	Dispute = "dispute" // the client questions the invoice
	Snooze  = "snooze"  // no reminders until DueOn
	Note    = "note"    // anything else worth remembering
)

// FollowUp is one entry in an invoice's collections history.
type FollowUp struct {
	ID          int64  `json:"id"`
	DocumentID  int64  `json:"documentId"`
	Kind        string `json:"kind"`
	DueOn       string `json:"dueOn"`
	AmountCents int64  `json:"amountCents"`
	Note        string `json:"note"`
	Source      string `json:"source"`
	Status      string `json:"status"`
	CreatedAt   string `json:"createdAt"`
	ResolvedAt  string `json:"resolvedAt"`
}

// Input is what a caller supplies for a new follow-up.
type Input struct {
	Kind        string `json:"kind"`
	DueOn       string `json:"dueOn"`
	AmountCents int64  `json:"amountCents"`
	Note        string `json:"note"`
}

// Service reads and writes follow-ups.
type Service struct {
	DB    *sql.DB
	Store *store.Store
	Hub   *activity.Hub
}

func invalid(format string, a ...any) error { return fmt.Errorf("%w: %s", ErrInvalid, fmt.Sprintf(format, a...)) }

func validDay(s string) bool {
	_, err := time.Parse("2006-01-02", s)
	return err == nil
}

// Add records a follow-up on an invoice.
func (s *Service) Add(ctx context.Context, docID int64, in Input) (FollowUp, error) {
	doc, err := s.Store.GetDocument(ctx, s.DB, docID)
	if err != nil {
		return FollowUp{}, ErrNotFound
	}
	if doc.Kind != model.KindInvoice {
		return FollowUp{}, invalid("only invoices have follow-ups")
	}
	in.Note = strings.TrimSpace(in.Note)
	if len(in.Note) > 1000 {
		in.Note = in.Note[:1000]
	}
	today := s.Store.Today()
	switch in.Kind {
	case Promise, Snooze:
		if !validDay(in.DueOn) {
			return FollowUp{}, invalid("choose a date")
		}
		if in.DueOn < today {
			return FollowUp{}, invalid("the date cannot be in the past")
		}
		if in.Kind == Snooze && in.DueOn > addDays(today, 90) {
			return FollowUp{}, invalid("a pause can last at most 90 days")
		}
		if in.Kind == Snooze {
			in.AmountCents = 0
		}
	case Dispute, Note:
		in.DueOn = ""
		in.AmountCents = 0
		if in.Note == "" {
			return FollowUp{}, invalid("write what was said")
		}
	default:
		return FollowUp{}, invalid("kind must be promise, dispute, snooze or note")
	}
	if in.AmountCents < 0 {
		return FollowUp{}, invalid("the amount cannot be negative")
	}
	source, _ := activity.From(ctx)
	now := s.now()
	res, err := s.DB.ExecContext(ctx, `INSERT INTO follow_ups (document_id, kind, due_on, amount_cents, note, source, status, created_at)
		VALUES (?, ?, ?, ?, ?, ?, 'open', ?)`, docID, in.Kind, in.DueOn, in.AmountCents, in.Note, source, now)
	if err != nil {
		return FollowUp{}, err
	}
	id, _ := res.LastInsertId()
	f := FollowUp{ID: id, DocumentID: docID, Kind: in.Kind, DueOn: in.DueOn, AmountCents: in.AmountCents, Note: in.Note, Source: source, Status: "open", CreatedAt: now}
	s.record(ctx, doc, f, "added")
	return f, nil
}

// Resolve closes a follow-up (the dispute was settled, the pause is over).
func (s *Service) Resolve(ctx context.Context, id int64) (FollowUp, error) {
	f, err := s.get(ctx, id)
	if err != nil {
		return f, err
	}
	if f.Status == "resolved" {
		return f, nil
	}
	f.Status, f.ResolvedAt = "resolved", s.now()
	if _, err := s.DB.ExecContext(ctx, `UPDATE follow_ups SET status = 'resolved', resolved_at = ? WHERE id = ?`, f.ResolvedAt, id); err != nil {
		return f, err
	}
	if doc, err := s.Store.GetDocument(ctx, s.DB, f.DocumentID); err == nil {
		s.record(ctx, doc, f, "resolved")
	}
	return f, nil
}

func (s *Service) get(ctx context.Context, id int64) (FollowUp, error) {
	rows, err := s.query(ctx, `WHERE id = ?`, id)
	if err != nil {
		return FollowUp{}, err
	}
	if len(rows) == 0 {
		return FollowUp{}, ErrNotFound
	}
	return rows[0], nil
}

// List returns an invoice's follow-ups, newest first.
func (s *Service) List(ctx context.Context, docID int64) ([]FollowUp, error) {
	return s.query(ctx, `WHERE document_id = ?`, docID)
}

func (s *Service) query(ctx context.Context, where string, args ...any) ([]FollowUp, error) {
	rows, err := s.DB.QueryContext(ctx, `SELECT id, document_id, kind, due_on, amount_cents, note, source, status, created_at, resolved_at
		FROM follow_ups `+where+` ORDER BY id DESC`, args...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	out := []FollowUp{}
	for rows.Next() {
		var f FollowUp
		if err := rows.Scan(&f.ID, &f.DocumentID, &f.Kind, &f.DueOn, &f.AmountCents, &f.Note, &f.Source, &f.Status, &f.CreatedAt, &f.ResolvedAt); err != nil {
			return nil, err
		}
		out = append(out, f)
	}
	return out, rows.Err()
}

func (s *Service) now() string { return time.Now().UTC().Format("2006-01-02T15:04:05Z") }

func addDays(day string, n int) string {
	t, _ := time.Parse("2006-01-02", day)
	return t.AddDate(0, 0, n).Format("2006-01-02")
}

func (s *Service) record(ctx context.Context, doc model.Document, f FollowUp, what string) {
	if s.Hub == nil {
		return
	}
	e := activity.Event{Action: f.Kind + " " + what, Entity: "invoice", EntityID: doc.ID, Label: doc.FullNumber}
	data := activity.DocData(doc)
	data["followUp"] = map[string]any{"id": f.ID, "kind": f.Kind, "dueOn": f.DueOn, "amountCents": f.AmountCents, "note": f.Note, "source": f.Source}
	switch {
	case f.Kind == Promise && what == "added":
		e.Detail = "promise to pay by " + f.DueOn
		e.Name, e.Data = "payment.promised", data
	case f.Kind == Dispute && what == "added":
		e.Detail = f.Note
		e.Name, e.Data = "dispute.opened", data
	case f.Kind == Dispute && what == "resolved":
		e.Detail = "dispute settled"
		e.Name, e.Data = "dispute.resolved", data
	case f.Kind == Snooze && what == "added":
		e.Detail = "reminders paused until " + f.DueOn
	default:
		e.Detail = f.Note
	}
	s.Hub.Record(ctx, e)
}

// Reason an invoice needs attention, most urgent first.
const (
	ReasonDisputed       = "disputed"
	ReasonBrokenPromise  = "broken_promise"
	ReasonDeliveryFailed = "delivery_failed"
	ReasonOverdue        = "overdue"
	ReasonDueSoon        = "due_soon"
	ReasonPartial        = "partial"
	ReasonPromised       = "promised"
)

var rank = map[string]int{ReasonDisputed: 0, ReasonBrokenPromise: 1, ReasonDeliveryFailed: 2, ReasonOverdue: 3, ReasonDueSoon: 4, ReasonPartial: 5, ReasonPromised: 6}

// Item is one invoice on the list.
type Item struct {
	ID           int64  `json:"id"`
	Number       string `json:"number"`
	Customer     string `json:"customer"`
	DueOn        string `json:"dueOn"`
	DaysOverdue  int    `json:"daysOverdue"` // negative: days until due
	BalanceCents int64  `json:"balanceCents"`
	Currency     string `json:"currency"`
	Reason       string `json:"reason"`
	Detail       string `json:"detail"`
	Action       string `json:"action"`
	PromisedOn   string `json:"promisedOn,omitempty"`
	FollowUpID   int64  `json:"followUpId,omitempty"`
}

// Attention is the daily list.
type Attention struct {
	Items   []Item         `json:"items"`
	Counts  map[string]int `json:"counts"`
	Snoozed int            `json:"snoozed"` // invoices left off the list while reminders are paused
}

// DueSoonDays is how far ahead "due soon" looks.
const DueSoonDays = 7

// Attention builds today's list of unpaid invoices that need a person.
func (s *Service) Attention(ctx context.Context) (Attention, error) {
	out := Attention{Items: []Item{}, Counts: map[string]int{}}
	sums, _, err := s.Store.ListDocuments(ctx, store.Filter{Kind: model.KindInvoice, Limit: 5000})
	if err != nil {
		return out, err
	}
	open, err := s.query(ctx, `WHERE status = 'open'`)
	if err != nil {
		return out, err
	}
	byDoc := map[int64][]FollowUp{}
	for _, f := range open {
		byDoc[f.DocumentID] = append(byDoc[f.DocumentID], f)
	}
	failed, err := s.failedMail(ctx)
	if err != nil {
		return out, err
	}
	today := s.Store.Today()
	t0, _ := time.Parse("2006-01-02", today)
	for _, d := range sums {
		if d.Status != model.StatusUnpaid && d.Status != model.StatusPartial {
			continue
		}
		bal := d.TotalCents - d.PaidCents
		if bal <= 0 {
			continue
		}
		it := Item{ID: d.ID, Number: d.FullNumber, Customer: d.CustomerName, DueOn: d.DueOn, BalanceCents: bal, Currency: d.CurrencyCode}
		if due, err := time.Parse("2006-01-02", d.DueOn); err == nil {
			it.DaysOverdue = int(t0.Sub(due).Hours() / 24)
		} else {
			it.DaysOverdue = -9999
		}
		var dispute, promise, snooze *FollowUp
		for i := range byDoc[d.ID] {
			f := &byDoc[d.ID][i]
			switch {
			case f.Kind == Dispute && dispute == nil:
				dispute = f
			case f.Kind == Promise && promise == nil:
				promise = f
			case f.Kind == Snooze && f.DueOn >= today && snooze == nil:
				snooze = f
			}
		}
		switch {
		case dispute != nil:
			it.Reason, it.Detail, it.Action, it.FollowUpID = ReasonDisputed, dispute.Note, "Review the dispute and reply to the client", dispute.ID
		case promise != nil && promise.DueOn < today:
			it.Reason, it.PromisedOn, it.FollowUpID = ReasonBrokenPromise, promise.DueOn, promise.ID
			it.Detail, it.Action = "Promised payment by "+promise.DueOn+" and it has not arrived", "Contact the client"
		case snooze != nil:
			out.Snoozed++
			continue
		case promise != nil:
			it.Reason, it.PromisedOn, it.FollowUpID = ReasonPromised, promise.DueOn, promise.ID
			it.Detail, it.Action = "Client promised to pay by "+promise.DueOn, "Wait, then check on "+promise.DueOn
		case failed[d.ID] != "":
			it.Reason, it.Detail, it.Action = ReasonDeliveryFailed, "The last email did not go through: "+failed[d.ID], "Fix the address or send it another way"
		case it.DaysOverdue > 0:
			it.Reason, it.Action = ReasonOverdue, "Send a reminder"
			it.Detail = fmt.Sprintf("%d day%s overdue", it.DaysOverdue, plural(it.DaysOverdue))
		case it.DaysOverdue > -9999 && -it.DaysOverdue <= DueSoonDays:
			it.Reason, it.Action = ReasonDueSoon, "Nothing yet; a reminder may help"
			it.Detail = "Due in " + fmt.Sprint(-it.DaysOverdue) + " day" + plural(-it.DaysOverdue)
			if it.DaysOverdue == 0 {
				it.Detail = "Due today"
			}
		case d.Status == model.StatusPartial:
			it.Reason, it.Action, it.Detail = ReasonPartial, "Ask for the remaining balance", "Part paid"
		default:
			continue
		}
		out.Counts[it.Reason]++
		out.Items = append(out.Items, it)
	}
	sort.SliceStable(out.Items, func(i, j int) bool {
		a, b := out.Items[i], out.Items[j]
		if rank[a.Reason] != rank[b.Reason] {
			return rank[a.Reason] < rank[b.Reason]
		}
		return a.DaysOverdue > b.DaysOverdue
	})
	return out, nil
}

func plural(n int) string {
	if n == 1 {
		return ""
	}
	return "s"
}

// failedMail maps a document to the error of its latest email when that email failed.
func (s *Service) failedMail(ctx context.Context) (map[int64]string, error) {
	rows, err := s.DB.QueryContext(ctx, `SELECT m.document_id, m.error FROM mail_log m
		WHERE m.status = 'failed' AND m.document_id IS NOT NULL
		AND m.id = (SELECT MAX(id) FROM mail_log WHERE document_id = m.document_id)`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	out := map[int64]string{}
	for rows.Next() {
		var id int64
		var e string
		if rows.Scan(&id, &e) == nil {
			if e == "" {
				e = "unknown error"
			}
			out[id] = e
		}
	}
	return out, rows.Err()
}
