package collections

import (
	"context"
	"sort"
	"time"

	"github.com/Raktim94/mavri/server/internal/model"
	"github.com/Raktim94/mavri/server/internal/store"
)

// Bucket is how long an amount has been overdue.
type Bucket struct {
	Label string `json:"label"`
	Cents int64  `json:"cents"`
	Count int    `json:"count"`
}

// Ageing is what a customer owes in one currency, by how late it is.
type Ageing struct {
	Currency string   `json:"currency"`
	Decimals int      `json:"decimals"`
	Owed     int64    `json:"owedCents"`
	Buckets  []Bucket `json:"buckets"`
}

// CustomerView is a customer's money at a glance.
type CustomerView struct {
	CustomerID   int64            `json:"customerId"`
	Invoices     int              `json:"invoices"`
	BilledEver   map[string]int64 `json:"billedCents"`
	Ageing       []Ageing         `json:"ageing"`
	LastInvoice  string           `json:"lastInvoiceOn"`
	LastPayment  string           `json:"lastPaymentOn"`
	LastContact  string           `json:"lastContactAt"` // the last email sent about one of their invoices, or a note recorded
	OpenFollowUp []FollowUp       `json:"openFollowUps"`
}

var bucketLabels = []string{"Not yet due", "1–30 days late", "31–60 days late", "61–90 days late", "Over 90 days late"}

func bucketOf(daysLate int) int {
	switch {
	case daysLate <= 0:
		return 0
	case daysLate <= 30:
		return 1
	case daysLate <= 60:
		return 2
	case daysLate <= 90:
		return 3
	}
	return 4
}

// Customer builds the view of one customer: what they owe by lateness, per currency, and when you last dealt with them.
func (s *Service) Customer(ctx context.Context, id int64) (CustomerView, error) {
	v := CustomerView{CustomerID: id, BilledEver: map[string]int64{}, Ageing: []Ageing{}, OpenFollowUp: []FollowUp{}}
	sums, _, err := s.Store.ListDocuments(ctx, store.Filter{Kind: model.KindInvoice, CustomerID: id})
	if err != nil {
		return v, err
	}
	today, _ := time.Parse("2006-01-02", s.Store.Today())
	by := map[string]*Ageing{}
	ids := []int64{}
	for _, d := range sums {
		if d.Status == model.StatusDraft || d.Status == model.StatusVoid {
			continue
		}
		ids = append(ids, d.ID)
		v.Invoices++
		if d.DocType == "credit" {
			v.BilledEver[d.CurrencyCode] -= d.TotalCents
		} else {
			v.BilledEver[d.CurrencyCode] += d.TotalCents
		}
		if d.IssuedOn > v.LastInvoice && d.DocType != "credit" {
			v.LastInvoice = d.IssuedOn
		}
		if d.Status != model.StatusUnpaid && d.Status != model.StatusPartial {
			continue
		}
		bal := d.TotalCents - d.PaidCents
		if bal <= 0 {
			continue
		}
		a := by[d.CurrencyCode]
		if a == nil {
			a = &Ageing{Currency: d.CurrencyCode, Decimals: d.CurrencyScale}
			for _, l := range bucketLabels {
				a.Buckets = append(a.Buckets, Bucket{Label: l})
			}
			by[d.CurrencyCode] = a
		}
		late := 0
		if due, err := time.Parse("2006-01-02", d.DueOn); err == nil {
			late = int(today.Sub(due).Hours() / 24)
		}
		b := bucketOf(late)
		a.Buckets[b].Cents += bal
		a.Buckets[b].Count++
		a.Owed += bal
	}
	for _, a := range by {
		v.Ageing = append(v.Ageing, *a)
	}
	sort.Slice(v.Ageing, func(i, j int) bool { return v.Ageing[i].Currency < v.Ageing[j].Currency })
	for _, id := range ids {
		var on, at string
		_ = s.DB.QueryRowContext(ctx, `SELECT COALESCE(MAX(paid_on), '') FROM payments WHERE document_id = ? AND kind = 'payment'`, id).Scan(&on)
		if on > v.LastPayment {
			v.LastPayment = on
		}
		_ = s.DB.QueryRowContext(ctx, `SELECT COALESCE(MAX(created_at), '') FROM mail_log WHERE document_id = ? AND status = 'sent' AND kind <> 'escalation'`, id).Scan(&at)
		if at > v.LastContact {
			v.LastContact = at
		}
		var fat string
		_ = s.DB.QueryRowContext(ctx, `SELECT COALESCE(MAX(created_at), '') FROM follow_ups WHERE document_id = ?`, id).Scan(&fat)
		if fat > v.LastContact {
			v.LastContact = fat
		}
		open, err := s.query(ctx, `WHERE document_id = ? AND status = 'open'`, id)
		if err != nil {
			return v, err
		}
		v.OpenFollowUp = append(v.OpenFollowUp, open...)
	}
	return v, nil
}
