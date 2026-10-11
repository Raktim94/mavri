package api

import (
	"context"
	"io"
	"net/http"

	"github.com/Raktim94/nodedr-invoice/rewrite/internal/entity"
	"github.com/Raktim94/nodedr-invoice/rewrite/internal/httpx"
	"github.com/Raktim94/nodedr-invoice/rewrite/internal/invoices"
)

func (a *authAPI) invoiceService() (*invoices.Service, bool) {
	repo, ok := a.repo()
	if !ok {
		return nil, false
	}
	return &invoices.Service{Repo: repo, Now: a.now}, true
}

// invoiceFailed answers an invoice error: a plain {"success":false} when the
// service gave no key, otherwise the usual key (and message).
func invoiceFailed(w http.ResponseWriter, err error) {
	if invoices.IsNoResult(err) {
		httpx.WriteJSON(w, http.StatusOK, httpx.Envelope{Success: false})
		return
	}
	failed(w, err)
}

func (a *authAPI) invoiceHandler(h func(ctx context.Context, svc *invoices.Service, w http.ResponseWriter, r *http.Request)) http.HandlerFunc {
	return a.requireAuth(func(w http.ResponseWriter, r *http.Request) {
		svc, ok := a.invoiceService()
		if !ok {
			httpx.Fail(w, http.StatusBadRequest, "error.databaseNotInitialized")
			return
		}
		h(r.Context(), svc, w, r)
	})
}

func queryParam(r *http.Request, name string) any {
	if v, ok := r.URL.Query()[name]; ok && len(v) > 0 {
		return v[0]
	}
	return nil
}

func (a *authAPI) mountInvoices(mux *http.ServeMux) {
	mux.HandleFunc("GET /api/invoices", a.invoiceHandler(func(ctx context.Context, svc *invoices.Service, w http.ResponseWriter, r *http.Request) {
		q := r.URL.Query().Get("filter")
		rows, err := svc.List(ctx, r.URL.Query().Get("type"), entity.ParseFilter(q), q != "")
		if err != nil {
			failed(w, err)
			return
		}
		succeeded(w, rows)
	}))
	save := func(update bool) http.HandlerFunc {
		return a.invoiceHandler(func(ctx context.Context, svc *invoices.Service, w http.ResponseWriter, r *http.Request) {
			body, err := io.ReadAll(r.Body)
			if err != nil {
				httpx.Fail(w, http.StatusBadRequest, "error.missingFields")
				return
			}
			data, err := entity.DecodeTree(body, invoices.RequestShape)
			if err != nil {
				httpx.Fail(w, http.StatusBadRequest, "error.missingFields")
				return
			}
			invoices.PrepareRequest(data)
			var res any
			if update {
				res, err = svc.Update(ctx, data)
			} else {
				res, err = svc.Add(ctx, data)
			}
			if err != nil {
				invoiceFailed(w, err)
				return
			}
			succeeded(w, res)
		})
	}
	mux.HandleFunc("POST /api/invoices", save(false))
	mux.HandleFunc("PUT /api/invoices", save(true))
	mux.HandleFunc("DELETE /api/invoices/{id}", a.invoiceHandler(func(ctx context.Context, svc *invoices.Service, w http.ResponseWriter, r *http.Request) {
		if err := svc.Delete(ctx, entity.IDFromPath(r.PathValue("id"))); err != nil {
			failed(w, err)
			return
		}
		httpx.WriteJSON(w, http.StatusOK, httpx.Envelope{Success: true})
	}))
	mux.HandleFunc("POST /api/invoices/duplicate", a.invoiceHandler(func(ctx context.Context, svc *invoices.Service, w http.ResponseWriter, r *http.Request) {
		var body struct {
			InvoiceID   any    `json:"invoiceId"`
			InvoiceType string `json:"invoiceType"`
		}
		if !decodeJSON(r, &body) {
			httpx.Fail(w, http.StatusBadRequest, "error.missingFields")
			return
		}
		id := entity.RowID(entity.Row{"id": body.InvoiceID})
		res, err := svc.Duplicate(ctx, id, body.InvoiceType)
		if err != nil {
			invoiceFailed(w, err)
			return
		}
		succeeded(w, res)
	}))
	mux.HandleFunc("GET /api/invoices/headers", a.invoiceHandler(func(ctx context.Context, svc *invoices.Service, w http.ResponseWriter, r *http.Request) {
		rows, err := svc.CustomHeaders(ctx, r.URL.Query().Get("type"))
		if err != nil {
			failed(w, err)
			return
		}
		succeeded(w, rows)
	}))
	mux.HandleFunc("GET /api/invoices/sequence", a.invoiceHandler(func(ctx context.Context, svc *invoices.Service, w http.ResponseWriter, r *http.Request) {
		typ := r.URL.Query().Get("invoiceType")
		if typ == "" {
			typ = "invoice"
		}
		row, err := svc.NextSequence(ctx, queryParam(r, "businessId"), queryParam(r, "clientId"), typ)
		if err != nil {
			failed(w, err)
			return
		}
		if row == nil {
			httpx.WriteJSON(w, http.StatusOK, httpx.Envelope{Success: true})
			return
		}
		succeeded(w, row)
	}))
}
