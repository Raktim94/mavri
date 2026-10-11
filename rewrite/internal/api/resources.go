package api

import (
	"bytes"
	"context"
	"database/sql"
	"encoding/json"
	"io"
	"net/http"

	"github.com/Raktim94/nodedr-invoice/rewrite/internal/entity"
	"github.com/Raktim94/nodedr-invoice/rewrite/internal/httpx"
)

// sqlProvider is implemented by stores backed by an SQL database; the
// resource routes need it, the in-memory test store does not have one.
type sqlProvider interface{ DB() *sql.DB }

// resourceAPI serves the list/create/update/delete/batch routes of one Spec.
type resourceAPI struct {
	a    *authAPI
	spec *entity.Spec
}

func (a *authAPI) repo() (entity.Repo, bool) {
	if p, ok := a.st.(sqlProvider); ok {
		return entity.Repo{DB: p.DB()}, true
	}
	return entity.Repo{}, false
}

// failed answers like the old server: HTTP 200 with success:false and a key.
func failed(w http.ResponseWriter, err error) {
	f := entity.MapError(err)
	env := httpx.Envelope{Success: false, Key: f.Key}
	if f.Message != "" {
		env.Message = &f.Message
	}
	httpx.WriteJSON(w, http.StatusOK, env)
}

func succeeded(w http.ResponseWriter, data any) {
	httpx.WriteJSON(w, http.StatusOK, httpx.Envelope{Success: true, Data: data})
}

func decodeJSON(r *http.Request, into any) bool {
	body, err := io.ReadAll(r.Body)
	if err != nil {
		return false
	}
	dec := json.NewDecoder(bytes.NewReader(body))
	dec.UseNumber() // keep integers exact
	return dec.Decode(into) == nil
}

func (ra resourceAPI) with(h func(ctx context.Context, repo entity.Repo, w http.ResponseWriter, r *http.Request)) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		repo, ok := ra.a.repo()
		if !ok {
			httpx.Fail(w, http.StatusBadRequest, "error.databaseNotInitialized")
			return
		}
		h(r.Context(), repo, w, r)
	}
}

func (ra resourceAPI) list() http.HandlerFunc {
	return ra.with(func(ctx context.Context, repo entity.Repo, w http.ResponseWriter, r *http.Request) {
		rows, err := repo.List(ctx, ra.spec, entity.ParseFilter(r.URL.Query().Get("filter")))
		if err != nil {
			failed(w, err)
			return
		}
		succeeded(w, rows)
	})
}

func (ra resourceAPI) save(update bool) http.HandlerFunc {
	return ra.with(func(ctx context.Context, repo entity.Repo, w http.ResponseWriter, r *http.Request) {
		var row entity.Row
		if !decodeJSON(r, &row) || row == nil {
			httpx.Fail(w, http.StatusBadRequest, "error.missingFields")
			return
		}
		saved, err := repo.Save(ctx, ra.spec, row, update)
		if err != nil {
			failed(w, err)
			return
		}
		if saved == nil {
			succeeded(w, nil)
			return
		}
		succeeded(w, saved)
	})
}

func (ra resourceAPI) remove() http.HandlerFunc {
	return ra.with(func(ctx context.Context, repo entity.Repo, w http.ResponseWriter, r *http.Request) {
		if err := repo.Delete(ctx, ra.spec, entity.IDFromPath(r.PathValue("id"))); err != nil {
			failed(w, err)
			return
		}
		succeeded(w, nil)
	})
}

func (ra resourceAPI) batch() http.HandlerFunc {
	return ra.with(func(ctx context.Context, repo entity.Repo, w http.ResponseWriter, r *http.Request) {
		var rows []entity.Row
		if !decodeJSON(r, &rows) {
			httpx.Fail(w, http.StatusBadRequest, "error.missingFields")
			return
		}
		if err := repo.Batch(ctx, ra.spec, rows); err != nil {
			failed(w, err)
			return
		}
		succeeded(w, nil)
	})
}

// mountResource registers the five routes of one resource behind auth.
func (a *authAPI) mountResource(mux *http.ServeMux, path string, spec *entity.Spec) {
	ra := resourceAPI{a: a, spec: spec}
	guard := func(h http.HandlerFunc) http.HandlerFunc { return a.requireAuth(h) }
	mux.HandleFunc("GET "+path, guard(ra.list()))
	mux.HandleFunc("POST "+path, guard(ra.save(false)))
	mux.HandleFunc("PUT "+path, guard(ra.save(true)))
	mux.HandleFunc("DELETE "+path+"/{id}", guard(ra.remove()))
	mux.HandleFunc("POST "+path+"/batch", guard(ra.batch()))
}
