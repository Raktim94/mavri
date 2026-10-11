package api

import (
	"context"
	"net/http"
	"strings"

	"github.com/Raktim94/nodedr-invoice/rewrite/internal/entity"
	"github.com/Raktim94/nodedr-invoice/rewrite/internal/httpx"
)

// nullable answers {"success":true,"data":null} for "found nothing", which the
// envelope's omitempty cannot express.
func nullable(w http.ResponseWriter, row entity.Row, ok bool) {
	if !ok {
		httpx.WriteJSON(w, http.StatusOK, map[string]any{"success": true, "data": nil})
		return
	}
	succeeded(w, row)
}

func (a *authAPI) mountSettings(mux *http.ServeMux) {
	ra := resourceAPI{a: a}
	mux.HandleFunc("GET /api/settings", a.requireAuth(ra.with(func(ctx context.Context, repo entity.Repo, w http.ResponseWriter, _ *http.Request) {
		rows, err := repo.Select(ctx, "settings", "LIMIT 1")
		if err != nil {
			failed(w, err)
			return
		}
		if len(rows) == 0 {
			nullable(w, nil, false)
			return
		}
		nullable(w, rows[0], true)
	})))
	mux.HandleFunc("PUT /api/settings", a.requireAuth(ra.with(func(ctx context.Context, repo entity.Repo, w http.ResponseWriter, r *http.Request) {
		var body entity.Row
		if !decodeJSON(r, &body) || body == nil {
			httpx.Fail(w, http.StatusBadRequest, "error.missingFields")
			return
		}
		for _, k := range []string{"id", "createdAt", "updatedAt"} {
			delete(body, k)
		}
		if _, err := repo.UpdateColumns(ctx, "settings", body, `"id" = (SELECT "id" FROM settings LIMIT 1)`); err != nil {
			failed(w, err)
			return
		}
		httpx.WriteJSON(w, http.StatusOK, httpx.Envelope{Success: true})
	})))
	mux.HandleFunc("GET /api/tax/us-states", a.requireAuth(ra.with(func(ctx context.Context, repo entity.Repo, w http.ResponseWriter, _ *http.Request) {
		rows, err := repo.Select(ctx, "us_sales_tax_rates", `ORDER BY "stateName" ASC`)
		if err != nil {
			failed(w, err)
			return
		}
		succeeded(w, rows)
	})))
	mux.HandleFunc("GET /api/tax/us-states/{stateCode}", a.requireAuth(ra.with(func(ctx context.Context, repo entity.Repo, w http.ResponseWriter, r *http.Request) {
		rows, err := repo.Select(ctx, "us_sales_tax_rates", `WHERE "stateCode" = ?`, strings.ToUpper(r.PathValue("stateCode")))
		if err != nil {
			failed(w, err)
			return
		}
		if len(rows) == 0 {
			nullable(w, nil, false)
			return
		}
		nullable(w, rows[0], true)
	})))
}
