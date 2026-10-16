package web

import (
	"errors"
	"net/http"
	"strings"

	"github.com/Raktim94/mavri/server/internal/activity"
	"github.com/Raktim94/mavri/server/internal/collections"
	"github.com/Raktim94/mavri/server/internal/paymentqr"
)

func (s *Server) collectProblem(w http.ResponseWriter, r *http.Request, err error) {
	switch {
	case errors.Is(err, collections.ErrInvalid):
		fail(w, http.StatusBadRequest, "validation", strings.TrimPrefix(err.Error(), "invalid: "))
	case errors.Is(err, collections.ErrNotFound):
		fail(w, http.StatusNotFound, "not_found", "not found")
	default:
		s.problem(w, r, err)
	}
}

// GET /api/attention: the daily list of unpaid invoices that need a person.
func (s *Server) attention(w http.ResponseWriter, r *http.Request) {
	a, err := s.Coll.Attention(r.Context())
	if err != nil {
		s.problem(w, r, err)
		return
	}
	writeJSON(w, http.StatusOK, a)
}

func (s *Server) listFollowUps(w http.ResponseWriter, r *http.Request) {
	id, ok := idOf(w, r)
	if !ok {
		return
	}
	rows, err := s.Coll.List(r.Context(), id)
	if err != nil {
		s.problem(w, r, err)
		return
	}
	writeJSON(w, http.StatusOK, rows)
}

func (s *Server) addFollowUp(w http.ResponseWriter, r *http.Request) {
	id, ok := idOf(w, r)
	if !ok {
		return
	}
	var in collections.Input
	if !readJSON(w, r, &in) {
		return
	}
	f, err := s.Coll.Add(r.Context(), id, in)
	if err != nil {
		s.collectProblem(w, r, err)
		return
	}
	writeJSON(w, http.StatusCreated, f)
}

func (s *Server) resolveFollowUp(w http.ResponseWriter, r *http.Request) {
	id, ok := idOf(w, r)
	if !ok {
		return
	}
	f, err := s.Coll.Resolve(r.Context(), id)
	if err != nil {
		s.collectProblem(w, r, err)
		return
	}
	writeJSON(w, http.StatusOK, f)
}

// GET /api/documents/{id}/payment-options: the ways to pay what is still owed.
func (s *Server) paymentOptions(w http.ResponseWriter, r *http.Request) {
	id, ok := idOf(w, r)
	if !ok {
		return
	}
	d, err := s.Store.GetDocument(r.Context(), s.DB, id)
	if err != nil {
		s.problem(w, r, err)
		return
	}
	writeJSON(w, http.StatusOK, optionsOf(paymentqr.For(d)))
}

func optionsOf(o []paymentqr.Option) []paymentqr.Option {
	if o == nil {
		return []paymentqr.Option{}
	}
	return o
}

// GET /api/public/documents/{token}/payment-options: the same, for the client page.
func (s *Server) publicPaymentOptions(w http.ResponseWriter, r *http.Request) {
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
	writeJSON(w, http.StatusOK, optionsOf(paymentqr.For(d)))
}

// publicInvoiceResponse handles what a client says about an invoice from the secure link:
// they need help or dispute it, or they promise to pay on a date. It changes no amounts and no status.
func (s *Server) publicInvoiceResponse(w http.ResponseWriter, r *http.Request, docID int64, action, message, date string) {
	ctx := activity.WithSource(r.Context(), activity.SourcePublic, "client link")
	in := collections.Input{Note: message}
	switch action {
	case "dispute":
		in.Kind = collections.Dispute
	case "promise":
		in.Kind, in.DueOn = collections.Promise, date
		if in.Note == "" {
			in.Note = "Promised by the client on the secure link"
		}
	default:
		fail(w, http.StatusBadRequest, "validation", "action must be dispute or promise for an invoice")
		return
	}
	if len(in.Note) > 500 {
		in.Note = in.Note[:500]
	}
	f, err := s.Coll.Add(ctx, docID, in)
	if err != nil {
		s.collectProblem(w, r, err)
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"ok": true, "kind": f.Kind})
}
