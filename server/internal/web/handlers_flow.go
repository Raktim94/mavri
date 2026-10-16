package web

import (
	"context"
	"database/sql"
	"errors"
	"fmt"
	"net/http"
	"strings"

	"github.com/Raktim94/mavri/server/internal/activity"
	"github.com/Raktim94/mavri/server/internal/automation"
	"github.com/Raktim94/mavri/server/internal/mailer"
	"github.com/Raktim94/mavri/server/internal/model"
	"github.com/Raktim94/mavri/server/internal/share"
	"github.com/Raktim94/mavri/server/internal/store"
)

// recordChange writes the history and queues the webhooks for a document that was created (old == nil) or changed.
func (s *Server) recordChange(ctx context.Context, old *model.Document, cur model.Document) {
	for _, e := range activity.DocEvents(old, cur) {
		s.Hub.Record(ctx, e)
	}
}

// publicBase is the address clients should use: the configured public address, else the one this request came in on.
func (s *Server) publicBase(r *http.Request) string {
	if c, err := s.Auto.Load(r.Context()); err == nil && c.PublicURL != "" {
		return c.PublicURL
	}
	return s.baseURL(r)
}

// flowProblem maps errors from the workflow packages.
func (s *Server) flowProblem(w http.ResponseWriter, r *http.Request, err error) {
	switch {
	case errors.Is(err, mailer.ErrNotConfigured):
		fail(w, http.StatusConflict, "email_not_configured", err.Error())
	case errors.Is(err, mailer.ErrInvalid), errors.Is(err, automation.ErrInvalid), errors.Is(err, activity.ErrInvalid):
		fail(w, http.StatusBadRequest, "validation", strings.TrimPrefix(err.Error(), "invalid: "))
	case errors.Is(err, activity.ErrNotFound):
		fail(w, http.StatusNotFound, "not_found", "not found")
	case strings.HasPrefix(err.Error(), "the email could not be sent"):
		fail(w, http.StatusBadGateway, "email_failed", err.Error())
	default:
		s.problem(w, r, err)
	}
}

func idOf(w http.ResponseWriter, r *http.Request) (int64, bool) {
	id, ok := pathID(r)
	if !ok {
		fail(w, http.StatusBadRequest, "validation", "bad id")
	}
	return id, ok
}

// ---- share links -------------------------------------------------------------

type shareView struct {
	URL           string `json:"url"`
	Token         string `json:"token"`
	CreatedAt     string `json:"createdAt"`
	FirstViewedAt string `json:"firstViewedAt"`
	LastViewedAt  string `json:"lastViewedAt"`
	Views         int    `json:"views"`
}

func (s *Server) shareOf(r *http.Request, k share.Link) shareView {
	return shareView{URL: s.publicBase(r) + "/d/" + k.Token, Token: k.Token, CreatedAt: k.CreatedAt, FirstViewedAt: k.FirstViewedAt, LastViewedAt: k.LastViewedAt, Views: k.Views}
}

func (s *Server) getShare(w http.ResponseWriter, r *http.Request) {
	id, ok := idOf(w, r)
	if !ok {
		return
	}
	k, found, err := s.Links.Active(r.Context(), id)
	if err != nil {
		s.problem(w, r, err)
		return
	}
	if !found {
		writeJSON(w, http.StatusOK, map[string]any{"link": nil})
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"link": s.shareOf(r, k)})
}

func (s *Server) createShare(w http.ResponseWriter, r *http.Request) {
	id, ok := idOf(w, r)
	if !ok {
		return
	}
	d, err := s.Store.GetDocument(r.Context(), s.DB, id)
	if err != nil {
		s.problem(w, r, err)
		return
	}
	if d.Status == model.StatusDraft {
		fail(w, http.StatusBadRequest, "validation", "this invoice is a draft; issue it before sharing it")
		return
	}
	k, created, err := s.Links.Ensure(r.Context(), id)
	if err != nil {
		s.problem(w, r, err)
		return
	}
	if created {
		s.Hub.Record(r.Context(), activity.Event{Action: "shared", Entity: d.Kind, EntityID: id, Label: d.FullNumber, Detail: "secure client link created", Name: "document.shared", Data: activity.DocData(d)})
	}
	writeJSON(w, http.StatusOK, map[string]any{"link": s.shareOf(r, k)})
}

func (s *Server) revokeShare(w http.ResponseWriter, r *http.Request) {
	id, ok := idOf(w, r)
	if !ok {
		return
	}
	d, err := s.Store.GetDocument(r.Context(), s.DB, id)
	if err != nil {
		s.problem(w, r, err)
		return
	}
	if err := s.Links.Revoke(r.Context(), id); err != nil {
		s.problem(w, r, err)
		return
	}
	s.Hub.Record(r.Context(), activity.Event{Action: "link revoked", Entity: d.Kind, EntityID: id, Label: d.FullNumber})
	w.WriteHeader(http.StatusNoContent)
}

// ---- email -------------------------------------------------------------------

type emailIn struct {
	Kind    string `json:"kind"` // "send" or "reminder"
	To      string `json:"to"`
	Subject string `json:"subject"`
	Body    string `json:"body"`
}

func (s *Server) mailRequest(r *http.Request, id int64, in emailIn) mailer.Request {
	req := mailer.Request{DocumentID: id, Kind: in.Kind, To: in.To, Subject: in.Subject, Body: in.Body, BaseURL: s.publicBase(r)}
	if in.Kind == "reminder" {
		if d, err := s.Store.GetDocument(r.Context(), s.DB, id); err == nil {
			req.When = s.Auto.WhenText(d)
		}
	}
	return req
}

func (s *Server) emailPreview(w http.ResponseWriter, r *http.Request) {
	id, ok := idOf(w, r)
	if !ok {
		return
	}
	var in emailIn
	_ = readJSONOptional(r, &in)
	res, body, err := s.Mail.Preview(r.Context(), s.mailRequest(r, id, in))
	if err != nil {
		s.flowProblem(w, r, err)
		return
	}
	cfg, _ := s.Mail.Load(r.Context())
	writeJSON(w, http.StatusOK, map[string]any{"to": res.To, "subject": res.Subject, "body": body, "link": res.Link, "configured": cfg.Enabled && cfg.Host != ""})
}

func (s *Server) emailSend(w http.ResponseWriter, r *http.Request) {
	id, ok := idOf(w, r)
	if !ok {
		return
	}
	var in emailIn
	if !readJSON(w, r, &in) {
		return
	}
	if d, err := s.Store.GetDocument(r.Context(), s.DB, id); err == nil && d.Status == model.StatusDraft {
		fail(w, http.StatusBadRequest, "validation", "this invoice is a draft; issue it before sending it")
		return
	}
	// The user reviewed the preview, so the texts they send are final: render placeholders only once.
	req := s.mailRequest(r, id, in)
	res, err := s.Mail.SendDocument(r.Context(), req)
	if err != nil {
		s.flowProblem(w, r, err)
		return
	}
	writeJSON(w, http.StatusOK, res)
}

func (s *Server) documentMail(w http.ResponseWriter, r *http.Request) {
	id, ok := idOf(w, r)
	if !ok {
		return
	}
	rows, err := s.Mail.Log(r.Context(), id, 50)
	if err != nil {
		s.problem(w, r, err)
		return
	}
	writeJSON(w, http.StatusOK, rows)
}

func (s *Server) mailLog(w http.ResponseWriter, r *http.Request) {
	rows, err := s.Mail.Log(r.Context(), 0, qint(r, "limit", 100))
	if err != nil {
		s.problem(w, r, err)
		return
	}
	writeJSON(w, http.StatusOK, rows)
}

func (s *Server) getMailConfig(w http.ResponseWriter, r *http.Request) {
	cfg, err := s.Mail.Load(r.Context())
	if err != nil {
		s.problem(w, r, err)
		return
	}
	writeJSON(w, http.StatusOK, cfg)
}

func (s *Server) putMailConfig(w http.ResponseWriter, r *http.Request) {
	var in mailer.Config
	if !readJSON(w, r, &in) {
		return
	}
	if err := s.Mail.Save(r.Context(), in); err != nil {
		s.flowProblem(w, r, err)
		return
	}
	s.Hub.Record(r.Context(), activity.Event{Action: "changed", Entity: "settings", Detail: "email settings"})
	s.getMailConfig(w, r)
}

func (s *Server) mailTest(w http.ResponseWriter, r *http.Request) {
	var in struct {
		To string `json:"to"`
	}
	if !readJSON(w, r, &in) {
		return
	}
	if err := s.Mail.SendTest(r.Context(), in.To); err != nil {
		s.flowProblem(w, r, err)
		return
	}
	w.WriteHeader(http.StatusNoContent)
}

// ---- automation --------------------------------------------------------------

func (s *Server) getAutomation(w http.ResponseWriter, r *http.Request) {
	cfg, err := s.Auto.Load(r.Context())
	if err != nil {
		s.problem(w, r, err)
		return
	}
	writeJSON(w, http.StatusOK, cfg)
}

func (s *Server) putAutomation(w http.ResponseWriter, r *http.Request) {
	var in automation.Config
	if !readJSON(w, r, &in) {
		return
	}
	out, err := s.Auto.Save(r.Context(), in)
	if err != nil {
		s.flowProblem(w, r, err)
		return
	}
	s.Hub.Record(r.Context(), activity.Event{Action: "changed", Entity: "settings", Detail: "automation rules"})
	writeJSON(w, http.StatusOK, out)
}

func (s *Server) overdue(w http.ResponseWriter, r *http.Request) {
	items, err := s.Auto.Overdue(r.Context())
	if err != nil {
		s.problem(w, r, err)
		return
	}
	writeJSON(w, http.StatusOK, items)
}

func (s *Server) listRecurring(w http.ResponseWriter, r *http.Request) {
	list, err := s.Auto.List(r.Context())
	if err != nil {
		s.problem(w, r, err)
		return
	}
	writeJSON(w, http.StatusOK, list)
}

func (s *Server) createRecurring(w http.ResponseWriter, r *http.Request) {
	var in automation.Schedule
	if !readJSON(w, r, &in) {
		return
	}
	sc, err := s.Auto.Create(r.Context(), in)
	if err != nil {
		s.flowProblem(w, r, err)
		return
	}
	s.Hub.Record(r.Context(), activity.Event{Action: "scheduled", Entity: "recurring invoice", EntityID: sc.ID, Detail: "every " + sc.Every + " from " + sc.StartOn})
	writeJSON(w, http.StatusCreated, sc)
}

func (s *Server) updateRecurring(w http.ResponseWriter, r *http.Request) {
	id, ok := idOf(w, r)
	if !ok {
		return
	}
	var in automation.Schedule
	if !readJSON(w, r, &in) {
		return
	}
	if err := s.Auto.Update(r.Context(), id, in.Active, in.EndOn, in.AutoSend); err != nil {
		if errors.Is(err, errNoRows) {
			fail(w, http.StatusNotFound, "not_found", "not found")
			return
		}
		s.flowProblem(w, r, err)
		return
	}
	s.Hub.Record(r.Context(), activity.Event{Action: "updated", Entity: "recurring invoice", EntityID: id})
	w.WriteHeader(http.StatusNoContent)
}

func (s *Server) deleteRecurring(w http.ResponseWriter, r *http.Request) {
	id, ok := idOf(w, r)
	if !ok {
		return
	}
	if err := s.Auto.Delete(r.Context(), id); err != nil {
		if errors.Is(err, errNoRows) {
			fail(w, http.StatusNotFound, "not_found", "not found")
			return
		}
		s.problem(w, r, err)
		return
	}
	s.Hub.Record(r.Context(), activity.Event{Action: "deleted", Entity: "recurring invoice", EntityID: id})
	w.WriteHeader(http.StatusNoContent)
}

func (s *Server) previewDraftRecurring(w http.ResponseWriter, r *http.Request) {
	var in automation.Schedule
	if !readJSON(w, r, &in) {
		return
	}
	p, err := s.Auto.PreviewDraft(r.Context(), in, qint(r, "n", 6))
	if err != nil {
		s.flowProblem(w, r, err)
		return
	}
	writeJSON(w, http.StatusOK, p)
}

func (s *Server) previewRecurring(w http.ResponseWriter, r *http.Request) {
	id, ok := idOf(w, r)
	if !ok {
		return
	}
	p, err := s.Auto.Preview(r.Context(), id, qint(r, "n", 6))
	if errors.Is(err, errNoRows) {
		fail(w, http.StatusNotFound, "not_found", "not found")
		return
	}
	if err != nil {
		s.problem(w, r, err)
		return
	}
	writeJSON(w, http.StatusOK, p)
}

// ---- activity ----------------------------------------------------------------

func activityFilter(r *http.Request) activity.Filter {
	q := r.URL.Query()
	return activity.Filter{Source: q.Get("source"), Entity: q.Get("entity"), Query: q.Get("q"), From: q.Get("from"), To: q.Get("to"),
		EntityID: int64(qint(r, "entityId", 0)), Limit: qint(r, "limit", 100), Offset: qint(r, "offset", 0)}
}

func (s *Server) listActivity(w http.ResponseWriter, r *http.Request) {
	f := activityFilter(r)
	items, total, err := s.Hub.List(r.Context(), f)
	if err != nil {
		s.problem(w, r, err)
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"items": items, "total": total, "limit": f.Limit, "offset": f.Offset})
}

func (s *Server) activityCSV(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "text/csv; charset=utf-8")
	w.Header().Set("Content-Disposition", `attachment; filename="mavri-activity.csv"`)
	s.Hub.Record(r.Context(), activity.Event{Action: "exported", Entity: "activity", Label: "activity history (CSV)"})
	if err := s.Hub.WriteCSV(r.Context(), w, activityFilter(r)); err != nil {
		s.Log.Error("activity export failed", "error", err)
	}
}

// ---- webhooks ----------------------------------------------------------------

func (s *Server) listWebhooks(w http.ResponseWriter, r *http.Request) {
	eps, err := s.Hub.Endpoints(r.Context())
	if err != nil {
		s.problem(w, r, err)
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"endpoints": eps, "events": activity.Events})
}

type hookIn struct {
	URL         string   `json:"url"`
	Description string   `json:"description"`
	Events      []string `json:"events"`
	Active      bool     `json:"active"`
}

func (s *Server) createWebhook(w http.ResponseWriter, r *http.Request) {
	var in hookIn
	if !readJSON(w, r, &in) {
		return
	}
	ep, secret, err := s.Hub.CreateEndpoint(r.Context(), in.URL, in.Description, in.Events)
	if err != nil {
		s.flowProblem(w, r, err)
		return
	}
	s.Hub.Record(r.Context(), activity.Event{Action: "created", Entity: "webhook", EntityID: ep.ID, Label: ep.URL})
	writeJSON(w, http.StatusCreated, map[string]any{"endpoint": ep, "secret": secret})
}

func (s *Server) updateWebhook(w http.ResponseWriter, r *http.Request) {
	id, ok := idOf(w, r)
	if !ok {
		return
	}
	var in hookIn
	if !readJSON(w, r, &in) {
		return
	}
	if err := s.Hub.UpdateEndpoint(r.Context(), id, in.URL, in.Description, in.Events, in.Active); err != nil {
		s.flowProblem(w, r, err)
		return
	}
	s.Hub.Record(r.Context(), activity.Event{Action: "updated", Entity: "webhook", EntityID: id, Label: in.URL})
	w.WriteHeader(http.StatusNoContent)
}

func (s *Server) deleteWebhook(w http.ResponseWriter, r *http.Request) {
	id, ok := idOf(w, r)
	if !ok {
		return
	}
	if err := s.Hub.DeleteEndpoint(r.Context(), id); err != nil {
		s.flowProblem(w, r, err)
		return
	}
	s.Hub.Record(r.Context(), activity.Event{Action: "deleted", Entity: "webhook", EntityID: id})
	w.WriteHeader(http.StatusNoContent)
}

func (s *Server) testWebhook(w http.ResponseWriter, r *http.Request) {
	id, ok := idOf(w, r)
	if !ok {
		return
	}
	did, err := s.Hub.SendTest(r.Context(), id)
	if err != nil {
		s.flowProblem(w, r, err)
		return
	}
	writeJSON(w, http.StatusAccepted, map[string]int64{"deliveryId": did})
}

func (s *Server) listDeliveries(w http.ResponseWriter, r *http.Request) {
	ds, err := s.Hub.Deliveries(r.Context(), int64(qint(r, "endpointId", 0)), r.URL.Query().Get("status"), qint(r, "limit", 100))
	if err != nil {
		s.problem(w, r, err)
		return
	}
	writeJSON(w, http.StatusOK, ds)
}

func (s *Server) replayDelivery(w http.ResponseWriter, r *http.Request) {
	id, ok := idOf(w, r)
	if !ok {
		return
	}
	did, err := s.Hub.Replay(r.Context(), id)
	if err != nil {
		s.flowProblem(w, r, err)
		return
	}
	s.Hub.Record(r.Context(), activity.Event{Action: "replayed", Entity: "webhook delivery", EntityID: id})
	writeJSON(w, http.StatusAccepted, map[string]int64{"deliveryId": did})
}

var errNoRows = sql.ErrNoRows

// ---- bulk actions ------------------------------------------------------------

type bulkResult struct {
	ID      int64  `json:"id"`
	Number  string `json:"number"`
	OK      bool   `json:"ok"`
	Message string `json:"message"`
}

const maxBulk = 200

// bulkDocuments applies one action to many documents and reports each outcome, so one bad row never hides the rest.
func (s *Server) bulkDocuments(w http.ResponseWriter, r *http.Request) {
	var in struct {
		IDs    []int64 `json:"ids"`
		Action string  `json:"action"` // email, remind, paid, void
	}
	if !readJSON(w, r, &in) {
		return
	}
	if len(in.IDs) == 0 || len(in.IDs) > maxBulk {
		fail(w, http.StatusBadRequest, "validation", "choose between 1 and 200 documents")
		return
	}
	switch in.Action {
	case "email", "remind", "paid", "void":
	default:
		fail(w, http.StatusBadRequest, "validation", "action must be email, remind, paid or void")
		return
	}
	ctx := r.Context()
	if in.Action == "email" || in.Action == "remind" {
		if cfg, err := s.Mail.Load(ctx); err != nil || !cfg.Enabled || cfg.Host == "" {
			fail(w, http.StatusConflict, "email_not_configured", mailer.ErrNotConfigured.Error())
			return
		}
	}
	base := s.publicBase(r)
	results := make([]bulkResult, 0, len(in.IDs))
	seen := map[int64]bool{}
	okCount := 0
	for _, id := range in.IDs {
		if seen[id] {
			continue
		}
		seen[id] = true
		res := bulkResult{ID: id}
		d, err := s.Store.GetDocument(ctx, s.DB, id)
		if err != nil {
			res.Message = "not found"
			results = append(results, res)
			continue
		}
		res.Number = d.FullNumber
		res.OK, res.Message = s.bulkOne(r, in.Action, d, base)
		if res.OK {
			okCount++
		}
		results = append(results, res)
	}
	s.Hub.Record(ctx, activity.Event{Action: "bulk " + in.Action, Entity: "documents", Detail: fmt.Sprintf("%d of %d succeeded", okCount, len(results))})
	writeJSON(w, http.StatusOK, map[string]any{"results": results, "ok": okCount, "failed": len(results) - okCount})
}

func (s *Server) bulkOne(r *http.Request, action string, d model.Document, base string) (bool, string) {
	ctx := r.Context()
	owed := d.Kind == model.KindInvoice && (d.Status == model.StatusUnpaid || d.Status == model.StatusPartial)
	switch action {
	case "email":
		if d.Status == model.StatusVoid {
			return false, "void documents are not sent"
		}
		if strings.TrimSpace(d.Customer.Email) == "" {
			return false, "the customer has no email address"
		}
		if _, err := s.Mail.SendDocument(ctx, mailer.Request{DocumentID: d.ID, BaseURL: base}); err != nil {
			return false, err.Error()
		}
		return true, "sent to " + d.Customer.Email
	case "remind":
		if !owed {
			return false, "nothing is owed on this document"
		}
		if strings.TrimSpace(d.Customer.Email) == "" {
			return false, "the customer has no email address"
		}
		if _, err := s.Mail.SendDocument(ctx, mailer.Request{DocumentID: d.ID, Kind: "reminder", BaseURL: base, When: s.Auto.WhenText(d)}); err != nil {
			return false, err.Error()
		}
		return true, "reminder sent to " + d.Customer.Email
	case "paid":
		if !owed {
			return false, "nothing is owed on this document"
		}
		old := d
		d.Payments = append(append([]model.Payment{}, d.Payments...), model.Payment{AmountCents: d.Totals.TotalCents - d.PaidCents, PaidOn: s.Store.Today(), Method: "marked paid"})
		out, err := s.Store.UpdateDocument(ctx, d.ID, d, store.SaveOptions{})
		if err != nil {
			return false, err.Error()
		}
		s.recordChange(ctx, &old, out)
		return true, "marked paid"
	case "void":
		if d.Kind != model.KindInvoice || d.Status == model.StatusVoid {
			return false, "only an invoice that is not void can be voided"
		}
		old := d
		d.Status = model.StatusVoid
		out, err := s.Store.UpdateDocument(ctx, d.ID, d, store.SaveOptions{})
		if err != nil {
			return false, err.Error()
		}
		s.recordChange(ctx, &old, out)
		return true, "voided"
	}
	return false, "unknown action"
}
