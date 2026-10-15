package automation

import (
	"context"
	"database/sql"
	"errors"
	"fmt"
	"time"

	"github.com/Raktim94/mavri/server/internal/activity"
	"github.com/Raktim94/mavri/server/internal/mailer"
	"github.com/Raktim94/mavri/server/internal/model"
	"github.com/Raktim94/mavri/server/internal/store"
)

// Schedule repeats a stored invoice.
type Schedule struct {
	ID           int64  `json:"id"`
	DocumentID   int64  `json:"documentId"`
	Every        string `json:"every"` // week, month, quarter, year
	Interval     int    `json:"interval"`
	StartOn      string `json:"startOn"`
	NextOn       string `json:"nextOn"`
	EndOn        string `json:"endOn"`
	Active       bool   `json:"active"`
	AutoSend     bool   `json:"autoSend"`
	LastIssuedOn string `json:"lastIssuedOn"`
	IssuedCount  int    `json:"issuedCount"`
	// Shown in lists.
	Number     string `json:"number,omitempty"`
	Customer   string `json:"customer,omitempty"`
	TotalCents int64  `json:"totalCents,omitempty"`
	Currency   string `json:"currency,omitempty"`
}

// Occurrence is the date of the k-th invoice (0 is the first).
func occurrence(startOn, every string, interval, k int) (time.Time, error) {
	t, err := time.Parse("2006-01-02", startOn)
	if err != nil {
		return t, err
	}
	n := k * interval
	switch every {
	case "week":
		return t.AddDate(0, 0, 7*n), nil
	case "month":
		return addMonths(t, n), nil
	case "quarter":
		return addMonths(t, 3*n), nil
	case "year":
		return addMonths(t, 12*n), nil
	}
	return t, fmt.Errorf("%w: unknown interval %q", ErrInvalid, every)
}

// addMonths keeps the day of the month, clamping to the month's last day (31 Jan + 1 month = 28/29 Feb).
func addMonths(t time.Time, n int) time.Time {
	first := time.Date(t.Year(), t.Month()+time.Month(n), 1, 0, 0, 0, 0, time.UTC)
	last := first.AddDate(0, 1, -1).Day()
	d := t.Day()
	if d > last {
		d = last
	}
	return time.Date(first.Year(), first.Month(), d, 0, 0, 0, 0, time.UTC)
}

const dayFmt = "2006-01-02"

func (s *Service) check(ctx context.Context, sc *Schedule) error {
	if sc.Interval < 1 || sc.Interval > 120 {
		return fmt.Errorf("%w: repeat every 1 to 120 periods", ErrInvalid)
	}
	if _, err := occurrence(sc.StartOn, sc.Every, sc.Interval, 0); err != nil {
		if errors.Is(err, ErrInvalid) {
			return err
		}
		return fmt.Errorf("%w: start date must look like 2026-11-01", ErrInvalid)
	}
	if sc.EndOn != "" {
		e, err := time.Parse(dayFmt, sc.EndOn)
		st, _ := time.Parse(dayFmt, sc.StartOn)
		if err != nil || e.Before(st) {
			return fmt.Errorf("%w: the end date must be on or after the start date", ErrInvalid)
		}
	}
	d, err := s.Store.GetDocument(ctx, s.DB, sc.DocumentID)
	if err != nil {
		return err
	}
	if d.Kind != model.KindInvoice {
		return fmt.Errorf("%w: only invoices can repeat", ErrInvalid)
	}
	return nil
}

// Create starts a schedule from an existing invoice. The first invoice is issued on StartOn.
func (s *Service) Create(ctx context.Context, sc Schedule) (Schedule, error) {
	if sc.Interval == 0 {
		sc.Interval = 1
	}
	if err := s.check(ctx, &sc); err != nil {
		return sc, err
	}
	sc.NextOn = sc.StartOn
	res, err := s.DB.ExecContext(ctx, `INSERT INTO recurring (document_id, every, interval_n, start_on, next_on, end_on, active, auto_send, created_at)
		VALUES (?, ?, ?, ?, ?, ?, 1, ?, ?)`, sc.DocumentID, sc.Every, sc.Interval, sc.StartOn, sc.NextOn, sc.EndOn, b2i(sc.AutoSend), time.Now().UTC().Format(time.RFC3339))
	if err != nil {
		return sc, err
	}
	sc.ID, _ = res.LastInsertId()
	sc.Active = true
	return sc, nil
}

// Update changes the pause switch, end date or auto-send of a schedule.
func (s *Service) Update(ctx context.Context, id int64, active bool, endOn string, autoSend bool) error {
	if endOn != "" {
		if _, err := time.Parse(dayFmt, endOn); err != nil {
			return fmt.Errorf("%w: the end date must look like 2026-11-01", ErrInvalid)
		}
	}
	res, err := s.DB.ExecContext(ctx, `UPDATE recurring SET active = ?, end_on = ?, auto_send = ? WHERE id = ?`, b2i(active), endOn, b2i(autoSend), id)
	if err != nil {
		return err
	}
	if n, _ := res.RowsAffected(); n == 0 {
		return sql.ErrNoRows
	}
	return nil
}

// Delete removes a schedule; invoices it already issued stay.
func (s *Service) Delete(ctx context.Context, id int64) error {
	res, err := s.DB.ExecContext(ctx, `DELETE FROM recurring WHERE id = ?`, id)
	if err != nil {
		return err
	}
	if n, _ := res.RowsAffected(); n == 0 {
		return sql.ErrNoRows
	}
	return nil
}

func b2i(b bool) int {
	if b {
		return 1
	}
	return 0
}

// List returns every schedule with the template invoice's details.
func (s *Service) List(ctx context.Context) ([]Schedule, error) {
	rows, err := s.DB.QueryContext(ctx, `SELECT r.id, r.document_id, r.every, r.interval_n, r.start_on, r.next_on, r.end_on, r.active, r.auto_send,
		r.last_issued_on, r.issued_count FROM recurring r ORDER BY r.id`)
	if err != nil {
		return nil, err
	}
	var out []Schedule
	for rows.Next() {
		var sc Schedule
		var act, auto int
		if err := rows.Scan(&sc.ID, &sc.DocumentID, &sc.Every, &sc.Interval, &sc.StartOn, &sc.NextOn, &sc.EndOn, &act, &auto, &sc.LastIssuedOn, &sc.IssuedCount); err != nil {
			rows.Close()
			return nil, err
		}
		sc.Active, sc.AutoSend = act == 1, auto == 1
		out = append(out, sc)
	}
	rows.Close()
	for i := range out {
		if d, err := s.Store.GetDocument(ctx, s.DB, out[i].DocumentID); err == nil {
			out[i].Number, out[i].Customer, out[i].TotalCents, out[i].Currency = d.FullNumber, d.Customer.Name, d.Totals.TotalCents, d.Currency.Code
		}
	}
	if out == nil {
		out = []Schedule{}
	}
	return out, rows.Err()
}

// Upcoming is one invoice a schedule will issue.
type Upcoming struct {
	IssuedOn string `json:"issuedOn"`
	DueOn    string `json:"dueOn"`
}

// Preview lists the next invoices a schedule will issue, and the invoice they copy.
type Preview struct {
	Schedule Schedule   `json:"schedule"`
	Upcoming []Upcoming `json:"upcoming"`
	Template struct {
		Number     string `json:"number"`
		Customer   string `json:"customer"`
		TotalCents int64  `json:"totalCents"`
		Currency   string `json:"currency"`
		Lines      int    `json:"lines"`
	} `json:"template"`
}

// Preview shows what the schedule will do next, before it does it.
func (s *Service) Preview(ctx context.Context, id int64, n int) (Preview, error) {
	var p Preview
	all, err := s.List(ctx)
	if err != nil {
		return p, err
	}
	var sc *Schedule
	for i := range all {
		if all[i].ID == id {
			sc = &all[i]
		}
	}
	if sc == nil {
		return p, sql.ErrNoRows
	}
	p.Schedule = *sc
	doc, err := s.Store.GetDocument(ctx, s.DB, sc.DocumentID)
	if err != nil {
		return p, err
	}
	p.Template.Number, p.Template.Customer, p.Template.TotalCents, p.Template.Currency, p.Template.Lines =
		doc.FullNumber, doc.Customer.Name, doc.Totals.TotalCents, doc.Currency.Code, len(doc.Lines)
	p.Upcoming = []Upcoming{}
	if n <= 0 || n > 24 {
		n = 6
	}
	for k := sc.IssuedCount; len(p.Upcoming) < n && k < sc.IssuedCount+500; k++ {
		t, err := occurrence(sc.StartOn, sc.Every, sc.Interval, k)
		if err != nil {
			break
		}
		if sc.EndOn != "" && t.Format(dayFmt) > sc.EndOn {
			break
		}
		p.Upcoming = append(p.Upcoming, Upcoming{t.Format(dayFmt), s.dueFor(doc, t)})
	}
	return p, nil
}

// PreviewDraft shows what a schedule would do before it is created.
func (s *Service) PreviewDraft(ctx context.Context, sc Schedule, n int) (Preview, error) {
	var p Preview
	if sc.Interval == 0 {
		sc.Interval = 1
	}
	if err := s.check(ctx, &sc); err != nil {
		return p, err
	}
	sc.NextOn, sc.Active = sc.StartOn, true
	p.Schedule = sc
	doc, err := s.Store.GetDocument(ctx, s.DB, sc.DocumentID)
	if err != nil {
		return p, err
	}
	p.Template.Number, p.Template.Customer, p.Template.TotalCents, p.Template.Currency, p.Template.Lines =
		doc.FullNumber, doc.Customer.Name, doc.Totals.TotalCents, doc.Currency.Code, len(doc.Lines)
	p.Upcoming = []Upcoming{}
	if n <= 0 || n > 24 {
		n = 6
	}
	for k := 0; len(p.Upcoming) < n && k < 500; k++ {
		t, err := occurrence(sc.StartOn, sc.Every, sc.Interval, k)
		if err != nil || (sc.EndOn != "" && t.Format(dayFmt) > sc.EndOn) {
			break
		}
		p.Upcoming = append(p.Upcoming, Upcoming{t.Format(dayFmt), s.dueFor(doc, t)})
	}
	return p, nil
}

// dueFor keeps the payment term of the template: the same number of days after the issue date.
func (s *Service) dueFor(tpl model.Document, issued time.Time) string {
	a, e1 := time.Parse(dayFmt, tpl.IssuedOn)
	b, e2 := time.Parse(dayFmt, tpl.DueOn)
	if e1 != nil || e2 != nil {
		return ""
	}
	return issued.Add(b.Sub(a)).Format(dayFmt)
}

// maxCatchUp bounds how many missed invoices one pass will issue after downtime.
const maxCatchUp = 12

// RunRecurring issues every invoice that is due today or earlier.
func (s *Service) RunRecurring(ctx context.Context) (issued int, err error) {
	today := s.Store.Today()
	list, err := s.List(ctx)
	if err != nil {
		return 0, err
	}
	ctx = activity.WithSource(ctx, activity.SourceSystem, "recurring")
	for _, sc := range list {
		if !sc.Active {
			continue
		}
		for i := 0; i < maxCatchUp; i++ {
			next, err := occurrence(sc.StartOn, sc.Every, sc.Interval, sc.IssuedCount)
			if err != nil {
				break
			}
			day := next.Format(dayFmt)
			if day > today || (sc.EndOn != "" && day > sc.EndOn) {
				break
			}
			inv, err := s.issue(ctx, sc, next)
			if err != nil {
				return issued, fmt.Errorf("recurring invoice %d: %w", sc.ID, err)
			}
			issued++
			sc.IssuedCount++
			nextDay := ""
			if n2, err := occurrence(sc.StartOn, sc.Every, sc.Interval, sc.IssuedCount); err == nil {
				nextDay = n2.Format(dayFmt)
			}
			active := nextDay != "" && (sc.EndOn == "" || nextDay <= sc.EndOn)
			if _, err := s.DB.ExecContext(ctx, `UPDATE recurring SET issued_count = ?, last_issued_on = ?, next_on = ?, active = ? WHERE id = ?`,
				sc.IssuedCount, day, nextDay, b2i(active), sc.ID); err != nil {
				return issued, err
			}
			if sc.AutoSend {
				_, _ = s.Mail.SendDocument(ctx, mailer.Request{DocumentID: inv.ID, BaseURL: s.BaseURL(ctx)})
			}
			if !active {
				break
			}
		}
	}
	return issued, nil
}

func (s *Service) issue(ctx context.Context, sc Schedule, on time.Time) (model.Document, error) {
	tpl, err := s.Store.GetDocument(ctx, s.DB, sc.DocumentID)
	if err != nil {
		return model.Document{}, err
	}
	nd := tpl
	nd.ID, nd.Number, nd.Payments, nd.Attachments, nd.ConvertedFrom, nd.Status = 0, "", nil, nil, nil, ""
	nd.IssuedOn = on.Format(dayFmt)
	nd.DueOn = s.dueFor(tpl, on)
	inv, err := s.Store.CreateDocument(ctx, nd, store.SaveOptions{RefreshDetails: true})
	if err != nil {
		return inv, err
	}
	s.Hub.Record(ctx, activity.Event{Action: "created", Entity: "invoice", EntityID: inv.ID, Label: inv.FullNumber,
		Detail: "issued by schedule #" + fmt.Sprint(sc.ID) + " (copy of " + tpl.FullNumber + ")", Name: "invoice.created", Data: activity.DocData(inv)})
	return inv, nil
}
