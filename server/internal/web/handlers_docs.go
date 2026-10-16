package web

import (
	"errors"
	"fmt"
	"net/http"
	"strconv"

	"github.com/Raktim94/mavri/server/internal/activity"
	"github.com/Raktim94/mavri/server/internal/einvoice"
	"github.com/Raktim94/mavri/server/internal/irp"
	"github.com/Raktim94/mavri/server/internal/model"
	"github.com/Raktim94/mavri/server/internal/store"
)

func qint(r *http.Request, name string, def int) int {
	if v, err := strconv.Atoi(r.URL.Query().Get(name)); err == nil && v >= 0 {
		return v
	}
	return def
}

func (s *Server) listDocuments(w http.ResponseWriter, r *http.Request) {
	q := r.URL.Query()
	kind := q.Get("kind")
	if kind == "" {
		kind = q.Get("type") // the public API accepts either name
	}
	if kind == "quotation" {
		kind = model.KindQuote
	}
	limit := qint(r, "limit", 200)
	if limit > 1000 {
		limit = 1000
	}
	f := store.Filter{Kind: kind, Status: q.Get("status"), Query: q.Get("q"), From: q.Get("from"), To: q.Get("to"),
		CustomerID: int64(qint(r, "customerId", 0)), Currency: q.Get("currency"), DocType: q.Get("docType"), Limit: limit, Offset: qint(r, "offset", 0)}
	switch ch := q.Get("channel"); ch {
	case "", "all":
	case "manual":
		f.ShopID = -1
	default:
		if n, err := strconv.ParseInt(ch, 10, 64); err == nil && n > 0 {
			f.ShopID = n
		}
	}
	items, total, err := s.Store.ListDocuments(r.Context(), f)
	if err != nil {
		s.problem(w, r, err)
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"items": items, "total": total, "limit": f.Limit, "offset": f.Offset})
}

func (s *Server) nextNumber(w http.ResponseWriter, r *http.Request) {
	kind := r.URL.Query().Get("kind")
	if kind != model.KindInvoice && kind != model.KindQuote {
		fail(w, http.StatusBadRequest, "validation", "kind must be invoice or quote")
		return
	}
	issuer := int64(qint(r, "issuerId", 0))
	prefix, suffix, err := s.Store.DefaultAffixes(r.Context(), s.DB, kind)
	if err != nil {
		s.problem(w, r, err)
		return
	}
	n, err := s.Store.NextNumber(r.Context(), s.DB, issuer, kind, prefix, suffix)
	if err != nil {
		s.problem(w, r, err)
		return
	}
	writeJSON(w, http.StatusOK, map[string]string{"prefix": prefix, "number": n, "suffix": suffix})
}

func saveOptions(r *http.Request) store.SaveOptions {
	return store.SaveOptions{RefreshDetails: r.URL.Query().Get("refresh") == "1"}
}

func (s *Server) createDocument(w http.ResponseWriter, r *http.Request) {
	var d model.Document
	if !readJSON(w, r, &d) {
		return
	}
	out, err := s.Store.CreateDocument(r.Context(), d, saveOptions(r))
	if err != nil {
		s.problem(w, r, err)
		return
	}
	s.recordChange(r.Context(), nil, out)
	writeJSON(w, http.StatusCreated, out)
}

func (s *Server) getDocument(w http.ResponseWriter, r *http.Request) {
	id, ok := pathID(r)
	if !ok {
		fail(w, http.StatusBadRequest, "validation", "bad id")
		return
	}
	d, err := s.Store.GetDocument(r.Context(), s.DB, id)
	if err != nil {
		s.problem(w, r, err)
		return
	}
	writeJSON(w, http.StatusOK, d)
}

func (s *Server) updateDocument(w http.ResponseWriter, r *http.Request) {
	id, ok := pathID(r)
	if !ok {
		fail(w, http.StatusBadRequest, "validation", "bad id")
		return
	}
	var d model.Document
	if !readJSON(w, r, &d) {
		return
	}
	old, _ := s.Store.GetDocument(r.Context(), s.DB, id)
	out, err := s.Store.UpdateDocument(r.Context(), id, d, saveOptions(r))
	if err != nil {
		s.problem(w, r, err)
		return
	}
	s.recordChange(r.Context(), &old, out)
	if out.Kind == model.KindQuote && old.Status != model.StatusAccepted && out.Status == model.StatusAccepted {
		if _, err := s.Auto.OnQuoteAccepted(r.Context(), out.ID); err != nil {
			s.Log.Warn("could not draft the invoice for an accepted quote", "error", err)
		}
	}
	writeJSON(w, http.StatusOK, out)
}

func (s *Server) deleteDocument(w http.ResponseWriter, r *http.Request) {
	id, ok := pathID(r)
	if !ok {
		fail(w, http.StatusBadRequest, "validation", "bad id")
		return
	}
	old, _ := s.Store.GetDocument(r.Context(), s.DB, id)
	if err := s.Store.DeleteDocument(r.Context(), id); err != nil {
		s.problem(w, r, err)
		return
	}
	s.Hub.Record(r.Context(), activity.Event{Action: "deleted", Entity: old.Kind, EntityID: id, Label: old.FullNumber, Name: old.Kind + ".deleted", Data: activity.DocData(old)})
	w.WriteHeader(http.StatusNoContent)
}

func (s *Server) duplicateDocument(w http.ResponseWriter, r *http.Request) {
	id, ok := pathID(r)
	if !ok {
		fail(w, http.StatusBadRequest, "validation", "bad id")
		return
	}
	d, err := s.Store.Duplicate(r.Context(), id)
	if err != nil {
		s.problem(w, r, err)
		return
	}
	s.recordChange(r.Context(), nil, d)
	writeJSON(w, http.StatusCreated, d)
}

func (s *Server) convertDocument(w http.ResponseWriter, r *http.Request) {
	id, ok := pathID(r)
	if !ok {
		fail(w, http.StatusBadRequest, "validation", "bad id")
		return
	}
	d, err := s.Store.Convert(r.Context(), id)
	if err != nil {
		s.problem(w, r, err)
		return
	}
	s.recordChange(r.Context(), nil, d)
	s.Hub.Record(r.Context(), activity.Event{Action: "accepted", Entity: "quote", EntityID: *d.ConvertedFrom, Detail: "converted to invoice " + d.FullNumber, Name: "quote.accepted",
		Data: map[string]any{"quoteId": *d.ConvertedFrom, "invoice": activity.DocData(d)["document"]}})
	writeJSON(w, http.StatusCreated, d)
}

func (s *Server) einvoice(w http.ResponseWriter, r *http.Request) {
	id, ok := pathID(r)
	if !ok {
		fail(w, http.StatusBadRequest, "validation", "bad id")
		return
	}
	format := r.URL.Query().Get("format")
	if format == "" {
		format = einvoice.UBL
	}
	set, err := s.Store.GetSettings(r.Context(), s.DB)
	if err != nil {
		s.problem(w, r, err)
		return
	}
	if (format == einvoice.UBL && !set.Features.UBL) || (format == einvoice.XRechnung && !set.Features.XRechnung) {
		fail(w, http.StatusForbidden, "forbidden", "this export is switched off in Settings")
		return
	}
	d, err := s.Store.GetDocument(r.Context(), s.DB, id)
	if err != nil {
		s.problem(w, r, err)
		return
	}
	if format == "irp-json" {
		out, err := irp.Generate(d)
		var problems irp.Problems
		if errors.As(err, &problems) {
			writeJSON(w, http.StatusUnprocessableEntity, map[string]apiError{"error": {Code: "einvoice_incomplete",
				Message: "this invoice is missing details the Indian e-invoice file needs", Problems: problems}})
			return
		}
		if err != nil {
			fail(w, http.StatusBadRequest, "validation", err.Error())
			return
		}
		s.Hub.Record(r.Context(), activity.Event{Action: "exported", Entity: d.Kind, EntityID: d.ID, Label: d.FullNumber, Detail: "India e-invoice JSON (prepared for upload; not registered)"})
		w.Header().Set("Content-Type", "application/json; charset=utf-8")
		w.Header().Set("Content-Disposition", fmt.Sprintf(`attachment; filename="irp-%s.json"`, safeName(d.FullNumber)))
		_, _ = w.Write(out)
		return
	}
	if d.DocType == "credit" || d.DocType == "debit" || d.Status == model.StatusDraft {
		fail(w, http.StatusBadRequest, "validation", "the UBL and XRechnung export is for issued invoices; credit and debit notes are not supported there yet")
		return
	}
	s.Hub.Record(r.Context(), activity.Event{Action: "exported", Entity: d.Kind, EntityID: d.ID, Label: d.FullNumber, Detail: format + " e-invoice"})
	xml, err := einvoice.Generate(d, format)
	var problems einvoice.Problems
	if errors.As(err, &problems) {
		writeJSON(w, http.StatusUnprocessableEntity, map[string]apiError{"error": {Code: "einvoice_incomplete",
			Message: "the document is missing details this e-invoice format needs", Problems: problems}})
		return
	}
	if err != nil {
		fail(w, http.StatusBadRequest, "validation", err.Error())
		return
	}
	w.Header().Set("Content-Type", "application/xml; charset=utf-8")
	w.Header().Set("Content-Disposition", fmt.Sprintf(`attachment; filename="%s-%s.xml"`, format, safeName(d.FullNumber)))
	_, _ = w.Write(xml)
}

func safeName(s string) string {
	out := []rune{}
	for _, r := range s {
		if r >= 'a' && r <= 'z' || r >= 'A' && r <= 'Z' || r >= '0' && r <= '9' || r == '-' || r == '_' || r == '.' {
			out = append(out, r)
		} else {
			out = append(out, '_')
		}
	}
	return string(out)
}

func (s *Server) yearReport(w http.ResponseWriter, r *http.Request) {
	year := r.URL.Query().Get("year")
	if len(year) != 4 {
		year = s.Store.Today()[:4]
	}
	rep, err := s.Store.YearReport(r.Context(), year)
	if err != nil {
		s.problem(w, r, err)
		return
	}
	writeJSON(w, http.StatusOK, rep)
}
