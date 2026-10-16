package web

import (
	"net/http"
	"reflect"
	"strconv"

	"github.com/Raktim94/mavri/server/internal/activity"
	"github.com/Raktim94/mavri/server/internal/db"
	"github.com/Raktim94/mavri/server/internal/model"
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
		name, data := eventFor(path, "created", v)
		s.Hub.Record(r.Context(), activity.Event{Action: "created", Entity: entityOf(path), EntityID: t.ID(&v), Label: labelOf(v), Name: name, Data: data})
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
		name, data := eventFor(path, "updated", v)
		s.Hub.Record(r.Context(), activity.Event{Action: "updated", Entity: entityOf(path), EntityID: id, Label: labelOf(v), Name: name, Data: data})
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
		s.Hub.Record(r.Context(), activity.Event{Action: "deleted", Entity: entityOf(path), EntityID: id})
		w.WriteHeader(http.StatusNoContent)
	}))
}

// entityOf names the record type for the history, from "/api/parties" and so on.
func entityOf(path string) string {
	switch path {
	case "/api/parties":
		return "party"
	case "/api/currencies":
		return "currency"
	case "/api/banks":
		return "bank account"
	case "/api/groups":
		return "category or unit"
	case "/api/products":
		return "product"
	case "/api/styles":
		return "style"
	case "/api/presets":
		return "preset"
	}
	return path
}

// labelOf picks a readable name from a record (its Name, Label or Code), for the history.
func labelOf(v any) string {
	rv := reflect.ValueOf(v)
	for rv.Kind() == reflect.Pointer {
		rv = rv.Elem()
	}
	if rv.Kind() != reflect.Struct {
		return ""
	}
	for _, k := range []string{"Name", "Label", "Code"} {
		if f := rv.FieldByName(k); f.IsValid() && f.Kind() == reflect.String && f.String() != "" {
			return f.String()
		}
	}
	return ""
}

// eventFor names the webhook event for a record change, when records of that kind have one.
// Only customers do: business records, products and the like change too rarely to be worth a delivery.
func eventFor(path, action string, v any) (string, any) {
	if p, ok := v.(model.Party); ok && path == "/api/parties" && p.Kind == "customer" {
		return "customer." + action, map[string]any{"customer": map[string]any{
			"id": p.ID, "name": p.Name, "email": p.Email, "phone": p.Phone, "country": p.Country, "taxId": p.TaxID, "language": p.Language}}
	}
	return "", nil
}
