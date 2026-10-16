// Package mailer sends invoices, quotes and reminders by email over SMTP.
// Mavri sends a secure link to the document rather than an attachment, so the
// client always sees the current version and can print or save it as a PDF.
package mailer

import (
	"bytes"
	"context"
	"crypto/rand"
	"crypto/tls"
	"database/sql"
	"encoding/hex"
	"encoding/json"
	"errors"
	"fmt"
	"html"
	"mime"
	"mime/multipart"
	"mime/quotedprintable"
	"net"
	"net/mail"
	"net/smtp"
	"net/textproto"
	"strconv"
	"strings"
	"time"

	"github.com/Raktim94/mavri/server/internal/activity"
	"github.com/Raktim94/mavri/server/internal/model"
	"github.com/Raktim94/mavri/server/internal/money"
	"github.com/Raktim94/mavri/server/internal/share"
	"github.com/Raktim94/mavri/server/internal/shop"
	"github.com/Raktim94/mavri/server/internal/store"
)

// ErrNotConfigured means email is switched off or incomplete.
var ErrNotConfigured = errors.New("email is not set up: add an SMTP server in Automation → Email")

// ErrInvalid is a problem with what the caller sent.
var ErrInvalid = errors.New("invalid")

// Config is the email setup and the default texts. The password is never returned by the API.
type Config struct {
	Enabled         bool   `json:"enabled"`
	Host            string `json:"host"`
	Port            int    `json:"port"`
	Security        string `json:"security"` // starttls, tls or none
	Username        string `json:"username"`
	Password        string `json:"password,omitempty"`
	PasswordSet     bool   `json:"passwordSet"`
	From            string `json:"from"`
	FromName        string `json:"fromName"`
	ReplyTo         string `json:"replyTo"`
	SubjectInvoice  string `json:"subjectInvoice"`
	BodyInvoice     string `json:"bodyInvoice"`
	SubjectQuote    string `json:"subjectQuote"`
	BodyQuote       string `json:"bodyQuote"`
	SubjectReminder string `json:"subjectReminder"`
	BodyReminder    string `json:"bodyReminder"`

	passwordSealed string
}

// Defaults are the starting texts. Placeholders: {{customer}} {{number}} {{total}} {{balance}} {{due}} {{when}} {{link}} {{business}}.
func Defaults() Config {
	return Config{Port: 587, Security: "starttls",
		SubjectInvoice:  "Invoice {{number}} from {{business}}",
		BodyInvoice:     "Hello {{customer}},\n\nPlease find invoice {{number}} for {{total}}, due {{due}}.\n\nYou can view it, print it or save it as a PDF here:\n{{link}}\n\nThank you,\n{{business}}",
		SubjectQuote:    "Quote {{number}} from {{business}}",
		BodyQuote:       "Hello {{customer}},\n\nHere is quote {{number}} for {{total}}.\n\nYou can review it and accept or decline it here:\n{{link}}\n\nBest regards,\n{{business}}",
		SubjectReminder: "Reminder: invoice {{number}} {{when}}",
		BodyReminder:    "Hello {{customer}},\n\nThis is a friendly reminder that invoice {{number}} ({{balance}} outstanding) {{when}}.\n\nYou can view it here:\n{{link}}\n\nIf you have already paid, please ignore this message.\n\nThank you,\n{{business}}"}
}

// Service sends mail and keeps the log.
type Service struct {
	DB    *sql.DB
	Box   *shop.Box
	Store *store.Store
	Links *share.Links
	Hub   *activity.Hub
	// Send replaces the SMTP delivery in tests.
	Send func(cfg Config, password string, to []string, raw []byte) error
}

// Load returns the saved configuration (without the password), merged over the defaults.
func (s *Service) Load(ctx context.Context) (Config, error) {
	cfg := Defaults()
	var raw string
	err := s.DB.QueryRowContext(ctx, `SELECT value FROM settings WHERE key = 'mail'`).Scan(&raw)
	if errors.Is(err, sql.ErrNoRows) {
		return cfg, nil
	}
	if err != nil {
		return cfg, err
	}
	var stored struct {
		Config
		PasswordSealed string `json:"passwordSealed"`
	}
	stored.Config = cfg
	if err := json.Unmarshal([]byte(raw), &stored); err != nil {
		return cfg, nil
	}
	stored.Config.passwordSealed = stored.PasswordSealed
	stored.Config.PasswordSet = stored.PasswordSealed != ""
	stored.Config.Password = ""
	return stored.Config, nil
}

// Save validates and stores the configuration. An empty Password keeps the saved one.
func (s *Service) Save(ctx context.Context, in Config) error {
	old, err := s.Load(ctx)
	if err != nil {
		return err
	}
	in.Host, in.Username = strings.TrimSpace(in.Host), strings.TrimSpace(in.Username)
	in.From, in.FromName, in.ReplyTo = strings.TrimSpace(in.From), clean(in.FromName), strings.TrimSpace(in.ReplyTo)
	if in.Enabled {
		if in.Host == "" || in.Port < 1 || in.Port > 65535 {
			return fmt.Errorf("%w: enter the SMTP server and port", ErrInvalid)
		}
		if _, err := mail.ParseAddress(in.From); err != nil {
			return fmt.Errorf("%w: the From address is not a valid email address", ErrInvalid)
		}
	}
	if in.Security != "starttls" && in.Security != "tls" && in.Security != "none" {
		return fmt.Errorf("%w: security must be starttls, tls or none", ErrInvalid)
	}
	if in.ReplyTo != "" {
		if _, err := mail.ParseAddress(in.ReplyTo); err != nil {
			return fmt.Errorf("%w: the Reply-To address is not valid", ErrInvalid)
		}
	}
	d := Defaults()
	for _, f := range []struct{ v, d *string }{{&in.SubjectInvoice, &d.SubjectInvoice}, {&in.BodyInvoice, &d.BodyInvoice}, {&in.SubjectQuote, &d.SubjectQuote},
		{&in.BodyQuote, &d.BodyQuote}, {&in.SubjectReminder, &d.SubjectReminder}, {&in.BodyReminder, &d.BodyReminder}} {
		if strings.TrimSpace(*f.v) == "" {
			*f.v = *f.d
		}
	}
	sealed := old.passwordSealed
	if in.Password != "" {
		if sealed, err = s.Box.Seal(in.Password); err != nil {
			return err
		}
	}
	raw, _ := json.Marshal(struct {
		Config
		PasswordSealed string `json:"passwordSealed"`
	}{in, sealed})
	_, err = s.DB.ExecContext(ctx, `INSERT INTO settings (key, value) VALUES ('mail', ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value`, string(raw))
	return err
}

func clean(v string) string {
	return strings.NewReplacer("\r", " ", "\n", " ").Replace(strings.TrimSpace(v))
}

func (s *Service) password(cfg Config) string {
	if cfg.passwordSealed == "" {
		return ""
	}
	p, _ := s.Box.Open(cfg.passwordSealed)
	return p
}

// Request describes one email about a document.
type Request struct {
	DocumentID  int64
	Kind        string // "send" for the first email, "reminder" for a nudge
	To          string // empty: the customer's address
	Subject     string // empty: the template
	Body        string // empty: the template
	BaseURL     string // where the client link points, e.g. https://invoices.example.com
	ReminderKey string // makes a reminder send at most once
	When        string // text for {{when}} in reminders
}

// Result is what happened.
type Result struct {
	To      string `json:"to"`
	Subject string `json:"subject"`
	Link    string `json:"link"`
}

// Preview renders the email without sending it, so the user can edit it first. It changes nothing: if the
// document has no secure link yet, {{link}} stays in the text and is filled in when the email is sent.
func (s *Service) Preview(ctx context.Context, r Request) (Result, string, error) {
	return s.render(ctx, r, false)
}

func (s *Service) render(ctx context.Context, r Request, create bool) (Result, string, error) {
	cfg, err := s.Load(ctx)
	if err != nil {
		return Result{}, "", err
	}
	doc, err := s.Store.GetDocument(ctx, s.DB, r.DocumentID)
	if err != nil {
		return Result{}, "", err
	}
	if doc.Status == model.StatusDraft {
		return Result{}, "", fmt.Errorf("%w: this invoice is a draft; issue it before sending it", ErrInvalid)
	}
	var link share.Link
	var found bool
	if create {
		link, _, err = s.Links.Ensure(ctx, doc.ID)
		found = err == nil
	} else {
		link, found, err = s.Links.Active(ctx, doc.ID)
	}
	if err != nil {
		return Result{}, "", err
	}
	url := ""
	if found {
		url = strings.TrimRight(r.BaseURL, "/") + "/d/" + link.Token
	}
	subj, body := templates(cfg, doc, r)
	to := strings.TrimSpace(r.To)
	if to == "" {
		to = doc.Customer.Email
	}
	return Result{To: to, Subject: render(subj, doc, url, r.When), Link: url}, render(body, doc, url, r.When), nil
}

func templates(cfg Config, doc model.Document, r Request) (string, string) {
	subj, body := r.Subject, r.Body
	switch {
	case r.Kind == "reminder":
		subj, body = or(subj, cfg.SubjectReminder), or(body, cfg.BodyReminder)
	case doc.Kind == model.KindQuote:
		subj, body = or(subj, cfg.SubjectQuote), or(body, cfg.BodyQuote)
	default:
		subj, body = or(subj, cfg.SubjectInvoice), or(body, cfg.BodyInvoice)
	}
	return subj, body
}

func or(a, b string) string {
	if strings.TrimSpace(a) != "" {
		return a
	}
	return b
}

func render(tpl string, doc model.Document, link, when string) string {
	due := doc.DueOn
	if due == "" {
		due = "on receipt"
	}
	balance := doc.Totals.TotalCents - doc.PaidCents
	linkText := link
	if linkText == "" {
		linkText = "{{link}}" // no link yet: filled in when the email is sent
	}
	return strings.NewReplacer("{{customer}}", doc.Customer.Name, "{{number}}", doc.FullNumber,
		"{{total}}", money.Format(doc.Totals.TotalCents, doc.Currency), "{{balance}}", money.Format(balance, doc.Currency),
		"{{due}}", due, "{{when}}", when, "{{link}}", linkText, "{{business}}", doc.Issuer.Name).Replace(tpl)
}

// SendDocument emails the document to the customer (or the address given) and logs the outcome.
func (s *Service) SendDocument(ctx context.Context, r Request) (Result, error) {
	cfg, err := s.Load(ctx)
	if err != nil {
		return Result{}, err
	}
	if !cfg.Enabled || cfg.Host == "" {
		return Result{}, ErrNotConfigured
	}
	res, body, err := s.render(ctx, r, true)
	if err != nil {
		return Result{}, err
	}
	addr, err := mail.ParseAddress(res.To)
	if err != nil {
		return Result{}, fmt.Errorf("%w: %q is not a valid email address — add one to the customer or enter it here", ErrInvalid, res.To)
	}
	raw := buildMessage(cfg, addr, clean(res.Subject), body, res.Link)
	send := s.Send
	if send == nil {
		send = deliver
	}
	sendErr := send(cfg, s.password(cfg), []string{addr.Address}, raw)
	status, errText := "sent", ""
	if sendErr != nil {
		status, errText = "failed", sendErr.Error()
	}
	kind := r.Kind
	if kind == "" {
		kind = "send"
	}
	key := ""
	if sendErr == nil {
		key = r.ReminderKey
	}
	if _, err := s.DB.ExecContext(ctx, `INSERT INTO mail_log (document_id, kind, to_addr, subject, status, error, reminder_key, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
		r.DocumentID, kind, addr.Address, res.Subject, status, errText, key, time.Now().UTC().Format(time.RFC3339)); err != nil {
		return res, err
	}
	doc, _ := s.Store.GetDocument(ctx, s.DB, r.DocumentID)
	if sendErr != nil {
		s.Hub.Record(ctx, activity.Event{Action: "email failed", Entity: doc.Kind, EntityID: doc.ID, Label: doc.FullNumber, Detail: errText, Name: "email.failed", Data: activity.DocData(doc)})
		return res, fmt.Errorf("the email could not be sent: %w", sendErr)
	}
	name, action := "document.emailed", "emailed"
	if kind == "reminder" {
		name, action = "reminder.sent", "reminder sent"
	}
	s.Hub.Record(ctx, activity.Event{Action: action, Entity: doc.Kind, EntityID: doc.ID, Label: doc.FullNumber, Detail: "to " + addr.Address, Name: name, Data: activity.DocData(doc)})
	return res, nil
}

// LogEntry is a row of the mail log.
type LogEntry struct {
	ID         int64  `json:"id"`
	DocumentID int64  `json:"documentId"`
	Kind       string `json:"kind"`
	To         string `json:"to"`
	Subject    string `json:"subject"`
	Status     string `json:"status"`
	Error      string `json:"error"`
	At         string `json:"at"`
}

// Log lists sent mail, newest first; documentID 0 means all documents.
func (s *Service) Log(ctx context.Context, documentID int64, limit int) ([]LogEntry, error) {
	if limit <= 0 || limit > 500 {
		limit = 100
	}
	q := `SELECT id, COALESCE(document_id, 0), kind, to_addr, subject, status, error, created_at FROM mail_log`
	var args []any
	if documentID != 0 {
		q += ` WHERE document_id = ?`
		args = append(args, documentID)
	}
	rows, err := s.DB.QueryContext(ctx, q+` ORDER BY id DESC LIMIT ?`, append(args, limit)...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	out := []LogEntry{}
	for rows.Next() {
		var e LogEntry
		if err := rows.Scan(&e.ID, &e.DocumentID, &e.Kind, &e.To, &e.Subject, &e.Status, &e.Error, &e.At); err != nil {
			return nil, err
		}
		out = append(out, e)
	}
	return out, rows.Err()
}

// ---- SMTP --------------------------------------------------------------

func buildMessage(cfg Config, to *mail.Address, subject, body, link string) []byte {
	from := mail.Address{Name: cfg.FromName, Address: cfg.From}
	if a, err := mail.ParseAddress(cfg.From); err == nil {
		from = mail.Address{Name: cfg.FromName, Address: a.Address}
	}
	var b bytes.Buffer
	h := func(k, v string) { fmt.Fprintf(&b, "%s: %s\r\n", k, v) }
	h("From", from.String())
	h("To", to.String())
	if cfg.ReplyTo != "" {
		h("Reply-To", cfg.ReplyTo)
	}
	h("Subject", mime.QEncoding.Encode("utf-8", subject))
	h("Date", time.Now().Format(time.RFC1123Z))
	id := make([]byte, 12)
	_, _ = rand.Read(id)
	domain := "mavri.local"
	if i := strings.LastIndex(from.Address, "@"); i >= 0 {
		domain = from.Address[i+1:]
	}
	h("Message-ID", "<"+hex.EncodeToString(id)+"@"+domain+">")
	h("MIME-Version", "1.0")
	mw := multipart.NewWriter(&b)
	h("Content-Type", "multipart/alternative; boundary="+mw.Boundary())
	b.WriteString("\r\n")
	part := func(ctype, content string) {
		w, _ := mw.CreatePart(textproto.MIMEHeader{"Content-Type": {ctype + "; charset=utf-8"}, "Content-Transfer-Encoding": {"quoted-printable"}})
		q := quotedprintable.NewWriter(w)
		_, _ = q.Write([]byte(content))
		_ = q.Close()
	}
	part("text/plain", strings.ReplaceAll(body, "\n", "\r\n"))
	part("text/html", htmlBody(body, link))
	_ = mw.Close()
	return b.Bytes()
}

func htmlBody(body, link string) string {
	var sb strings.Builder
	sb.WriteString(`<div style="font-family:system-ui,sans-serif;font-size:15px;line-height:1.55;color:#1c1b29;max-width:560px">`)
	for _, p := range strings.Split(strings.ReplaceAll(body, "\r\n", "\n"), "\n\n") {
		p = html.EscapeString(strings.TrimSpace(p))
		if p == "" {
			continue
		}
		esc := html.EscapeString(link)
		if strings.Contains(p, esc) {
			p = strings.ReplaceAll(p, esc, `<a href="`+esc+`" style="display:inline-block;margin:4px 0;padding:10px 18px;border-radius:8px;background:#3b5bdb;color:#fff;text-decoration:none;font-weight:600">View document</a><br><span style="color:#6b6a7c;font-size:13px">`+esc+`</span>`)
		}
		sb.WriteString("<p>" + strings.ReplaceAll(p, "\n", "<br>") + "</p>")
	}
	sb.WriteString("</div>")
	return sb.String()
}

func deliver(cfg Config, password string, to []string, raw []byte) error {
	addr := net.JoinHostPort(cfg.Host, strconv.Itoa(cfg.Port))
	d := net.Dialer{Timeout: 15 * time.Second}
	var conn net.Conn
	var err error
	if cfg.Security == "tls" {
		conn, err = tls.DialWithDialer(&d, "tcp", addr, &tls.Config{ServerName: cfg.Host, MinVersion: tls.VersionTLS12})
	} else {
		conn, err = d.Dial("tcp", addr)
	}
	if err != nil {
		return err
	}
	_ = conn.SetDeadline(time.Now().Add(60 * time.Second))
	c, err := smtp.NewClient(conn, cfg.Host)
	if err != nil {
		conn.Close()
		return err
	}
	defer c.Close()
	if cfg.Security == "starttls" {
		if err := c.StartTLS(&tls.Config{ServerName: cfg.Host, MinVersion: tls.VersionTLS12}); err != nil {
			return err
		}
	}
	if cfg.Username != "" {
		if err := c.Auth(smtp.PlainAuth("", cfg.Username, password, cfg.Host)); err != nil {
			return err
		}
	}
	a, err := mail.ParseAddress(cfg.From)
	if err != nil {
		return err
	}
	if err := c.Mail(a.Address); err != nil {
		return err
	}
	for _, t := range to {
		if err := c.Rcpt(t); err != nil {
			return err
		}
	}
	w, err := c.Data()
	if err != nil {
		return err
	}
	if _, err := w.Write(raw); err != nil {
		return err
	}
	if err := w.Close(); err != nil {
		return err
	}
	return c.Quit()
}

// SendTest sends a short message to check the SMTP setup.
func (s *Service) SendTest(ctx context.Context, to string) error {
	cfg, err := s.Load(ctx)
	if err != nil {
		return err
	}
	if !cfg.Enabled || cfg.Host == "" {
		return ErrNotConfigured
	}
	addr, err := mail.ParseAddress(strings.TrimSpace(to))
	if err != nil {
		return fmt.Errorf("%w: enter a valid email address to send the test to", ErrInvalid)
	}
	raw := buildMessage(cfg, addr, "Mavri email test", "This is a test message from Mavri.\n\nIf you can read this, invoices and reminders can be sent from this address.", "")
	send := s.Send
	if send == nil {
		send = deliver
	}
	if err := send(cfg, s.password(cfg), []string{addr.Address}, raw); err != nil {
		return fmt.Errorf("the email could not be sent: %w", err)
	}
	return nil
}

// SendNotice sends a plain message to one address, for notes to the owner themselves (not to customers).
func (s *Service) SendNotice(ctx context.Context, to, subject, body string) error {
	cfg, err := s.Load(ctx)
	if err != nil {
		return err
	}
	if !cfg.Enabled || cfg.Host == "" {
		return ErrNotConfigured
	}
	addr, err := mail.ParseAddress(strings.TrimSpace(to))
	if err != nil {
		return fmt.Errorf("%w: %q is not an email address", ErrInvalid, to)
	}
	raw := buildMessage(cfg, addr, subject, body, "")
	send := s.Send
	if send == nil {
		send = deliver
	}
	if err := send(cfg, s.password(cfg), []string{addr.Address}, raw); err != nil {
		return fmt.Errorf("the email could not be sent: %w", err)
	}
	return nil
}
