package web

import (
	"compress/gzip"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/http"
	"strings"
	"time"

	"github.com/Raktim94/mavri/server/internal/activity"
	"github.com/Raktim94/mavri/server/internal/backup"
	"github.com/Raktim94/mavri/server/internal/db"
	"github.com/Raktim94/mavri/server/internal/model"
	"github.com/Raktim94/mavri/server/internal/shop"
	"github.com/Raktim94/mavri/server/internal/store"
)

// readJSONOptional decodes a body that may be empty.
func readJSONOptional(r *http.Request, v any) error {
	body, err := io.ReadAll(io.LimitReader(r.Body, 1<<20))
	if err != nil || len(strings.TrimSpace(string(body))) == 0 {
		return err
	}
	return json.Unmarshal(body, v)
}

func (s *Server) getSettings(w http.ResponseWriter, r *http.Request) {
	set, err := s.Store.GetSettings(r.Context(), s.DB)
	if err != nil {
		s.problem(w, r, err)
		return
	}
	writeJSON(w, http.StatusOK, set)
}

func (s *Server) putSettings(w http.ResponseWriter, r *http.Request) {
	var set model.Settings
	if !readJSON(w, r, &set) {
		return
	}
	if err := s.Store.SaveSettings(r.Context(), set); err != nil {
		s.problem(w, r, err)
		return
	}
	s.Hub.Record(r.Context(), activity.Event{Action: "changed", Entity: "settings", Detail: "app settings"})
	writeJSON(w, http.StatusOK, set)
}

func (s *Server) exportBackup(w http.ResponseWriter, r *http.Request) {
	f, err := backup.Export(r.Context(), s.DB)
	if err != nil {
		s.problem(w, r, err)
		return
	}
	s.Hub.Record(r.Context(), activity.Event{Action: "downloaded", Entity: "backup", Label: "backup download"})
	w.Header().Set("Content-Type", "application/gzip")
	w.Header().Set("Content-Disposition", fmt.Sprintf(`attachment; filename="mavri-backup-%s.json.gz"`, time.Now().UTC().Format("2006-01-02")))
	zw := gzip.NewWriter(w)
	_ = json.NewEncoder(zw).Encode(f)
	_ = zw.Close()
}

func (s *Server) importBackup(w http.ResponseWriter, r *http.Request) {
	r.Body = http.MaxBytesReader(w, r.Body, maxBody)
	if err := r.ParseMultipartForm(maxBody); err != nil {
		fail(w, http.StatusBadRequest, "validation", "send the backup as a file upload")
		return
	}
	file, _, err := r.FormFile("file")
	if err != nil {
		fail(w, http.StatusBadRequest, "validation", "choose a backup file")
		return
	}
	defer file.Close()
	data, err := io.ReadAll(io.LimitReader(file, 256<<20))
	if err != nil {
		fail(w, http.StatusBadRequest, "validation", "this is not a Mavri backup")
		return
	}
	f, err := backup.Unpack(data, r.FormValue("passphrase"))
	if errors.Is(err, backup.ErrPassphrase) {
		fail(w, http.StatusBadRequest, "passphrase", "this backup is encrypted: enter its passphrase (it is missing or wrong)")
		return
	}
	if err == nil {
		err = backup.Restore(r.Context(), s.DB, f)
	}
	if err == nil {
		s.Hub.Record(r.Context(), activity.Event{Action: "restored", Entity: "backup", Label: "from backup of " + f.ExportedAt})
	}
	if errors.Is(err, backup.ErrInvalid) {
		fail(w, http.StatusBadRequest, "validation", err.Error())
		return
	}
	if err != nil {
		s.problem(w, r, err)
		return
	}
	w.WriteHeader(http.StatusNoContent)
}

// ---- stores ----------------------------------------------------------------

func (s *Server) baseURL(r *http.Request) string {
	scheme := "http"
	if r.TLS != nil || (s.Cfg.TrustProxy > 0 && r.Header.Get("X-Forwarded-Proto") == "https") || s.Cfg.CookieSecure {
		scheme = "https"
	}
	return scheme + "://" + r.Host
}

func (s *Server) withURL(r *http.Request, sh model.Shop) model.Shop {
	sh.WebhookURL = fmt.Sprintf("%s/api/hooks/%s/%d", s.baseURL(r), sh.Platform, sh.ID)
	return sh
}

func (s *Server) listShops(w http.ResponseWriter, r *http.Request) {
	shops, err := s.Shops.List(r.Context())
	if err != nil {
		s.problem(w, r, err)
		return
	}
	for i := range shops {
		shops[i] = s.withURL(r, shops[i])
	}
	writeJSON(w, http.StatusOK, shops)
}

func (s *Server) createShop(w http.ResponseWriter, r *http.Request) {
	var in model.Shop
	if !readJSON(w, r, &in) {
		return
	}
	sh, secret, err := s.Shops.Create(r.Context(), in, principalFrom(r.Context()).UserID)
	if err != nil {
		s.problem(w, r, err)
		return
	}
	writeJSON(w, http.StatusCreated, map[string]any{"shop": s.withURL(r, sh), "secret": secret})
}

func (s *Server) pauseShop(w http.ResponseWriter, r *http.Request) {
	id, ok := pathID(r)
	if !ok {
		fail(w, http.StatusBadRequest, "validation", "bad id")
		return
	}
	if err := s.Shops.Pause(r.Context(), id); err != nil {
		s.problem(w, r, err)
		return
	}
	w.WriteHeader(http.StatusNoContent)
}

func (s *Server) deleteShop(w http.ResponseWriter, r *http.Request) {
	id, ok := pathID(r)
	if !ok {
		fail(w, http.StatusBadRequest, "validation", "bad id")
		return
	}
	if err := s.Shops.Delete(r.Context(), id); err != nil {
		s.problem(w, r, err)
		return
	}
	w.WriteHeader(http.StatusNoContent)
}

func (s *Server) webhook(w http.ResponseWriter, r *http.Request) {
	id, ok := pathID(r)
	platform := r.PathValue("platform")
	if !ok || !shop.ValidPlatform(platform) {
		fail(w, http.StatusNotFound, "not_found", "no such connection")
		return
	}
	body, err := io.ReadAll(http.MaxBytesReader(w, r.Body, 1<<20))
	if err != nil {
		fail(w, http.StatusRequestEntityTooLarge, "validation", "the request is too large")
		return
	}
	docID, dup, err := s.Shops.Receive(r.Context(), id, platform, body, r.Header.Get(shop.SignatureHeader(platform)))
	s.orderResult(w, r, docID, dup, err)
}

func (s *Server) orderResult(w http.ResponseWriter, r *http.Request, docID int64, dup bool, err error) {
	switch {
	case errors.Is(err, shop.ErrBadSignature):
		fail(w, http.StatusUnauthorized, "unauthorized", "signature does not match")
	case errors.Is(err, shop.ErrInactive):
		fail(w, http.StatusForbidden, "forbidden", "this store connection is paused")
	case errors.Is(err, shop.ErrBadOrder):
		fail(w, http.StatusBadRequest, "validation", err.Error())
	case errors.Is(err, db.ErrNotFound):
		fail(w, http.StatusNotFound, "not_found", "no such connection")
	case err != nil:
		s.problem(w, r, err)
	case dup:
		writeJSON(w, http.StatusOK, map[string]any{"documentId": docID, "duplicate": true})
	default:
		writeJSON(w, http.StatusCreated, map[string]any{"documentId": docID, "duplicate": false})
	}
}

// v1Order creates an invoice from an order, for scripts and other systems.
func (s *Server) v1Order(w http.ResponseWriter, r *http.Request) {
	body, err := io.ReadAll(http.MaxBytesReader(w, r.Body, 1<<20))
	if err != nil {
		fail(w, http.StatusRequestEntityTooLarge, "validation", "the request is too large")
		return
	}
	var head struct {
		ShopID int64 `json:"shopId"`
	}
	if json.Unmarshal(body, &head) != nil || head.ShopID == 0 {
		fail(w, http.StatusBadRequest, "validation", "shopId is required (create a store connection first)")
		return
	}
	sh, err := store.Shops.Get(r.Context(), s.DB, head.ShopID)
	if err != nil {
		s.problem(w, r, err)
		return
	}
	if !sh.Active {
		s.orderResult(w, r, 0, false, shop.ErrInactive)
		return
	}
	o, err := shop.ParseOrder("generic", body)
	if err != nil {
		s.orderResult(w, r, 0, false, fmt.Errorf("%w: %v", shop.ErrBadOrder, err))
		return
	}
	if r.URL.Query().Get("dryRun") == "1" {
		pv, err := s.Shops.Preview(r.Context(), sh, o)
		if err != nil {
			s.orderResult(w, r, 0, false, err)
			return
		}
		writeJSON(w, http.StatusOK, pv)
		return
	}
	docID, dup, err := s.Shops.Ingest(r.Context(), sh, o)
	s.orderResult(w, r, docID, dup, err)
}
