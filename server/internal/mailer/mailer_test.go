package mailer

import (
	"bufio"
	"context"
	"errors"
	"fmt"
	"io"
	"mime"
	"mime/multipart"
	"mime/quotedprintable"
	"net"
	"net/mail"
	"strings"
	"testing"

	"github.com/Raktim94/mavri/server/internal/activity"
	"github.com/Raktim94/mavri/server/internal/db"
	"github.com/Raktim94/mavri/server/internal/model"
	"github.com/Raktim94/mavri/server/internal/share"
	"github.com/Raktim94/mavri/server/internal/shop"
	"github.com/Raktim94/mavri/server/internal/store"
)

type sent struct {
	to  []string
	raw []byte
}

func setup(t *testing.T) (*Service, int64, *[]sent) {
	t.Helper()
	d, err := db.Open(":memory:")
	if err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() { d.Close() })
	box, _ := shop.NewBox(t.TempDir(), "")
	ctx := context.Background()
	st := &store.Store{DB: d}
	issuer := model.Party{Kind: "issuer", Name: "Acme Studio"}
	cust := model.Party{Kind: "customer", Name: "Jo Client", Email: "jo@client.example"}
	store.Parties.Insert(ctx, d, &issuer)
	store.Parties.Insert(ctx, d, &cust)
	doc, err := st.CreateDocument(ctx, model.Document{Kind: "invoice", IssuerID: issuer.ID, CustomerID: cust.ID, CurrencyID: 1, IssuedOn: "2026-10-01", DueOn: "2026-10-15",
		Lines: []model.Line{{Name: "Work", Quantity: 2, UnitCents: 5000}}}, store.SaveOptions{})
	if err != nil {
		t.Fatal(err)
	}
	var log []sent
	s := &Service{DB: d, Box: box, Store: st, Links: &share.Links{DB: d}, Hub: &activity.Hub{DB: d, Box: box},
		Send: func(cfg Config, pw string, to []string, raw []byte) error {
			log = append(log, sent{to, raw})
			return nil
		}}
	return s, doc.ID, &log
}

func configure(t *testing.T, s *Service) {
	t.Helper()
	cfg := Defaults()
	cfg.Enabled, cfg.Host, cfg.From, cfg.FromName = true, "smtp.example", "billing@acme.example", "Acme Studio"
	cfg.Password = "s3cret"
	if err := s.Save(context.Background(), cfg); err != nil {
		t.Fatal(err)
	}
}

func TestSendDocumentRendersTheTemplateAndLogs(t *testing.T) {
	s, id, log := setup(t)
	ctx := context.Background()
	if _, err := s.SendDocument(ctx, Request{DocumentID: id, BaseURL: "https://inv.example"}); !errors.Is(err, ErrNotConfigured) {
		t.Fatalf("before setup: %v", err)
	}
	configure(t, s)
	res, err := s.SendDocument(ctx, Request{DocumentID: id, BaseURL: "https://inv.example/"})
	if err != nil {
		t.Fatal(err)
	}
	if res.To != "jo@client.example" || res.Subject != "Invoice 1 from Acme Studio" || !strings.HasPrefix(res.Link, "https://inv.example/d/") {
		t.Fatalf("result: %+v", res)
	}
	if len(*log) != 1 || (*log)[0].to[0] != "jo@client.example" {
		t.Fatalf("sent: %+v", *log)
	}
	msg, err := mail.ReadMessage(strings.NewReader(string((*log)[0].raw)))
	if err != nil {
		t.Fatal(err)
	}
	if got := msg.Header.Get("From"); !strings.Contains(got, "billing@acme.example") {
		t.Fatalf("from: %q", got)
	}
	_, params, _ := mime.ParseMediaType(msg.Header.Get("Content-Type"))
	mr := multipart.NewReader(msg.Body, params["boundary"])
	text := ""
	for {
		p, err := mr.NextPart()
		if err != nil {
			break
		}
		b, _ := io.ReadAll(quotedprintable.NewReader(p))
		if strings.HasPrefix(p.Header.Get("Content-Type"), "text/plain") {
			text = string(b)
		}
	}
	for _, want := range []string{"Hello Jo Client", "$100.00", "2026-10-15", res.Link} {
		if !strings.Contains(text, want) {
			t.Fatalf("body is missing %q:\n%s", want, text)
		}
	}
	rows, _ := s.Log(ctx, id, 10)
	if len(rows) != 1 || rows[0].Status != "sent" {
		t.Fatalf("log: %+v", rows)
	}
}

func TestFailureIsLoggedAndReported(t *testing.T) {
	s, id, _ := setup(t)
	configure(t, s)
	s.Send = func(Config, string, []string, []byte) error { return fmt.Errorf("535 bad credentials") }
	_, err := s.SendDocument(context.Background(), Request{DocumentID: id, BaseURL: "https://x"})
	if err == nil || !strings.Contains(err.Error(), "could not be sent") || !strings.Contains(err.Error(), "535") {
		t.Fatalf("err: %v", err)
	}
	rows, _ := s.Log(context.Background(), id, 10)
	if len(rows) != 1 || rows[0].Status != "failed" || !strings.Contains(rows[0].Error, "535") {
		t.Fatalf("log: %+v", rows)
	}
}

func TestReminderKeyStopsDuplicates(t *testing.T) {
	s, id, _ := setup(t)
	configure(t, s)
	ctx := context.Background()
	r := Request{DocumentID: id, Kind: "reminder", BaseURL: "https://x", ReminderKey: "rem:1:3", When: "is due in 3 days"}
	if _, err := s.SendDocument(ctx, r); err != nil {
		t.Fatal(err)
	}
	// The database refuses a second "sent" row with the same key.
	if _, err := s.DB.ExecContext(ctx, `INSERT INTO mail_log (document_id, kind, to_addr, subject, status, reminder_key, created_at) VALUES (?, 'reminder', 'a@b.c', 's', 'sent', 'rem:1:3', '')`, id); err == nil {
		t.Fatal("a duplicate reminder key was accepted")
	}
}

func TestInvalidAddressesAndHeaderInjection(t *testing.T) {
	s, id, log := setup(t)
	configure(t, s)
	ctx := context.Background()
	if _, err := s.SendDocument(ctx, Request{DocumentID: id, To: "not an address", BaseURL: "https://x"}); !errors.Is(err, ErrInvalid) {
		t.Fatalf("bad address: %v", err)
	}
	if _, err := s.SendDocument(ctx, Request{DocumentID: id, To: "ok@x.co", Subject: "Hi\r\nBcc: spy@evil.example", BaseURL: "https://x"}); err != nil {
		t.Fatal(err)
	}
	msg, _ := mail.ReadMessage(strings.NewReader(string((*log)[0].raw)))
	if msg.Header.Get("Bcc") != "" {
		t.Fatal("a newline in the subject injected a header")
	}
}

func TestSavingKeepsThePassword(t *testing.T) {
	s, _, _ := setup(t)
	ctx := context.Background()
	configure(t, s)
	cfg, _ := s.Load(ctx)
	if !cfg.PasswordSet || cfg.Password != "" {
		t.Fatalf("the password must never be returned: %+v", cfg)
	}
	cfg.FromName = "Renamed"
	if err := s.Save(ctx, cfg); err != nil {
		t.Fatal(err)
	}
	again, _ := s.Load(ctx)
	if !again.PasswordSet || s.password(again) != "s3cret" {
		t.Fatal("saving without a password must keep the saved one")
	}
	bad := cfg
	bad.From = "nope"
	if err := s.Save(ctx, bad); !errors.Is(err, ErrInvalid) {
		t.Fatalf("invalid from: %v", err)
	}
}

// A tiny SMTP server proves the real delivery path (greeting, MAIL, RCPT, DATA).
func TestDeliverTalksSMTP(t *testing.T) {
	ln, err := net.Listen("tcp", "127.0.0.1:0")
	if err != nil {
		t.Fatal(err)
	}
	defer ln.Close()
	got := make(chan string, 1)
	go func() {
		c, err := ln.Accept()
		if err != nil {
			return
		}
		defer c.Close()
		r := bufio.NewReader(c)
		w := func(s string) { fmt.Fprint(c, s+"\r\n") }
		w("220 test ESMTP")
		var data strings.Builder
		inData := false
		for {
			line, err := r.ReadString('\n')
			if err != nil {
				return
			}
			line = strings.TrimRight(line, "\r\n")
			switch {
			case inData && line == ".":
				inData = false
				got <- data.String()
				w("250 queued")
			case inData:
				data.WriteString(line + "\n")
			case strings.HasPrefix(line, "EHLO"), strings.HasPrefix(line, "HELO"):
				w("250 hello")
			case strings.HasPrefix(line, "MAIL"), strings.HasPrefix(line, "RCPT"):
				w("250 ok")
			case line == "DATA":
				inData = true
				w("354 go")
			case line == "QUIT":
				w("221 bye")
				return
			default:
				w("250 ok")
			}
		}
	}()
	host, port, _ := net.SplitHostPort(ln.Addr().String())
	var p int
	fmt.Sscan(port, &p)
	cfg := Defaults()
	cfg.Host, cfg.Port, cfg.Security, cfg.From = host, p, "none", "me@x.co"
	addr, _ := mail.ParseAddress("you@y.co")
	if err := deliver(cfg, "", []string{"you@y.co"}, buildMessage(cfg, addr, "Hello", "Body text", "")); err != nil {
		t.Fatal(err)
	}
	if body := <-got; !strings.Contains(body, "Subject: Hello") || !strings.Contains(body, "Body text") {
		t.Fatalf("server received:\n%s", body)
	}
}
