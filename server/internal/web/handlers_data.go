package web

import (
	"bytes"
	_ "embed"
	"errors"
	"fmt"
	"io"
	"net/http"
	"os"
	"strconv"
	"strings"
	"time"

	"github.com/Raktim94/mavri/server/internal/activity"
	"github.com/Raktim94/mavri/server/internal/backup"
	"github.com/Raktim94/mavri/server/internal/csvio"
	"github.com/Raktim94/mavri/server/internal/einvoice"
	"github.com/Raktim94/mavri/server/internal/model"
	"github.com/Raktim94/mavri/server/internal/payments"
)

//go:embed openapi.yaml
var openapiSpec []byte

func (s *Server) openapi(w http.ResponseWriter, _ *http.Request) {
	w.Header().Set("Content-Type", "application/yaml; charset=utf-8")
	_, _ = w.Write(openapiSpec)
}

// ---- CSV ---------------------------------------------------------------------

func (s *Server) exportCSV(w http.ResponseWriter, r *http.Request) {
	kind := strings.TrimSuffix(r.PathValue("file"), ".csv")
	known := false
	for _, k := range csvio.Kinds {
		known = known || k == kind
	}
	if !known {
		fail(w, http.StatusNotFound, "not_found", "export one of: customers, products, invoices, payments")
		return
	}
	var only []int64
	for _, f := range strings.Split(r.URL.Query().Get("ids"), ",") {
		if n, err := strconv.ParseInt(strings.TrimSpace(f), 10, 64); err == nil && n > 0 {
			only = append(only, n)
		}
	}
	var buf bytes.Buffer
	if err := csvio.Export(r.Context(), s.DB, s.Store, kind, &buf, only...); err != nil {
		s.problem(w, r, err)
		return
	}
	s.Hub.Record(r.Context(), activity.Event{Action: "exported", Entity: kind, Label: kind + " (CSV)"})
	w.Header().Set("Content-Type", "text/csv; charset=utf-8")
	w.Header().Set("Content-Disposition", fmt.Sprintf(`attachment; filename="mavri-%s-%s.csv"`, kind, time.Now().UTC().Format("2006-01-02")))
	_, _ = w.Write(append([]byte("\xef\xbb\xbf"), buf.Bytes()...)) // BOM so spreadsheets read UTF-8
}

func (s *Server) importCSV(w http.ResponseWriter, r *http.Request) {
	kind := r.PathValue("kind")
	r.Body = http.MaxBytesReader(w, r.Body, 17<<20)
	if err := r.ParseMultipartForm(17 << 20); err != nil {
		fail(w, http.StatusBadRequest, "validation", "send the CSV as a file upload")
		return
	}
	file, _, err := r.FormFile("file")
	if err != nil {
		fail(w, http.StatusBadRequest, "validation", "choose a CSV file")
		return
	}
	defer file.Close()
	dry := r.URL.Query().Get("dryRun") == "1"
	rep, err := csvio.Import(r.Context(), s.DB, kind, file, dry)
	switch {
	case errors.Is(err, csvio.ErrInvalid), errors.Is(err, csvio.ErrUnknownKind):
		fail(w, http.StatusBadRequest, "validation", strings.TrimPrefix(err.Error(), "invalid file: "))
		return
	case err != nil:
		s.problem(w, r, err)
		return
	}
	if !dry {
		s.Hub.Record(r.Context(), activity.Event{Action: "imported", Entity: kind, Label: kind + " (CSV)", Detail: fmt.Sprintf("%d created, %d skipped, %d rows with problems", rep.Created, rep.Skipped, len(rep.Errors)-rep.Skipped)})
	}
	writeJSON(w, http.StatusOK, rep)
}

// ---- backups -----------------------------------------------------------------

func (s *Server) backupStatus(w http.ResponseWriter, r *http.Request) {
	st, err := s.Backups.Status(r.Context())
	if err != nil {
		s.problem(w, r, err)
		return
	}
	writeJSON(w, http.StatusOK, st)
}

func (s *Server) putBackupConfig(w http.ResponseWriter, r *http.Request) {
	var in backup.Config
	if !readJSON(w, r, &in) {
		return
	}
	if err := s.Backups.Save(r.Context(), in); err != nil {
		if errors.Is(err, backup.ErrInvalidSetting) {
			fail(w, http.StatusBadRequest, "validation", strings.TrimPrefix(err.Error(), backup.ErrInvalidSetting.Error()+": "))
			return
		}
		s.problem(w, r, err)
		return
	}
	s.Hub.Record(r.Context(), activity.Event{Action: "changed", Entity: "settings", Detail: "backup settings"})
	s.backupStatus(w, r)
}

func (s *Server) runBackup(w http.ResponseWriter, r *http.Request) {
	name, err := s.Backups.RunNow(r.Context())
	if err != nil {
		fail(w, http.StatusBadGateway, "backup_failed", err.Error())
		return
	}
	writeJSON(w, http.StatusOK, map[string]string{"name": name})
}

func (s *Server) testS3(w http.ResponseWriter, r *http.Request) {
	if err := s.Backups.TestS3(r.Context()); err != nil {
		fail(w, http.StatusBadGateway, "s3_failed", err.Error())
		return
	}
	w.WriteHeader(http.StatusNoContent)
}

func (s *Server) listS3Backups(w http.ResponseWriter, r *http.Request) {
	files, err := s.Backups.ListS3(r.Context())
	if err != nil {
		fail(w, http.StatusBadGateway, "s3_failed", err.Error())
		return
	}
	writeJSON(w, http.StatusOK, files)
}

func (s *Server) downloadBackupFile(w http.ResponseWriter, r *http.Request) {
	name := r.PathValue("name")
	data, err := s.Backups.ReadLocal(name)
	if errors.Is(err, backup.ErrInvalid) || errors.Is(err, os.ErrNotExist) {
		fail(w, http.StatusNotFound, "not_found", "no such backup")
		return
	}
	if err != nil {
		s.problem(w, r, err)
		return
	}
	s.Hub.Record(r.Context(), activity.Event{Action: "downloaded", Entity: "backup", Label: name})
	w.Header().Set("Content-Type", "application/octet-stream")
	w.Header().Set("Content-Disposition", fmt.Sprintf(`attachment; filename="%s"`, name))
	_, _ = w.Write(data)
}

// backupInput finds the backup bytes the request refers to: an uploaded file, a copy on the server, or a copy in S3.
func (s *Server) backupInput(w http.ResponseWriter, r *http.Request) (data []byte, pass string, ok bool) {
	ct := r.Header.Get("Content-Type")
	if strings.HasPrefix(ct, "multipart/") {
		r.Body = http.MaxBytesReader(w, r.Body, maxBody)
		if err := r.ParseMultipartForm(maxBody); err != nil {
			fail(w, http.StatusBadRequest, "validation", "send the backup as a file upload")
			return nil, "", false
		}
		file, _, err := r.FormFile("file")
		if err != nil {
			fail(w, http.StatusBadRequest, "validation", "choose a backup file")
			return nil, "", false
		}
		defer file.Close()
		data, err = io.ReadAll(io.LimitReader(file, 256<<20))
		if err != nil {
			fail(w, http.StatusBadRequest, "validation", "this is not a Mavri backup")
			return nil, "", false
		}
		return data, r.FormValue("passphrase"), true
	}
	var in struct {
		Source     string `json:"source"` // "local" or "s3"
		Name       string `json:"name"`
		Passphrase string `json:"passphrase"`
	}
	if !readJSON(w, r, &in) {
		return nil, "", false
	}
	var err error
	switch in.Source {
	case "local":
		data, err = s.Backups.ReadLocal(in.Name)
		if in.Passphrase == "" { // a copy the server made itself can use its own saved passphrase
			in.Passphrase = s.Backups.Passphrase(r.Context())
		}
	case "s3":
		data, err = s.Backups.ReadS3(r.Context(), in.Name)
		if in.Passphrase == "" {
			in.Passphrase = s.Backups.Passphrase(r.Context())
		}
	default:
		fail(w, http.StatusBadRequest, "validation", "source must be local or s3")
		return nil, "", false
	}
	if err != nil {
		fail(w, http.StatusBadRequest, "validation", "that backup could not be read: "+err.Error())
		return nil, "", false
	}
	return data, in.Passphrase, true
}

func (s *Server) openBackup(w http.ResponseWriter, r *http.Request) (backup.File, bool) {
	data, pass, ok := s.backupInput(w, r)
	if !ok {
		return backup.File{}, false
	}
	f, err := backup.Unpack(data, pass)
	switch {
	case errors.Is(err, backup.ErrPassphrase):
		fail(w, http.StatusBadRequest, "passphrase", "this backup is encrypted: enter its passphrase (it is missing or wrong)")
		return f, false
	case errors.Is(err, backup.ErrInvalid):
		fail(w, http.StatusBadRequest, "validation", err.Error())
		return f, false
	case err != nil:
		s.problem(w, r, err)
		return f, false
	}
	return f, true
}

// verifyBackup opens a backup without restoring it and says what it holds.
func (s *Server) verifyBackup(w http.ResponseWriter, r *http.Request) {
	f, ok := s.openBackup(w, r)
	if !ok {
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"ok": true, "exportedAt": f.ExportedAt, "counts": backup.Counts(f)})
}

func (s *Server) restoreBackup(w http.ResponseWriter, r *http.Request) {
	f, ok := s.openBackup(w, r)
	if !ok {
		return
	}
	if r.URL.Query().Get("confirm") != "replace" {
		fail(w, http.StatusBadRequest, "validation", "restoring replaces all invoices and records; confirm to continue")
		return
	}
	// A safety copy first, so a wrong restore can be undone.
	if _, err := s.Backups.RunNow(activity.WithSource(r.Context(), activity.SourceSystem, "before restore")); err != nil {
		s.Log.Warn("safety backup before restore failed", "error", err)
	}
	if err := backup.Restore(r.Context(), s.DB, f); err != nil {
		if errors.Is(err, backup.ErrInvalid) {
			fail(w, http.StatusBadRequest, "validation", err.Error())
			return
		}
		s.problem(w, r, err)
		return
	}
	s.Hub.Record(r.Context(), activity.Event{Action: "restored", Entity: "backup", Label: "from backup of " + f.ExportedAt, Detail: fmt.Sprint(backup.Counts(f))})
	w.WriteHeader(http.StatusNoContent)
}

// ---- health ------------------------------------------------------------------

func (s *Server) health(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()
	out := map[string]any{"version": Version, "uptimeSeconds": int(time.Since(s.Started).Seconds()), "time": time.Now().UTC().Format(time.RFC3339)}
	var migration string
	_ = s.DB.QueryRowContext(ctx, `SELECT COALESCE(MAX(name), '') FROM schema_migrations`).Scan(&migration)
	out["schema"] = migration
	var pageCount, pageSize int64
	_ = s.DB.QueryRowContext(ctx, `PRAGMA page_count`).Scan(&pageCount)
	_ = s.DB.QueryRowContext(ctx, `PRAGMA page_size`).Scan(&pageSize)
	out["databaseBytes"] = pageCount * pageSize
	var integrity string
	_ = s.DB.QueryRowContext(ctx, `PRAGMA quick_check`).Scan(&integrity)
	out["databaseCheck"] = integrity
	counts := map[string]int{}
	for _, t := range []string{"documents", "parties", "products", "payments", "audit_log"} {
		var n int
		_ = s.DB.QueryRowContext(ctx, "SELECT COUNT(*) FROM "+t).Scan(&n)
		counts[t] = n
	}
	out["counts"] = counts
	var dirBytes int64
	if ents, err := os.ReadDir(s.Cfg.DataDir); err == nil {
		for _, e := range ents {
			if info, err := e.Info(); err == nil && !e.IsDir() {
				dirBytes += info.Size()
			}
		}
	}
	files, _ := s.Backups.LocalFiles()
	for _, f := range files {
		dirBytes += f.Bytes
	}
	out["dataFolderBytes"] = dirBytes
	if st, err := s.Backups.Status(ctx); err == nil {
		out["backup"] = map[string]any{"enabled": st.Config.Enabled, "ageHours": st.AgeHours, "lastSuccess": st.LastSuccess, "lastFailure": st.LastFailure, "copies": len(st.Files)}
	}
	var pending, failed24, delivered24 int
	_ = s.DB.QueryRowContext(ctx, `SELECT COUNT(*) FROM webhook_deliveries WHERE status = 'pending'`).Scan(&pending)
	since := time.Now().UTC().Add(-24 * time.Hour).Format(time.RFC3339)
	_ = s.DB.QueryRowContext(ctx, `SELECT COUNT(*) FROM webhook_deliveries WHERE status = 'failed' AND created_at >= ?`, since).Scan(&failed24)
	_ = s.DB.QueryRowContext(ctx, `SELECT COUNT(*) FROM webhook_deliveries WHERE status = 'delivered' AND created_at >= ?`, since).Scan(&delivered24)
	out["webhooks"] = map[string]int{"pending": pending, "failed24h": failed24, "delivered24h": delivered24}
	var mailFailed, mailSent int
	_ = s.DB.QueryRowContext(ctx, `SELECT COUNT(*) FROM mail_log WHERE status = 'failed' AND created_at >= ?`, since).Scan(&mailFailed)
	_ = s.DB.QueryRowContext(ctx, `SELECT COUNT(*) FROM mail_log WHERE status = 'sent' AND created_at >= ?`, since).Scan(&mailSent)
	mc, _ := s.Mail.Load(ctx)
	out["email"] = map[string]any{"configured": mc.Enabled && mc.Host != "", "failed24h": mailFailed, "sent24h": mailSent}
	if ac, err := s.Auto.Load(ctx); err == nil {
		var sched int
		_ = s.DB.QueryRowContext(ctx, `SELECT COUNT(*) FROM recurring WHERE active = 1`).Scan(&sched)
		out["automation"] = map[string]any{"reminders": ac.RemindersEnabled, "recurringActive": sched, "publicUrlSet": ac.PublicURL != ""}
	}
	if ov, err := s.Auto.Overdue(ctx); err == nil {
		out["overdueInvoices"] = len(ov)
	}
	out["recentErrors"] = s.Errors.Recent()
	writeJSON(w, http.StatusOK, out)
}

// ---- public client view ------------------------------------------------------

// publicDoc is a document as a client sees it: no internal notes, no attachments.
func publicDoc(d model.Document) model.Document {
	d.Attachments = nil
	d.Issuer.Note, d.Customer.Note = "", ""
	d.Issuer.EScheme, d.Customer.EScheme = "", ""
	return d
}

func (s *Server) publicGet(w http.ResponseWriter, r *http.Request) {
	token := r.PathValue("token")
	id, err := s.Links.Lookup(r.Context(), token)
	if err != nil {
		fail(w, http.StatusNotFound, "not_found", "this link is not valid any more")
		return
	}
	d, err := s.Store.GetDocument(r.Context(), s.DB, id)
	if err != nil {
		fail(w, http.StatusNotFound, "not_found", "this link is not valid any more")
		return
	}
	ctx := activity.WithSource(r.Context(), activity.SourcePublic, "client link")
	if first, err := s.Links.Viewed(ctx, token); err == nil && first {
		s.Hub.Record(ctx, activity.Event{Action: "viewed", Entity: d.Kind, EntityID: id, Label: d.FullNumber, Detail: "the client opened the link for the first time", Name: "document.viewed", Data: activity.DocData(d)})
	}
	writeJSON(w, http.StatusOK, publicDoc(d))
}

func (s *Server) publicRespond(w http.ResponseWriter, r *http.Request) {
	token := r.PathValue("token")
	id, err := s.Links.Lookup(r.Context(), token)
	if err != nil {
		fail(w, http.StatusNotFound, "not_found", "this link is not valid any more")
		return
	}
	var in struct {
		Action  string `json:"action"` // quotes: accept or decline. Invoices: dispute or promise
		Message string `json:"message"`
		Date    string `json:"date"` // invoices, for a promise
	}
	if !readJSON(w, r, &in) {
		return
	}
	old, err := s.Store.GetDocument(r.Context(), s.DB, id)
	if err != nil {
		s.problem(w, r, err)
		return
	}
	if old.Kind == model.KindInvoice {
		s.publicInvoiceResponse(w, r, id, in.Action, strings.TrimSpace(in.Message), in.Date)
		return
	}
	if old.Kind != model.KindQuote {
		fail(w, http.StatusBadRequest, "validation", "only quotes can be accepted or declined")
		return
	}
	var status string
	switch in.Action {
	case "accept":
		status = model.StatusAccepted
	case "decline":
		status = model.StatusDeclined
	default:
		fail(w, http.StatusBadRequest, "validation", "action must be accept or decline")
		return
	}
	if old.Status != model.StatusOpen {
		fail(w, http.StatusConflict, "conflict", "this quote has already been "+old.Status)
		return
	}
	msg := strings.TrimSpace(in.Message)
	if len(msg) > 500 {
		msg = msg[:500]
	}
	ctx := activity.WithSource(r.Context(), activity.SourcePublic, "client link")
	upd := old
	upd.Status = status
	out, err := s.Store.UpdateDocument(ctx, id, upd, saveOptions(r))
	if err != nil {
		s.problem(w, r, err)
		return
	}
	events := activity.DocEvents(&old, out)
	for i := range events {
		if msg != "" {
			events[i].Detail = strings.TrimSpace(events[i].Detail + " — client message: " + msg)
		}
		s.Hub.Record(ctx, events[i])
	}
	if status == model.StatusAccepted {
		if _, err := s.Auto.OnQuoteAccepted(ctx, id); err != nil {
			s.Log.Warn("could not draft the invoice for an accepted quote", "error", err)
		}
		out, _ = s.Store.GetDocument(ctx, s.DB, id)
	}
	writeJSON(w, http.StatusOK, publicDoc(out))
}

// ---- online payments ---------------------------------------------------------

func (s *Server) getPayConfig(w http.ResponseWriter, r *http.Request) {
	cfg, err := s.Pay.Load(r.Context())
	if err != nil {
		s.problem(w, r, err)
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"config": cfg, "webhookUrl": s.publicBase(r) + "/api/hooks/stripe",
		"events": []string{"checkout.session.completed", "checkout.session.async_payment_succeeded", "checkout.session.async_payment_failed", "payment_intent.payment_failed"}})
}

func (s *Server) putPayConfig(w http.ResponseWriter, r *http.Request) {
	var in payments.Config
	if !readJSON(w, r, &in) {
		return
	}
	if err := s.Pay.Save(r.Context(), in); err != nil {
		if errors.Is(err, payments.ErrInvalid) {
			fail(w, http.StatusBadRequest, "validation", strings.TrimPrefix(err.Error(), "invalid: "))
			return
		}
		s.problem(w, r, err)
		return
	}
	s.Hub.Record(r.Context(), activity.Event{Action: "changed", Entity: "settings", Detail: "online payments"})
	s.getPayConfig(w, r)
}

// publicOptions says what a client can do with the document: pay online, download the e-invoice.
func (s *Server) publicOptions(w http.ResponseWriter, r *http.Request) {
	id, err := s.Links.Lookup(r.Context(), r.PathValue("token"))
	if err != nil {
		fail(w, http.StatusNotFound, "not_found", "this link is not valid any more")
		return
	}
	d, err := s.Store.GetDocument(r.Context(), s.DB, id)
	if err != nil {
		fail(w, http.StatusNotFound, "not_found", "this link is not valid any more")
		return
	}
	set, _ := s.Store.GetSettings(r.Context(), s.DB)
	formats := []string{}
	if d.Kind == model.KindInvoice && d.Status != model.StatusVoid {
		if set.Features.UBL {
			formats = append(formats, "ubl")
		}
		if set.Features.XRechnung {
			formats = append(formats, "xrechnung")
		}
	}
	writeJSON(w, http.StatusOK, map[string]any{"pay": s.Pay.Enabled(r.Context()) && payments.Payable(d) > 0, "payAmount": payments.Payable(d), "einvoice": formats})
}

// publicPay starts a Stripe Checkout for the balance and answers with its address.
func (s *Server) publicPay(w http.ResponseWriter, r *http.Request) {
	token := r.PathValue("token")
	id, err := s.Links.Lookup(r.Context(), token)
	if err != nil {
		fail(w, http.StatusNotFound, "not_found", "this link is not valid any more")
		return
	}
	d, err := s.Store.GetDocument(r.Context(), s.DB, id)
	if err != nil {
		s.problem(w, r, err)
		return
	}
	base := s.publicBase(r)
	link := base + "/d/" + token
	url, err := s.Pay.CreateCheckout(r.Context(), d, link+"?paid=1", link)
	switch {
	case errors.Is(err, payments.ErrNotAvailable):
		fail(w, http.StatusConflict, "conflict", "online payment is not available for this invoice")
		return
	case err != nil:
		s.Log.Warn("could not start an online payment", "invoice", d.FullNumber, "error", err)
		fail(w, http.StatusBadGateway, "payment_failed", err.Error())
		return
	}
	writeJSON(w, http.StatusOK, map[string]string{"url": url})
}

func (s *Server) stripeHook(w http.ResponseWriter, r *http.Request) {
	body, err := io.ReadAll(http.MaxBytesReader(w, r.Body, 1<<20))
	if err != nil {
		fail(w, http.StatusRequestEntityTooLarge, "validation", "the request is too large")
		return
	}
	err = s.Pay.HandleWebhook(r.Context(), body, r.Header.Get("Stripe-Signature"))
	switch {
	case errors.Is(err, payments.ErrSignature):
		fail(w, http.StatusBadRequest, "unauthorized", "signature does not match")
	case errors.Is(err, payments.ErrNotAvailable):
		fail(w, http.StatusNotFound, "not_found", "online payments are not set up")
	case errors.Is(err, payments.ErrInvalid):
		fail(w, http.StatusBadRequest, "validation", err.Error())
	case err != nil:
		s.problem(w, r, err) // a 5xx makes Stripe retry later
	default:
		writeJSON(w, http.StatusOK, map[string]bool{"received": true})
	}
}

// publicEInvoice lets a client download the e-invoice XML of their invoice.
func (s *Server) publicEInvoice(w http.ResponseWriter, r *http.Request) {
	id, err := s.Links.Lookup(r.Context(), r.PathValue("token"))
	if err != nil {
		fail(w, http.StatusNotFound, "not_found", "this link is not valid any more")
		return
	}
	format := r.URL.Query().Get("format")
	if format == "" {
		format = einvoice.UBL
	}
	set, _ := s.Store.GetSettings(r.Context(), s.DB)
	if (format == einvoice.UBL && !set.Features.UBL) || (format == einvoice.XRechnung && !set.Features.XRechnung) || (format != einvoice.UBL && format != einvoice.XRechnung) {
		fail(w, http.StatusForbidden, "forbidden", "this download is not offered")
		return
	}
	d, err := s.Store.GetDocument(r.Context(), s.DB, id)
	if err != nil || d.Kind != model.KindInvoice || d.Status == model.StatusVoid {
		fail(w, http.StatusNotFound, "not_found", "this link is not valid any more")
		return
	}
	x, err := einvoice.Generate(d, format)
	if err != nil {
		fail(w, http.StatusUnprocessableEntity, "einvoice_incomplete", "the sender has not filled in the details this format needs")
		return
	}
	w.Header().Set("Content-Type", "application/xml; charset=utf-8")
	w.Header().Set("Content-Disposition", fmt.Sprintf(`attachment; filename="%s-%s.xml"`, format, safeName(d.FullNumber)))
	_, _ = w.Write(x)
}
