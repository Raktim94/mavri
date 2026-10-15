package web

import (
	"errors"
	"net/http"
	"time"

	"github.com/Raktim94/mavri/server/internal/activity"
	"github.com/Raktim94/mavri/server/internal/auth"
)

type credentials struct {
	Email    string `json:"email"`
	Password string `json:"password"`
}

func (s *Server) setCookie(w http.ResponseWriter, token string, maxAge int) {
	http.SetCookie(w, &http.Cookie{Name: sessionCookie, Value: token, Path: "/", HttpOnly: true, Secure: s.Cfg.CookieSecure,
		SameSite: http.SameSiteLaxMode, MaxAge: maxAge, Expires: time.Now().Add(time.Duration(maxAge) * time.Second)})
}

func (s *Server) setupStatus(w http.ResponseWriter, r *http.Request) {
	need, err := s.Auth.NeedsSetup(r.Context())
	if err != nil {
		s.problem(w, r, err)
		return
	}
	writeJSON(w, http.StatusOK, map[string]bool{"needsSetup": need})
}

func (s *Server) setup(w http.ResponseWriter, r *http.Request) {
	var c credentials
	if !readJSON(w, r, &c) {
		return
	}
	u, err := s.Auth.CreateOwner(r.Context(), c.Email, c.Password)
	switch {
	case errors.Is(err, auth.ErrEmail):
		fail(w, http.StatusBadRequest, "validation", "enter a valid email address")
		return
	case errors.Is(err, auth.ErrWeak):
		fail(w, http.StatusBadRequest, "validation", "use at least 8 characters with letters and numbers")
		return
	case errors.Is(err, auth.ErrSetUp):
		fail(w, http.StatusForbidden, "forbidden", "Mavri is already set up")
		return
	case err != nil:
		s.problem(w, r, err)
		return
	}
	_, token, err := s.Auth.Login(r.Context(), c.Email, c.Password)
	if err != nil {
		s.problem(w, r, err)
		return
	}
	s.setCookie(w, token, 14*24*3600)
	writeJSON(w, http.StatusCreated, u)
}

func (s *Server) login(w http.ResponseWriter, r *http.Request) {
	var c credentials
	if !readJSON(w, r, &c) {
		return
	}
	u, token, err := s.Auth.Login(r.Context(), c.Email, c.Password)
	switch {
	case errors.Is(err, auth.ErrInvalidLogin):
		fail(w, http.StatusUnauthorized, "invalid_login", "wrong email or password")
		return
	case errors.Is(err, auth.ErrLocked):
		fail(w, http.StatusLocked, "locked", "too many attempts, try again in a few minutes")
		return
	case err != nil:
		s.problem(w, r, err)
		return
	}
	s.setCookie(w, token, 14*24*3600)
	s.Hub.Record(activity.WithSource(r.Context(), activity.SourceUI, u.Email), activity.Event{Action: "signed in", Entity: "session", Label: u.Email})
	writeJSON(w, http.StatusOK, u)
}

func (s *Server) me(w http.ResponseWriter, r *http.Request) {
	p := principalFrom(r.Context())
	if p.UserID == 0 {
		writeJSON(w, http.StatusOK, map[string]any{"apiKey": true})
		return
	}
	c, _ := r.Cookie(sessionCookie)
	u, err := s.Auth.UserForSession(r.Context(), c.Value)
	if err != nil {
		fail(w, http.StatusUnauthorized, "unauthorized", "sign in first")
		return
	}
	writeJSON(w, http.StatusOK, u)
}

func (s *Server) logout(w http.ResponseWriter, r *http.Request) {
	if c, err := r.Cookie(sessionCookie); err == nil {
		_ = s.Auth.Logout(r.Context(), c.Value)
	}
	s.setCookie(w, "", -1)
	w.WriteHeader(http.StatusNoContent)
}

func (s *Server) listKeys(w http.ResponseWriter, r *http.Request) {
	keys, err := s.Auth.ListKeys(r.Context())
	if err != nil {
		s.problem(w, r, err)
		return
	}
	writeJSON(w, http.StatusOK, keys)
}

func (s *Server) createKey(w http.ResponseWriter, r *http.Request) {
	var in struct {
		Label string `json:"label"`
	}
	_ = readJSONOptional(r, &in)
	k, secret, err := s.Auth.CreateKey(r.Context(), in.Label, principalFrom(r.Context()).UserID)
	if err != nil {
		s.problem(w, r, err)
		return
	}
	s.Hub.Record(r.Context(), activity.Event{Action: "created", Entity: "API key", EntityID: k.ID, Label: k.Label})
	writeJSON(w, http.StatusCreated, map[string]any{"key": k, "secret": secret})
}

func (s *Server) revokeKey(w http.ResponseWriter, r *http.Request) {
	id, ok := pathID(r)
	if !ok {
		fail(w, http.StatusBadRequest, "validation", "bad id")
		return
	}
	if err := s.Auth.RevokeKey(r.Context(), id); err != nil {
		fail(w, http.StatusNotFound, "not_found", "no such active key")
		return
	}
	s.Hub.Record(r.Context(), activity.Event{Action: "revoked", Entity: "API key", EntityID: id})
	w.WriteHeader(http.StatusNoContent)
}
