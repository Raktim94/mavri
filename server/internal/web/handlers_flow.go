package web

import (
	"context"
	"database/sql"
	"errors"
	"net/http"
	"strings"

	"github.com/Raktim94/mavri/server/internal/activity"
	"github.com/Raktim94/mavri/server/internal/automation"
	"github.com/Raktim94/mavri/server/internal/mailer"
	"github.com/Raktim94/mavri/server/internal/model"
	"github.com/Raktim94/mavri/server/internal/share"
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
	s.Hub.Record(r.Context(), activity.Event{Action: "updated", Entity: "settings", Label: "email settings"})
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
	s.Hub.Record(r.Context(), activity.Event{Action: "updated", Entity: "settings", Label: "automation rules"})
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
