package invoices

import (
	"context"
	"encoding/json"
	"math"
	"strconv"
	"strings"
	"time"

	"github.com/Raktim94/nodedr-invoice/rewrite/internal/einvoice"
	"github.com/Raktim94/nodedr-invoice/rewrite/internal/entity"
)

// Query is the search of the public API.
type Query struct {
	Type, Status, Search, From, To string
	ClientID, Limit, Offset        *float64
}

const maxLimit = 200

// parseDate is JavaScript's Date.parse for the formats invoices use: a date
// alone is UTC, a date and time without a zone is local time. NaN when unreadable.
func parseDate(v string) float64 {
	v = strings.TrimSpace(v)
	for _, layout := range []string{time.RFC3339Nano, "2006-01-02T15:04:05.999999999Z07:00"} {
		if t, err := time.Parse(layout, v); err == nil {
			return float64(t.UnixMilli())
		}
	}
	if t, err := time.Parse("2006-01-02", v); err == nil {
		return float64(t.UnixMilli())
	}
	for _, layout := range []string{"2006-01-02T15:04:05.999999999", "2006-01-02 15:04:05.999999999", "2006-01-02T15:04", "2006-01-02 15:04"} {
		if t, err := time.ParseInLocation(layout, v, time.Local); err == nil {
			return float64(t.UnixMilli())
		}
	}
	return math.NaN()
}

func summarize(inv Row) Row {
	out := Row{"id": inv["id"], "invoiceType": inv["invoiceType"], "invoiceNumber": inv["invoiceNumber"], "status": inv["status"],
		"issuedAt": inv["issuedAt"], "dueDate": inv["dueDate"], "clientId": inv["clientId"], "businessId": inv["businessId"],
		"taxRate": inv["taxRate"], "discountPercent": inv["discountPercent"]}
	if c := child(inv, "invoiceClientSnapshot"); c != nil {
		out["clientName"] = c["clientName"]
	}
	if c := child(inv, "invoiceCurrencySnapshot"); c != nil {
		out["currencyCode"] = c["currencyCode"]
	}
	out["itemCount"] = len(children(inv, "invoiceItems"))
	var paid float64
	for _, p := range children(inv, "invoicePayments") {
		switch v := p["amountCents"].(type) {
		case string:
			if f, err := strconv.ParseFloat(strings.TrimSpace(v), 64); err == nil {
				paid += f
			}
		case int64:
			paid += float64(v)
		case float64:
			paid += v
		}
	}
	out["totalPaidCents"] = jsNumber(paid)
	return out
}

func jsNumber(f float64) any {
	if f == math.Trunc(f) && math.Abs(f) < 1e15 {
		return int64(f)
	}
	return f
}

// Find searches invoices for the public API and returns one page of summaries.
func (s *Service) Find(ctx context.Context, q Query) (Row, error) {
	if err := s.Repo.Warm(ctx, allTables...); err != nil {
		return nil, err
	}
	o := readOptions{Type: q.Type}
	if q.Status != "" {
		o.Filters = append(o.Filters, entity.Filter{Type: "Status", Value: q.Status})
	}
	if q.ClientID != nil {
		id := int64(*q.ClientID)
		o.ClientID = &id
	}
	all, err := s.read(ctx, s.Repo.DB, o)
	if err != nil {
		return nil, err
	}
	needle := strings.ToLower(strings.TrimSpace(q.Search))
	var from, to *float64
	if q.From != "" {
		f := parseDate(q.From)
		from = &f
	}
	if q.To != "" {
		t := parseDate(q.To)
		to = &t
	}
	matched := []Row{}
	for _, inv := range all {
		if needle != "" {
			hay := asString(inv["invoiceNumber"])
			if c := child(inv, "invoiceClientSnapshot"); c != nil {
				hay += " " + asString(c["clientName"])
			} else {
				hay += " "
			}
			if !strings.Contains(strings.ToLower(hay), needle) {
				continue
			}
		}
		issued := math.NaN()
		if v := asString(inv["issuedAt"]); v != "" {
			issued = parseDate(v)
		}
		if from != nil && !(issued >= *from) {
			continue
		}
		if to != nil && !(issued <= *to) {
			continue
		}
		matched = append(matched, inv)
	}
	limit := int64(50)
	if q.Limit != nil {
		limit = int64(math.Trunc(*q.Limit))
	}
	if limit < 1 {
		limit = 1
	}
	if limit > maxLimit {
		limit = maxLimit
	}
	offset := int64(0)
	if q.Offset != nil {
		offset = int64(math.Trunc(*q.Offset))
	}
	if offset < 0 {
		offset = 0
	}
	items := []Row{}
	for i := offset; i < int64(len(matched)) && i < offset+limit; i++ {
		items = append(items, summarize(matched[i]))
	}
	return Row{"total": len(matched), "limit": limit, "offset": offset, "items": items}, nil
}

// ByID returns one invoice with everything attached, nil when there is none.
func (s *Service) ByID(ctx context.Context, id int64) (Row, error) {
	if id == 0 {
		return nil, nil
	}
	if err := s.Repo.Warm(ctx, allTables...); err != nil {
		return nil, err
	}
	got, err := s.read(ctx, s.Repo.DB, readOptions{ID: &id})
	if err != nil || len(got) == 0 {
		return nil, err
	}
	return got[0], nil
}

// XML builds the e-invoice XML of one invoice for a profile ("ubl21" or "xrechnung").
func (s *Service) XML(ctx context.Context, id int64, profile string) (string, error) {
	inv, err := s.ByID(ctx, id)
	if err != nil {
		return "", err
	}
	if inv == nil {
		return "", &einvoice.Error{Message: "error.invoiceNotFound"}
	}
	return einvoice.Generate(profile, inv)
}

// ToRequest turns an invoice read from the database back into the shape a
// save accepts: parsed JSON columns become raw JSON again. Used when an
// existing invoice is changed in place (status, payments).
func ToRequest(row Row) Row {
	out := make(Row, len(row))
	for k, v := range row {
		out[k] = requestValue(v)
	}
	return out
}

func requestValue(v any) any {
	switch x := v.(type) {
	case json.RawMessage:
		return entity.RawJSON(x)
	case Row:
		return ToRequest(x)
	case []Row:
		out := make([]Row, len(x))
		for i, r := range x {
			out[i] = ToRequest(r)
		}
		return out
	}
	return v
}
