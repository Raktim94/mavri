package web

import (
	"net/http"
	"strings"
	"time"

	"github.com/Raktim94/mavri/server/internal/activity"
	"github.com/Raktim94/mavri/server/internal/store"
	"github.com/Raktim94/mavri/server/internal/taxpack"
	"github.com/Raktim94/mavri/server/internal/vies"
)

type taxCheck struct {
	ID        int64  `json:"id"`
	PartyID   int64  `json:"partyId"`
	Provider  string `json:"provider"`
	TaxID     string `json:"taxId"`
	Result    string `json:"result"`
	Name      string `json:"name"`
	Address   string `json:"address"`
	Message   string `json:"message"`
	CheckedAt string `json:"checkedAt"`
}

// GET /api/parties/{id}/tax-checks: what official services said about this party's tax number, newest first.
func (s *Server) listTaxChecks(w http.ResponseWriter, r *http.Request) {
	id, ok := idOf(w, r)
	if !ok {
		return
	}
	rows, err := s.DB.QueryContext(r.Context(), `SELECT id, party_id, provider, tax_id, result, name, address, message, checked_at FROM tax_checks WHERE party_id = ? ORDER BY id DESC LIMIT 20`, id)
	if err != nil {
		s.problem(w, r, err)
		return
	}
	defer rows.Close()
	out := []taxCheck{}
	for rows.Next() {
		var c taxCheck
		if err := rows.Scan(&c.ID, &c.PartyID, &c.Provider, &c.TaxID, &c.Result, &c.Name, &c.Address, &c.Message, &c.CheckedAt); err != nil {
			s.problem(w, r, err)
			return
		}
		out = append(out, c)
	}
	writeJSON(w, http.StatusOK, out)
}

// POST /api/parties/{id}/verify-tax: ask an official service whether the party's tax number is active. For EU VAT
// numbers that is VIES. It is an explicit action: the number is sent to the service, and the answer, who gave it and
// when are kept. Other countries have no service Mavri can ask without credentials, and the answer says so.
func (s *Server) verifyTax(w http.ResponseWriter, r *http.Request) {
	id, ok := idOf(w, r)
	if !ok {
		return
	}
	p, err := store.Parties.Get(r.Context(), s.DB, id)
	if err != nil {
		s.problem(w, r, err)
		return
	}
	country := strings.ToUpper(strings.TrimSpace(p.Country))
	number := strings.TrimSpace(p.TaxID)
	switch {
	case number == "":
		fail(w, http.StatusBadRequest, "validation", "this record has no tax number to check")
		return
	case !taxpack.IsEU(country):
		fail(w, http.StatusBadRequest, "validation", "Mavri can only check EU VAT numbers (with VIES); other countries' services need a login Mavri does not have, so check those on the tax authority's own site")
		return
	}
	if shape := taxpack.CheckID(country, number); !shape.Valid {
		fail(w, http.StatusBadRequest, "validation", shape.Message)
		return
	}
	res, err := s.Vies.Check(r.Context(), country, number)
	if err != nil {
		fail(w, http.StatusBadRequest, "validation", err.Error())
		return
	}
	result := "invalid"
	switch {
	case res.Unavailable:
		result = "unavailable"
	case res.Valid:
		result = "valid"
	}
	now := time.Now().UTC().Format(time.RFC3339)
	r2, err := s.DB.ExecContext(r.Context(), `INSERT INTO tax_checks (party_id, provider, tax_id, result, name, address, message, checked_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
		id, vies.Provider, number, result, res.Name, res.Address, res.Message, now)
	if err != nil {
		s.problem(w, r, err)
		return
	}
	cid, _ := r2.LastInsertId()
	s.Hub.Record(r.Context(), activity.Event{Action: "checked tax number", Entity: "party", EntityID: id, Label: p.Name, Detail: vies.Provider + ": " + result})
	writeJSON(w, http.StatusOK, taxCheck{cid, id, vies.Provider, number, result, res.Name, res.Address, res.Message, now})
}
