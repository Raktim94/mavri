package web

import (
	"bytes"
	"crypto/sha256"
	"encoding/hex"
	"io"
	"net/http"
	"strings"
	"time"
)

// idempotent makes a write replay-safe. When the request has an Idempotency-Key header, it is carried out once:
// sending it again with the same key (from the same caller, to the same route) returns the first answer with
// `Idempotent-Replay: true`, and nothing happens a second time. The same key with a different body is refused,
// since it means a mistake on the caller's side. A request still running answers 409. Keys are kept for a day.
func (s *Server) idempotent(h http.HandlerFunc) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		key := strings.TrimSpace(r.Header.Get("Idempotency-Key"))
		if key == "" {
			h(w, r)
			return
		}
		if len(key) > 200 {
			fail(w, http.StatusBadRequest, "validation", "the Idempotency-Key is too long (200 characters at most)")
			return
		}
		body, err := io.ReadAll(http.MaxBytesReader(w, r.Body, maxBody))
		if err != nil {
			fail(w, http.StatusRequestEntityTooLarge, "validation", "the request is too large")
			return
		}
		r.Body = io.NopCloser(bytes.NewReader(body))
		sum := sha256.Sum256(append([]byte(r.Method+" "+r.URL.Path+"?"+r.URL.RawQuery+"\n"), body...))
		hash := hex.EncodeToString(sum[:])
		who := "anon"
		if p, ok := r.Context().Value(principalKey).(principal); ok {
			if p.KeyID != 0 {
				who = "key:" + itoa(p.KeyID)
			} else {
				who = "user:" + itoa(p.UserID)
			}
		}
		scope := who + "|" + r.Method + " " + r.URL.Path
		ctx := r.Context()
		now := time.Now().UTC()
		_, _ = s.DB.ExecContext(ctx, `DELETE FROM idempotency_keys WHERE created_at < ?`, now.Add(-24*time.Hour).Format(time.RFC3339))

		res, err := s.DB.ExecContext(ctx, `INSERT OR IGNORE INTO idempotency_keys (key, scope, request_hash, created_at) VALUES (?, ?, ?, ?)`,
			key, scope, hash, now.Format(time.RFC3339))
		if err != nil {
			s.problem(w, r, err)
			return
		}
		if n, _ := res.RowsAffected(); n == 0 {
			var prevHash, ct string
			var status int
			var prev []byte
			if err := s.DB.QueryRowContext(ctx, `SELECT request_hash, status, body, content_type FROM idempotency_keys WHERE key = ? AND scope = ?`, key, scope).
				Scan(&prevHash, &status, &prev, &ct); err != nil {
				s.problem(w, r, err)
				return
			}
			switch {
			case prevHash != hash:
				fail(w, http.StatusUnprocessableEntity, "validation", "this Idempotency-Key was already used with a different request")
			case status == 0:
				fail(w, http.StatusConflict, "conflict", "a request with this Idempotency-Key is still being processed")
			default:
				w.Header().Set("Idempotent-Replay", "true")
				if ct != "" {
					w.Header().Set("Content-Type", ct)
				}
				w.WriteHeader(status)
				_, _ = w.Write(prev)
			}
			return
		}
		rec := &recorder{ResponseWriter: w, status: http.StatusOK}
		h(rec, r)
		if rec.status >= 500 {
			// A failure on our side is not an answer worth replaying: let the caller try again.
			_, _ = s.DB.ExecContext(ctx, `DELETE FROM idempotency_keys WHERE key = ? AND scope = ?`, key, scope)
			return
		}
		_, _ = s.DB.ExecContext(ctx, `UPDATE idempotency_keys SET status = ?, body = ?, content_type = ? WHERE key = ? AND scope = ?`,
			rec.status, rec.buf.Bytes(), w.Header().Get("Content-Type"), key, scope)
	}
}

// recorder passes the answer through and keeps a copy.
type recorder struct {
	http.ResponseWriter
	status int
	buf    bytes.Buffer
}

func (r *recorder) WriteHeader(code int) { r.status = code; r.ResponseWriter.WriteHeader(code) }
func (r *recorder) Write(b []byte) (int, error) {
	r.buf.Write(b)
	return r.ResponseWriter.Write(b)
}
