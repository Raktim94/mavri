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
	if p, ok := a.cur().(sqlProvider); ok {
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

func readRow(r *http.Request, jsonKeys []string) (entity.Row, bool) {
	body, err := io.ReadAll(r.Body)
	if err != nil {
		return nil, false
	}
	row, err := entity.DecodeRow(body, jsonKeys)
	return row, err == nil
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
		row, ok := readRow(r, ra.spec.JSONFields)
		if !ok {
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
		body, err := io.ReadAll(r.Body)
		rows, derr := entity.DecodeRows(body, ra.spec.JSONFields)
		if err != nil || derr != nil {
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
	a.mountResourceWith(mux, path, spec, true)
}

func (a *authAPI) mountResourceWith(mux *http.ServeMux, path string, spec *entity.Spec, withBatch bool) {
	ra := resourceAPI{a: a, spec: spec}
	guard := func(h http.HandlerFunc) http.HandlerFunc { return a.requireAuth(h) }
	mux.HandleFunc("GET "+path, guard(ra.list()))
	mux.HandleFunc("POST "+path, guard(ra.save(false)))
	mux.HandleFunc("PUT "+path, guard(ra.save(true)))
	mux.HandleFunc("DELETE "+path+"/{id}", guard(ra.remove()))
	if withBatch {
		mux.HandleFunc("POST "+path+"/batch", guard(ra.batch()))
	}
}

// presets read through a joined query and save through a transaction, and
// their failures carry only the key (no message), as before.
func (a *authAPI) mountPresets(mux *http.ServeMux) {
	ra := resourceAPI{a: a, spec: entity.Presets}
	keyOnly := func(w http.ResponseWriter, err error) {
		httpx.WriteJSON(w, http.StatusOK, httpx.Envelope{Success: false, Key: entity.MapError(err).Key})
	}
	mux.HandleFunc("GET /api/presets", a.requireAuth(ra.with(func(ctx context.Context, repo entity.Repo, w http.ResponseWriter, r *http.Request) {
		rows, err := repo.ListPresets(ctx, entity.ParseFilter(r.URL.Query().Get("filter")))
		if err != nil {
			failed(w, err)
			return
		}
		succeeded(w, rows)
	})))
	save := func(update bool) http.HandlerFunc {
		return a.requireAuth(ra.with(func(ctx context.Context, repo entity.Repo, w http.ResponseWriter, r *http.Request) {
			row, ok := readRow(r, nil)
			if !ok {
				httpx.Fail(w, http.StatusBadRequest, "error.missingFields")
				return
			}
			saved, err := repo.SavePreset(ctx, row, update)
			if err != nil {
				keyOnly(w, err)
				return
			}
			if saved == nil {
				succeeded(w, nil)
				return
			}
			succeeded(w, saved)
		}))
	}
	mux.HandleFunc("POST /api/presets", save(false))
	mux.HandleFunc("PUT /api/presets", save(true))
	mux.HandleFunc("DELETE /api/presets/{id}", a.requireAuth(ra.remove()))
	mux.HandleFunc("POST /api/presets/batch", a.requireAuth(ra.batch()))
}

func (a *authAPI) mountLayoutExport(mux *http.ServeMux) {
	ra := resourceAPI{a: a, spec: entity.Layouts}
	mux.HandleFunc("GET /api/layouts/export/{id}", a.requireAuth(ra.with(func(ctx context.Context, repo entity.Repo, w http.ResponseWriter, r *http.Request) {
		row, err := repo.LayoutByID(ctx, entity.IDFromPath(r.PathValue("id")))
		if err != nil {
			failed(w, err)
			return
		}
		nullable(w, row, row != nil)
	})))
}
