// Package activity keeps Mavri's history and tells other systems about it:
// every notable change is written to the audit log (who, what, where from)
// and, if someone subscribed, queued as a signed webhook delivery.
package activity

import (
	"context"
	"crypto/rand"
	"database/sql"
	"encoding/csv"
	"encoding/hex"
	"encoding/json"
	"io"
	"log/slog"
	"strconv"
	"strings"
	"time"

	"github.com/Raktim94/mavri/server/internal/model"
	"github.com/Raktim94/mavri/server/internal/money"
	"github.com/Raktim94/mavri/server/internal/shop"
)

// Sources: where a change came from.
const (
	SourceUI     = "ui"
	SourceAPI    = "api"
	SourceMCP    = "mcp"
	SourcePublic = "public"
	SourceHook   = "webhook"
	SourceSystem = "system"
)

type ctxKey int

const sourceKey ctxKey = 1

type origin struct{ source, actor string }

// WithSource marks the context with where a request came from and who made it.
func WithSource(ctx context.Context, source, actor string) context.Context {
	return context.WithValue(ctx, sourceKey, origin{source, actor})
}

// From reads what WithSource stored; an unmarked context is the system itself.
func From(ctx context.Context) (source, actor string) {
	if o, ok := ctx.Value(sourceKey).(origin); ok {
		return o.source, o.actor
	}
	return SourceSystem, ""
}

// Event names offered to webhook subscribers.
var Events = []string{
	"invoice.created", "invoice.updated", "invoice.paid", "invoice.voided", "invoice.deleted",
	"quote.created", "quote.updated", "quote.accepted", "quote.declined", "quote.deleted",
	"payment.recorded", "payment.failed", "document.shared", "document.viewed", "document.emailed",
	"reminder.sent", "email.failed", "payment.promised", "dispute.opened", "dispute.resolved", "customer.created", "customer.updated", "backup.completed", "backup.failed",
}

// Hub records history and queues webhook deliveries.
type Hub struct {
	DB  *sql.DB
	Box *shop.Box
	Log *slog.Logger
	Now func() time.Time
}

func (h *Hub) now() time.Time {
	if h.Now != nil {
		return h.Now()
	}
	return time.Now()
}

func stamp(t time.Time) string { return t.UTC().Format(time.RFC3339) }

// Event is one thing that happened. Name, when set, is also sent to webhook subscribers with Data.
type Event struct {
	Action   string // audit action, e.g. "created", "paid", "shared"
	Entity   string // "invoice", "quote", "customer", "backup", ...
	EntityID int64
	Label    string // human readable, e.g. the document number
	Detail   string
	Name     string // webhook event name, e.g. "invoice.paid"
	Data     any
}

// Record writes the audit entry and queues deliveries. A failure is logged, never returned:
// history must not make the action it describes fail.
func (h *Hub) Record(ctx context.Context, e Event) {
	source, actor := From(ctx)
	if _, err := h.DB.ExecContext(context.WithoutCancel(ctx),
		`INSERT INTO audit_log (at, actor, source, action, entity, entity_id, label, detail) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
		stamp(h.now()), actor, source, e.Action, e.Entity, e.EntityID, e.Label, e.Detail); err != nil && h.Log != nil {
		h.Log.Error("audit write failed", "error", err)
	}
	if e.Name != "" {
		if err := h.Emit(context.WithoutCancel(ctx), e.Name, e.Data); err != nil && h.Log != nil {
			h.Log.Error("webhook queue failed", "event", e.Name, "error", err)
		}
	}
}

// ---- reading the log -----------------------------------------------------

// Entry is a row of the audit log.
type Entry struct {
	ID       int64  `json:"id"`
	At       string `json:"at"`
	Actor    string `json:"actor"`
	Source   string `json:"source"`
	Action   string `json:"action"`
	Entity   string `json:"entity"`
	EntityID int64  `json:"entityId"`
	Label    string `json:"label"`
	Detail   string `json:"detail"`
}

// Filter narrows the log.
type Filter struct {
	Source, Entity, Query, From, To string
	EntityID                        int64
	Limit, Offset                   int
}

func (f Filter) where() (string, []any) {
	var w []string
	var a []any
	add := func(c string, v any) { w = append(w, c); a = append(a, v) }
	if f.Source != "" {
		add("source = ?", f.Source)
	}
	if f.Entity != "" {
		add("entity = ?", f.Entity)
	}
	if f.EntityID != 0 {
		add("entity_id = ?", f.EntityID)
	}
	if f.From != "" {
		add("at >= ?", f.From)
	}
	if f.To != "" {
		add("at < ?", f.To+"T99")
	}
	if f.Query != "" {
		like := "%" + strings.NewReplacer(`\`, `\\`, `%`, `\%`, `_`, `\_`).Replace(f.Query) + "%"
		w = append(w, `(label LIKE ? ESCAPE '\' OR detail LIKE ? ESCAPE '\' OR actor LIKE ? ESCAPE '\')`)
		a = append(a, like, like, like)
	}
	if len(w) == 0 {
		return "", nil
	}
	return " WHERE " + strings.Join(w, " AND "), a
}

// List returns a page of entries, newest first, and the total that match.
func (h *Hub) List(ctx context.Context, f Filter) ([]Entry, int, error) {
	where, args := f.where()
	var total int
	if err := h.DB.QueryRowContext(ctx, `SELECT COUNT(*) FROM audit_log`+where, args...).Scan(&total); err != nil {
		return nil, 0, err
	}
	if f.Limit <= 0 || f.Limit > 1000 {
		f.Limit = 100
	}
	rows, err := h.DB.QueryContext(ctx, `SELECT id, at, actor, source, action, entity, entity_id, label, detail FROM audit_log`+where+
		` ORDER BY id DESC LIMIT ? OFFSET ?`, append(args, f.Limit, f.Offset)...)
	if err != nil {
		return nil, 0, err
	}
	defer rows.Close()
	out := []Entry{}
	for rows.Next() {
		var e Entry
		if err := rows.Scan(&e.ID, &e.At, &e.Actor, &e.Source, &e.Action, &e.Entity, &e.EntityID, &e.Label, &e.Detail); err != nil {
			return nil, 0, err
		}
		out = append(out, e)
	}
	return out, total, rows.Err()
}

// WriteCSV streams every matching entry, oldest first, as CSV.
func (h *Hub) WriteCSV(ctx context.Context, w io.Writer, f Filter) error {
	where, args := f.where()
	rows, err := h.DB.QueryContext(ctx, `SELECT id, at, actor, source, action, entity, entity_id, label, detail FROM audit_log`+where+` ORDER BY id`, args...)
	if err != nil {
		return err
	}
	defer rows.Close()
	cw := csv.NewWriter(w)
	_ = cw.Write([]string{"id", "time", "actor", "source", "action", "entity", "entity_id", "label", "detail"})
	for rows.Next() {
		var e Entry
		if err := rows.Scan(&e.ID, &e.At, &e.Actor, &e.Source, &e.Action, &e.Entity, &e.EntityID, &e.Label, &e.Detail); err != nil {
			return err
		}
		_ = cw.Write([]string{strconv.FormatInt(e.ID, 10), e.At, safeCell(e.Actor), e.Source, e.Action, e.Entity,
			strconv.FormatInt(e.EntityID, 10), safeCell(e.Label), safeCell(e.Detail)})
	}
	cw.Flush()
	if err := rows.Err(); err != nil {
		return err
	}
	return cw.Error()
}

// safeCell stops a spreadsheet from running a cell that starts like a formula.
func safeCell(s string) string {
	if s != "" && strings.ContainsRune("=+-@\t\r", rune(s[0])) {
		return "'" + s
	}
	return s
}

// ---- document payloads ---------------------------------------------------

// DocData is the slim description of a document sent in events.
func DocData(d model.Document) map[string]any {
	return map[string]any{"document": map[string]any{
		"id": d.ID, "kind": d.Kind, "number": d.FullNumber, "status": d.Status,
		"issuedOn": d.IssuedOn, "dueOn": d.DueOn, "currency": d.Currency.Code,
		"totalCents": d.Totals.TotalCents, "paidCents": d.PaidCents,
		"customer": map[string]any{"id": d.CustomerID, "name": d.Customer.Name, "email": d.Customer.Email},
	}}
}

// DocEvents works out which events a change from old (nil for a new document) to cur caused.
func DocEvents(old *model.Document, cur model.Document) []Event {
	kind := cur.Kind
	data := DocData(cur)
	ev := func(action, name, detail string) Event {
		return Event{Action: action, Entity: kind, EntityID: cur.ID, Label: cur.FullNumber, Detail: detail, Name: name, Data: data}
	}
	if old == nil {
		return []Event{ev("created", kind+".created", "")}
	}
	var out []Event
	if old.Status != cur.Status {
		switch cur.Status {
		case model.StatusPaid:
			out = append(out, ev("paid", "invoice.paid", "status "+old.Status+" → paid"))
		case model.StatusVoid:
			out = append(out, ev("voided", "invoice.voided", ""))
		case model.StatusAccepted:
			out = append(out, ev("accepted", "quote.accepted", ""))
		case model.StatusDeclined:
			out = append(out, ev("declined", "quote.declined", ""))
		default:
			out = append(out, ev("status", "", "status "+old.Status+" → "+cur.Status))
		}
	}
	if n := len(cur.Payments) - len(old.Payments); n > 0 {
		p := cur.Payments[len(cur.Payments)-1]
		detail := money.Format(p.AmountCents, cur.Currency) + " received on " + p.PaidOn
		if n > 1 {
			detail = strconv.Itoa(n) + " payments added, the last " + detail
		}
		out = append(out, Event{Action: "payment recorded", Entity: kind, EntityID: cur.ID, Label: cur.FullNumber, Detail: detail, Name: "payment.recorded", Data: data})
	}
	if len(out) == 0 || changedContent(*old, cur) {
		out = append(out, ev("updated", kind+".updated", ""))
	}
	return out
}

func changedContent(a, b model.Document) bool {
	return a.Totals != b.Totals || a.CustomerID != b.CustomerID || a.DueOn != b.DueOn || a.IssuedOn != b.IssuedOn || a.FullNumber != b.FullNumber
}

func randomHex(n int) string {
	b := make([]byte, n)
	_, _ = rand.Read(b)
	return hex.EncodeToString(b)
}

// envelope is the JSON body of a delivery.
type envelope struct {
	ID        string          `json:"id"`
	Type      string          `json:"type"`
	CreatedAt string          `json:"createdAt"`
	Data      json.RawMessage `json:"data"`
}
