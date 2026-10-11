package api

import (
	"io/fs"
	"net/http"
	"os"
	"path"
	"strings"

	"github.com/Raktim94/nodedr-invoice/rewrite/internal/httpx"
)

// spa serves the built web app from dir. Any path that is not a file falls
// back to index.html so client-side routes survive a reload; unknown /api
// paths answer a JSON 404 instead of the page.
func spa(dir string) http.Handler {
	fsys := os.DirFS(dir)
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path == "/api" || strings.HasPrefix(r.URL.Path, "/api/") {
			httpx.Fail(w, http.StatusNotFound, "error.notFound")
			return
		}
		if r.Method != http.MethodGet && r.Method != http.MethodHead {
			httpx.Fail(w, http.StatusMethodNotAllowed, "error.notFound")
			return
		}
		name := strings.TrimPrefix(path.Clean("/"+r.URL.Path), "/")
		if name == "" {
			name = "index.html"
		}
		if st, err := fs.Stat(fsys, name); err != nil || st.IsDir() {
			name = "index.html"
		}
		if name == "index.html" {
			// The page names hashed asset files; it must never be cached stale.
			w.Header().Set("Cache-Control", "no-cache")
		}
		http.ServeFileFS(w, r, fsys, name)
	})
}
