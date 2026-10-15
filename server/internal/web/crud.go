package web

import (
	"net/http"
	"strconv"

	"github.com/Raktim94/mavri/server/internal/db"
)

func pathID(r *http.Request) (int64, bool) {
	id, err := strconv.ParseInt(r.PathValue("id"), 10, 64)
	return id, err == nil && id > 0
}

// crud registers list, create, read, update and delete for one table.
func crud[T any](s *Server, mux *http.ServeMux, path string, t *db.Table[T], check func(*T) error,
	listTail func(*http.Request) (string, []any)) {
	user := func(h http.HandlerFunc) http.HandlerFunc { return s.auth(false, h) }

	mux.HandleFunc("GET "+path, user(func(w http.ResponseWriter, r *http.Request) {
		tail, args := listTail(r)
		rows, err := t.Select(r.Context(), s.DB, tail, args...)
		if err != nil {
			s.problem(w, r, err)
			return
		}
		writeJSON(w, http.StatusOK, rows)
	}))
	mux.HandleFunc("POST "+path, user(func(w http.ResponseWriter, r *http.Request) {
		var v T
		if !readJSON(w, r, &v) {
			return
		}
		t.SetID(&v, 0)
		if err := check(&v); err != nil {
			s.problem(w, r, err)
			return
		}
		if err := t.Insert(r.Context(), s.DB, &v); err != nil {
			s.problem(w, r, err)
			return
		}
		writeJSON(w, http.StatusCreated, v)
	}))
	mux.HandleFunc("GET "+path+"/{id}", user(func(w http.ResponseWriter, r *http.Request) {
		id, ok := pathID(r)
		if !ok {
			fail(w, http.StatusBadRequest, "validation", "bad id")
			return
		}
		v, err := t.Get(r.Context(), s.DB, id)
		if err != nil {
			s.problem(w, r, err)
			return
		}
		writeJSON(w, http.StatusOK, v)
	}))
	mux.HandleFunc("PUT "+path+"/{id}", user(func(w http.ResponseWriter, r *http.Request) {
		id, ok := pathID(r)
		if !ok {
			fail(w, http.StatusBadRequest, "validation", "bad id")
			return
		}
		var v T
		if !readJSON(w, r, &v) {
			return
		}
		t.SetID(&v, id)
		if err := check(&v); err != nil {
			s.problem(w, r, err)
			return
		}
		if err := t.Update(r.Context(), s.DB, &v); err != nil {
			s.problem(w, r, err)
			return
		}
		writeJSON(w, http.StatusOK, v)
	}))
	mux.HandleFunc("DELETE "+path+"/{id}", user(func(w http.ResponseWriter, r *http.Request) {
		id, ok := pathID(r)
		if !ok {
			fail(w, http.StatusBadRequest, "validation", "bad id")
			return
		}
		if err := t.Delete(r.Context(), s.DB, id); err != nil {
			s.problem(w, r, err)
			return
		}
		w.WriteHeader(http.StatusNoContent)
	}))
}
