package web

import (
	"errors"
	"net/http"
	"strings"

	"github.com/Raktim94/mavri/server/internal/activity"
	"github.com/Raktim94/mavri/server/internal/reconcile"
)

// POST /api/reconcile: check a bank statement (CSV upload) against unpaid invoices. Nothing is recorded.
func (s *Server) reconcileCheck(w http.ResponseWriter, r *http.Request) {
	r.Body = http.MaxBytesReader(w, r.Body, 9<<20)
	if err := r.ParseMultipartForm(9 << 20); err != nil {
		fail(w, http.StatusBadRequest, "validation", "send the statement as a CSV file upload")
		return
	}
	file, _, err := r.FormFile("file")
	if err != nil {
		fail(w, http.StatusBadRequest, "validation", "choose a CSV file")
		return
	}
	defer file.Close()
	rep, err := reconcile.Check(r.Context(), s.Store, file)
	if errors.Is(err, reconcile.ErrInvalid) {
		fail(w, http.StatusBadRequest, "validation", strings.TrimPrefix(err.Error(), "invalid statement: "))
		return
	}
	if err != nil {
		s.problem(w, r, err)
		return
	}
	writeJSON(w, http.StatusOK, rep)
}

// POST /api/reconcile/apply: record the lines the person confirmed as payments.
func (s *Server) reconcileApply(w http.ResponseWriter, r *http.Request) {
	var in struct {
		Matches []reconcile.Apply `json:"matches"`
	}
	if !readJSON(w, r, &in) {
		return
	}
	if len(in.Matches) == 0 || len(in.Matches) > reconcile.MaxRows {
		fail(w, http.StatusBadRequest, "validation", "confirm at least one line")
		return
	}
	results := reconcile.ApplyAll(r.Context(), s.Store, in.Matches)
	done := 0
	for i, res := range results {
		if !res.OK {
			continue
		}
		done++
		if d, err := s.Store.GetDocument(r.Context(), s.DB, in.Matches[i].InvoiceID); err == nil {
			s.Hub.Record(r.Context(), activity.Event{Action: "payment recorded", Entity: d.Kind, EntityID: d.ID, Label: d.FullNumber,
				Detail: "matched from a bank statement", Name: "payment.recorded", Data: activity.DocData(d)})
			if d.Status == "paid" {
				s.Hub.Record(r.Context(), activity.Event{Action: "paid", Entity: d.Kind, EntityID: d.ID, Label: d.FullNumber, Name: "invoice.paid", Data: activity.DocData(d)})
			}
		}
	}
	writeJSON(w, http.StatusOK, map[string]any{"results": results, "recorded": done})
}
