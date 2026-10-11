package api

import (
	"compress/gzip"
	"context"
	"io"
	"net/http"

	"github.com/Raktim94/nodedr-invoice/rewrite/internal/entity"
	"github.com/Raktim94/nodedr-invoice/rewrite/internal/httpx"
	"github.com/Raktim94/nodedr-invoice/rewrite/internal/transfer"
)

func (a *authAPI) mountTransfer(mux *http.ServeMux) {
	ra := resourceAPI{a: a}
	mux.HandleFunc("GET /api/export", a.requireAuth(ra.with(func(ctx context.Context, repo entity.Repo, w http.ResponseWriter, _ *http.Request) {
		data, err := transfer.Export(ctx, repo)
		if err != nil {
			failed(w, err)
			return
		}
		succeeded(w, data)
	})))
	mux.HandleFunc("POST /api/import", a.requireAuth(ra.with(func(ctx context.Context, repo entity.Repo, w http.ResponseWriter, r *http.Request) {
		invalid := func() { httpx.Fail(w, http.StatusBadRequest, "error.invalidFile") }
		if err := r.ParseMultipartForm(32 << 20); err != nil {
			invalid()
			return
		}
		file, _, err := r.FormFile("file")
		if err != nil {
			invalid()
			return
		}
		defer file.Close()
		zr, err := gzip.NewReader(file)
		if err != nil {
			invalid()
			return
		}
		text, err := io.ReadAll(zr)
		if err != nil {
			invalid()
			return
		}
		doc, err := transfer.Parse(text)
		if err != nil {
			invalid()
			return
		}
		if err := transfer.Import(ctx, repo, doc); err != nil {
			failed(w, err)
			return
		}
		httpx.WriteJSON(w, http.StatusOK, httpx.Envelope{Success: true})
	})))
}
