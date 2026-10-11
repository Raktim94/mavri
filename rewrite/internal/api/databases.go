package api

import (
	"net/http"
	"os"
	"path/filepath"
	"strings"
	"time"

	"github.com/Raktim94/nodedr-invoice/rewrite/internal/httpx"
	"github.com/Raktim94/nodedr-invoice/rewrite/internal/store"
)

// Opener opens the database file at path; the file may be new.
type Opener func(path string) (store.Store, error)

func serverFail(w http.ResponseWriter, msg string) {
	httpx.WriteJSON(w, http.StatusInternalServerError, httpx.Envelope{Success: false, Message: &msg})
}

// resolveDBFile keeps the database inside dir, so a name like
// "../../etc/cron.d/evil" cannot make the server touch files elsewhere.
func resolveDBFile(dir, name string) (string, bool) {
	if name == "" {
		return "", false
	}
	abs, err := filepath.Abs(dir)
	if err != nil {
		return "", false
	}
	// Like path.resolve: an absolute name replaces the directory, and is then
	// accepted only if it still points inside it.
	full := filepath.Clean(name)
	if !filepath.IsAbs(full) {
		full = filepath.Join(abs, name)
	}
	rel, err := filepath.Rel(abs, full)
	if err != nil || rel == "." || rel == ".." || strings.HasPrefix(rel, ".."+string(filepath.Separator)) || filepath.IsAbs(rel) {
		return "", false
	}
	return full, true
}

// requireAuthOnceConfigured lets the database chooser work on a fresh install
// (no database, or no account yet) and demands normal auth afterwards.
func (a *authAPI) requireAuthOnceConfigured(next http.HandlerFunc) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		st := a.cur()
		if st == nil {
			next(w, r)
			return
		}
		if n, err := st.CountUsers(r.Context()); err == nil && n == 0 {
			next(w, r)
			return
		}
		a.requireAuth(next)(w, r)
	}
}

func (a *authAPI) mountDatabases(mux *http.ServeMux, dataDir string, open Opener, hops int) {
	limit := httpx.NewLimiter(10*time.Second, 5, hops) // one budget for all three routes, as before
	guard := func(h http.HandlerFunc) http.HandlerFunc {
		return limit.Middleware(a.requireAuthOnceConfigured(h)).ServeHTTP
	}
	mux.HandleFunc("GET /api/databases", guard(func(w http.ResponseWriter, _ *http.Request) {
		entries, err := os.ReadDir(dataDir)
		if err != nil {
			serverFail(w, err.Error())
			return
		}
		names := []string{}
		for _, e := range entries {
			n := e.Name()
			if strings.HasSuffix(n, ".db") || strings.HasSuffix(n, ".sqlite") || strings.HasSuffix(n, ".sqlite3") {
				names = append(names, n)
			}
		}
		succeeded(w, names)
	}))
	mux.HandleFunc("POST /api/databases/test", guard(func(w http.ResponseWriter, _ *http.Request) {
		serverFail(w, "PostgreSQL is not supported by the Go backend yet")
	}))
	mux.HandleFunc("POST /api/databases", guard(func(w http.ResponseWriter, r *http.Request) {
		var body struct {
			FullPath any    `json:"fullPath"`
			Mode     any    `json:"mode"`
			DBType   string `json:"dbType"`
		}
		_ = decodeJSON(r, &body)
		str := func(v any) string {
			if v == nil {
				return ""
			}
			if s, ok := v.(string); ok {
				return s
			}
			return ""
		}
		if body.DBType != "" && body.DBType != "SQLite" {
			serverFail(w, "PostgreSQL is not supported by the Go backend yet")
			return
		}
		full, ok := resolveDBFile(dataDir, str(body.FullPath))
		if !ok {
			httpx.Fail(w, http.StatusBadRequest, "error.invalidDBName")
			return
		}
		create := str(body.Mode) == "create"
		_, statErr := os.Stat(full)
		exists := statErr == nil
		switch {
		case create && exists:
			// The old server silently deleted the existing file here.
			serverFail(w, "error.databaseFileExists")
			return
		case !create && !exists:
			serverFail(w, "error.databaseFileNotExist")
			return
		case open == nil:
			serverFail(w, "opening databases is not available")
			return
		}
		if err := os.MkdirAll(filepath.Dir(full), 0o700); err != nil {
			serverFail(w, err.Error())
			return
		}
		next, err := open(full)
		if err != nil {
			serverFail(w, err.Error())
			return
		}
		a.swap(next)
		httpx.WriteJSON(w, http.StatusOK, httpx.Envelope{Success: true})
	}))
}
