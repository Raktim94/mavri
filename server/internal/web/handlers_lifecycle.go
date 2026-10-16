package web

import (
	"net/http"

	"github.com/Raktim94/mavri/server/internal/activity"
	"github.com/Raktim94/mavri/server/internal/store"
)

// POST /api/documents/{id}/issue: lock a draft invoice. From then on only payments and voiding can change it.
func (s *Server) issueDocument(w http.ResponseWriter, r *http.Request) {
	id, ok := idOf(w, r)
	if !ok {
		return
	}
	d, err := s.Store.IssueDocument(r.Context(), id)
	if err != nil {
		s.problem(w, r, err)
		return
	}
	s.Hub.Record(r.Context(), activity.Event{Action: "issued", Entity: d.Kind, EntityID: d.ID, Label: d.FullNumber, Detail: "locked: only payments and voiding can change it now",
		Name: "invoice.issued", Data: activity.DocData(d)})
	writeJSON(w, http.StatusOK, d)
}

// GET /api/documents/{id}/corrections: the credit and debit notes that point at an invoice.
func (s *Server) listCorrections(w http.ResponseWriter, r *http.Request) {
	id, ok := idOf(w, r)
	if !ok {
		return
	}
	rows, err := s.Store.Corrections(r.Context(), id)
	if err != nil {
		s.problem(w, r, err)
		return
	}
	writeJSON(w, http.StatusOK, rows)
}

// POST /api/documents/{id}/corrections: issue a credit or debit note against an issued invoice.
func (s *Server) createCorrection(w http.ResponseWriter, r *http.Request) {
	id, ok := idOf(w, r)
	if !ok {
		return
	}
	var in store.Correction
	if !readJSON(w, r, &in) {
		return
	}
	d, err := s.Store.Correct(r.Context(), id, in)
	if err != nil {
		s.problem(w, r, err)
		return
	}
	name, label := "credit_note.created", "credit note"
	if d.DocType == "debit" {
		name, label = "debit_note.created", "debit note"
	}
	s.Hub.Record(r.Context(), activity.Event{Action: "issued a " + label, Entity: "invoice", EntityID: d.ID, Label: d.FullNumber, Detail: label + " for invoice #" + itoa(*d.Corrects), Name: name, Data: activity.DocData(d)})
	writeJSON(w, http.StatusCreated, d)
}

func itoa(n int64) string {
	if n == 0 {
		return "0"
	}
	neg := n < 0
	if neg {
		n = -n
	}
	var b []byte
	for n > 0 {
		b = append([]byte{byte('0' + n%10)}, b...)
		n /= 10
	}
	if neg {
		b = append([]byte{'-'}, b...)
	}
	return string(b)
}
