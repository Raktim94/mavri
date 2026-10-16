package web

import (
	"net/http"

	"github.com/Raktim94/mavri/server/internal/taxpack"
)

// GET /api/tax/packs: the tax guidance Mavri has, with each pack's status, source and rates.
func (s *Server) taxPacks(w http.ResponseWriter, r *http.Request) {
	day := r.URL.Query().Get("date")
	type view struct {
		taxpack.Pack
		Rates []taxpack.Rate `json:"rates"`
	}
	out := []view{}
	for _, p := range taxpack.Packs() {
		out = append(out, view{Pack: p, Rates: p.RatesOn(day)})
	}
	writeJSON(w, http.StatusOK, out)
}

// POST /api/tax/explain: what usually applies to a sale and why. It decides nothing and stores nothing.
func (s *Server) taxExplain(w http.ResponseWriter, r *http.Request) {
	var f taxpack.Facts
	if !readJSON(w, r, &f) {
		return
	}
	writeJSON(w, http.StatusOK, taxpack.Explain(f))
}

// GET /api/tax/validate?country=IN&id=...: read a tax registration number.
func (s *Server) taxValidate(w http.ResponseWriter, r *http.Request) {
	writeJSON(w, http.StatusOK, taxpack.CheckID(r.URL.Query().Get("country"), r.URL.Query().Get("id")))
}
