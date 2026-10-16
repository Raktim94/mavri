// Package reconcile matches money received, as listed on a bank statement, to unpaid invoices. It suggests; a person
// confirms. Nothing is recorded until the matches are applied, and a line that was already recorded is recognised and
// left alone, so the same statement can be checked twice.
package reconcile

import (
	"context"
	"crypto/sha256"
	"encoding/csv"
	"encoding/hex"
	"errors"
	"fmt"
	"io"
	"regexp"
	"strconv"
	"strings"
	"time"

	"github.com/Raktim94/mavri/server/internal/model"
	"github.com/Raktim94/mavri/server/internal/money"
	"github.com/Raktim94/mavri/server/internal/store"
)

// ErrInvalid is a file that cannot be read as a statement.
var ErrInvalid = errors.New("invalid statement")

// MaxRows bounds one statement.
const MaxRows = 5000

// Statuses of a statement line.
const (
	Matched     = "matched"   // one invoice fits: its number is in the text, or the amount and customer name fit
	Ambiguous   = "ambiguous" // more than one invoice could be meant
	Unmatched   = "unmatched" // no unpaid invoice fits
	Overpaid    = "overpaid"  // the invoice is found but the amount is more than is owed
	Duplicate   = "duplicate" // this line is already recorded as a payment
	NotReceived = "ignored"   // money going out, or a line without an amount
)

// Row is one line of the statement and what Mavri makes of it.
type Row struct {
	Line         int     `json:"line"`
	Date         string  `json:"date"`
	Description  string  `json:"description"`
	AmountCents  int64   `json:"amountCents"` // in the invoice's currency when matched; hundredths otherwise
	Status       string  `json:"status"`
	InvoiceID    int64   `json:"invoiceId,omitempty"`
	Number       string  `json:"number,omitempty"`
	Customer     string  `json:"customer,omitempty"`
	BalanceCents int64   `json:"balanceCents,omitempty"`
	Currency     string  `json:"currency,omitempty"`
	Reason       string  `json:"reason"`
	Candidates   []int64 `json:"candidates,omitempty"`
	Key          string  `json:"key"` // identifies the line, so it is only ever recorded once
}

// Report is the result of checking a statement.
type Report struct {
	Rows      []Row `json:"rows"`
	Matched   int   `json:"matched"`
	Needs     int   `json:"needsAttention"`
	Duplicate int   `json:"duplicate"`
}

var aliases = map[string]string{
	"date": "date", "value date": "date", "transaction date": "date", "txn date": "date", "posting date": "date", "booking date": "date",
	"description": "desc", "narration": "desc", "details": "desc", "reference": "desc", "memo": "desc", "particulars": "desc", "remarks": "desc", "transaction details": "desc", "payment reference": "desc",
	"amount": "amount", "credit": "credit", "credit amount": "credit", "deposit": "credit", "deposits": "credit", "received": "credit", "money in": "credit", "paid in": "credit",
	"debit": "debit", "debit amount": "debit", "withdrawal": "debit", "withdrawals": "debit", "money out": "debit", "paid out": "debit",
}

// parseAmount reads "1,234.50", "1.234,50", "₹ 1,000", "(500)" and "-500" into hundredths, with its sign.
func parseAmount(s string) (int64, bool) {
	s = strings.TrimSpace(s)
	if s == "" {
		return 0, false
	}
	neg := strings.HasPrefix(s, "-") || (strings.HasPrefix(s, "(") && strings.HasSuffix(s, ")")) || strings.HasSuffix(strings.ToUpper(s), "DR")
	var b strings.Builder
	for _, r := range s {
		if r >= '0' && r <= '9' || r == '.' || r == ',' {
			b.WriteRune(r)
		}
	}
	v := b.String()
	if v == "" {
		return 0, false
	}
	switch {
	case strings.Contains(v, ",") && strings.Contains(v, "."):
		if strings.LastIndex(v, ",") > strings.LastIndex(v, ".") {
			v = strings.ReplaceAll(strings.ReplaceAll(v, ".", ""), ",", ".")
		} else {
			v = strings.ReplaceAll(v, ",", "")
		}
	case strings.Contains(v, ","):
		parts := strings.Split(v, ",")
		if len(parts) == 2 && len(parts[1]) != 3 {
			v = parts[0] + "." + parts[1]
		} else {
			v = strings.ReplaceAll(v, ",", "")
		}
	}
	f, err := strconv.ParseFloat(v, 64)
	if err != nil {
		return 0, false
	}
	c := money.ToMinor(f, 2)
	if neg {
		c = -c
	}
	return c, true
}

func parseDay(s string) (string, bool) {
	s = strings.TrimSpace(s)
	for _, layout := range []string{"2006-01-02", "02/01/2006", "2/1/2006", "02-01-2006", "02.01.2006", "2006/01/02", "02 Jan 2006", "2 Jan 2006", "02-Jan-2006", "Jan 2, 2006", "2006-01-02T15:04:05Z07:00"} {
		if t, err := time.Parse(layout, s); err == nil {
			return t.Format("2006-01-02"), true
		}
	}
	return "", false
}

// Check reads a statement and suggests what each line of money received pays.
func Check(ctx context.Context, st *store.Store, r io.Reader) (Report, error) {
	rep := Report{Rows: []Row{}}
	raw, err := io.ReadAll(io.LimitReader(r, 8<<20))
	if err != nil {
		return rep, err
	}
	cr := csv.NewReader(strings.NewReader(strings.TrimPrefix(string(raw), "\ufeff")))
	cr.FieldsPerRecord = -1
	cr.LazyQuotes = true
	cr.TrimLeadingSpace = true
	cols := map[string]int{}
	var header bool
	type rec struct {
		line   int
		fields []string
	}
	var recs []rec
	line := 0
	for {
		f, err := cr.Read()
		if errors.Is(err, io.EOF) {
			break
		}
		if err != nil {
			return rep, fmt.Errorf("%w: %v", ErrInvalid, err)
		}
		line++
		if len(f) == 1 && strings.TrimSpace(f[0]) == "" {
			continue
		}
		if !header {
			for i, h := range f {
				if c, ok := aliases[strings.ToLower(strings.TrimSpace(h))]; ok {
					if _, dup := cols[c]; !dup {
						cols[c] = i
					}
				}
			}
			if _, ok := cols["date"]; !ok {
				continue // a bank's preamble lines come before the header: keep looking
			}
			if _, a := cols["amount"]; !a {
				if _, c := cols["credit"]; !c {
					continue
				}
			}
			header = true
			continue
		}
		if len(recs) >= MaxRows {
			return rep, fmt.Errorf("%w: at most %d lines per statement", ErrInvalid, MaxRows)
		}
		recs = append(recs, rec{line, f})
	}
	if !header {
		return rep, fmt.Errorf("%w: the file needs a header row with a date column and an amount (or credit) column", ErrInvalid)
	}
	get := func(f []string, c string) string {
		if i, ok := cols[c]; ok && i < len(f) {
			return strings.TrimSpace(f[i])
		}
		return ""
	}

	invs, _, err := st.ListDocuments(ctx, store.Filter{Kind: model.KindInvoice})
	if err != nil {
		return rep, err
	}
	var open []model.Summary
	for _, d := range invs {
		if (d.Status == model.StatusUnpaid || d.Status == model.StatusPartial) && d.DocType != "credit" && d.TotalCents-d.PaidCents > 0 {
			open = append(open, d)
		}
	}
	seen := map[string]int{} // identical lines in one file are different payments: number them
	for _, rc := range recs {
		row := Row{Line: rc.line, Description: get(rc.fields, "desc")}
		if d, ok := parseDay(get(rc.fields, "date")); ok {
			row.Date = d
		}
		var amt int64
		var has bool
		if v := get(rc.fields, "credit"); v != "" {
			amt, has = parseAmount(v)
		}
		if !has {
			if v := get(rc.fields, "amount"); v != "" {
				amt, has = parseAmount(v)
			}
		}
		if get(rc.fields, "debit") != "" && !has {
			row.Status, row.Reason = NotReceived, "money going out"
			rep.Rows = append(rep.Rows, row)
			continue
		}
		if !has || amt <= 0 {
			row.Status, row.Reason = NotReceived, "no money received on this line"
			rep.Rows = append(rep.Rows, row)
			continue
		}
		row.AmountCents = amt
		h := sha256.Sum256([]byte(row.Date + "|" + strconv.FormatInt(amt, 10) + "|" + strings.ToLower(row.Description)))
		base := hex.EncodeToString(h[:6])
		seen[base]++
		row.Key = base
		if seen[base] > 1 {
			row.Key = fmt.Sprintf("%s-%d", base, seen[base])
		}
		if row.Date == "" {
			row.Status, row.Reason = Unmatched, "the date could not be read"
			rep.Rows = append(rep.Rows, row)
			continue
		}
		classify(ctx, st, &row, open)
		rep.Rows = append(rep.Rows, row)
	}
	for _, r := range rep.Rows {
		switch r.Status {
		case Matched:
			rep.Matched++
		case Duplicate:
			rep.Duplicate++
		case NotReceived:
		default:
			rep.Needs++
		}
	}
	return rep, nil
}

func numberIn(desc, number string) bool {
	if number == "" {
		return false
	}
	re, err := regexp.Compile(`(?i)(^|[^A-Za-z0-9])` + regexp.QuoteMeta(number) + `($|[^A-Za-z0-9])`)
	return err == nil && re.MatchString(desc)
}

func classify(ctx context.Context, st *store.Store, row *Row, open []model.Summary) {
	// Already recorded? The note of a recorded payment carries the line's key.
	var n int
	_ = st.DB.QueryRowContext(ctx, `SELECT COUNT(*) FROM payments WHERE note LIKE ?`, "%statement:"+row.Key+"%").Scan(&n)
	if n > 0 {
		row.Status, row.Reason = Duplicate, "this line is already recorded as a payment"
		return
	}
	var byNumber []model.Summary
	for _, d := range open {
		if numberIn(row.Description, d.FullNumber) {
			byNumber = append(byNumber, d)
		}
	}
	pick := func(d model.Summary, why string) {
		bal := d.TotalCents - d.PaidCents
		row.InvoiceID, row.Number, row.Customer, row.BalanceCents, row.Currency = d.ID, d.FullNumber, d.CustomerName, bal, d.CurrencyCode
		if row.AmountCents > bal {
			row.Status, row.Reason = Overpaid, fmt.Sprintf("%s, but the amount is more than the %s still owed", why, money.Major(bal, d.CurrencyScale))
			return
		}
		row.Status, row.Reason = Matched, why
	}
	switch len(byNumber) {
	case 1:
		pick(byNumber[0], "the invoice number is in the reference")
		return
	case 0:
	default:
		row.Status, row.Reason = Ambiguous, "more than one invoice number is in the reference"
		for _, d := range byNumber {
			row.Candidates = append(row.Candidates, d.ID)
		}
		return
	}
	// No number: the exact amount owed, and the customer's name in the text, narrow it down.
	var byAmount []model.Summary
	for _, d := range open {
		scale := int64(1)
		for i := 2; i < d.CurrencyScale; i++ {
			scale *= 10
		}
		bal := d.TotalCents - d.PaidCents
		if d.CurrencyScale == 2 && bal == row.AmountCents && nameIn(row.Description, d.CustomerName) {
			byAmount = append(byAmount, d)
		}
		_ = scale
	}
	switch len(byAmount) {
	case 1:
		pick(byAmount[0], "the amount is exactly what the customer owes and their name is in the reference")
	case 0:
		row.Status, row.Reason = Unmatched, "no unpaid invoice has this number in the reference, or this exact amount with the customer's name"
	default:
		row.Status, row.Reason = Ambiguous, "more than one invoice fits the amount and name"
		for _, d := range byAmount {
			row.Candidates = append(row.Candidates, d.ID)
		}
	}
}

func nameIn(desc, name string) bool {
	name = strings.ToLower(strings.TrimSpace(name))
	if len(name) < 4 {
		return false
	}
	return strings.Contains(strings.ToLower(desc), name)
}

// Apply is one line the person confirmed.
type Apply struct {
	Key         string `json:"key"`
	InvoiceID   int64  `json:"invoiceId"`
	Date        string `json:"date"`
	AmountCents int64  `json:"amountCents"`
	Note        string `json:"note"`
}

// Result says what happened to one confirmed line.
type Result struct {
	Key     string `json:"key"`
	OK      bool   `json:"ok"`
	Message string `json:"message"`
}

// ApplyAll records each confirmed line as a payment on its invoice. A line that is already recorded, or that would
// pay more than is owed, is refused and reported; the others go through.
func ApplyAll(ctx context.Context, st *store.Store, in []Apply) []Result {
	out := make([]Result, 0, len(in))
	for _, a := range in {
		res := Result{Key: a.Key}
		var n int
		_ = st.DB.QueryRowContext(ctx, `SELECT COUNT(*) FROM payments WHERE note LIKE ?`, "%statement:"+a.Key+"%").Scan(&n)
		switch {
		case a.Key == "" || a.InvoiceID == 0 || a.AmountCents <= 0:
			res.Message = "the line is incomplete"
		case n > 0:
			res.Message = "already recorded"
		default:
			d, err := st.GetDocument(ctx, st.DB, a.InvoiceID)
			switch {
			case err != nil:
				res.Message = "the invoice no longer exists"
			case d.Kind != model.KindInvoice || d.DocType == "credit" || d.Status == model.StatusVoid || d.Status == model.StatusDraft:
				res.Message = "this document cannot receive a payment"
			case a.AmountCents > d.Totals.TotalCents-d.PaidCents:
				res.Message = "more than is still owed"
			default:
				day := a.Date
				if _, ok := parseDay(day); !ok {
					day = st.Today()
				}
				note := strings.TrimSpace(a.Note)
				if len(note) > 200 {
					note = note[:200]
				}
				d.Payments = append(d.Payments, model.Payment{AmountCents: a.AmountCents, PaidOn: day, Method: "bank (statement)", Kind: "payment", Note: strings.TrimSpace(note + " statement:" + a.Key)})
				if _, err := st.UpdateDocument(ctx, a.InvoiceID, d, store.SaveOptions{}); err != nil {
					res.Message = err.Error()
				} else {
					res.OK, res.Message = true, "recorded"
				}
			}
		}
		out = append(out, res)
	}
	return out
}
