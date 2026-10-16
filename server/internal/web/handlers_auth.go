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

// ---- team ----------------------------------------------------------------------

func (s *Server) teamProblem(w http.ResponseWriter, r *http.Request, err error) {
	switch {
	case errors.Is(err, auth.ErrEmail), errors.Is(err, auth.ErrRole), errors.Is(err, auth.ErrLastOwner), errors.Is(err, auth.ErrBadOld):
		fail(w, http.StatusBadRequest, "validation", err.Error())
	case errors.Is(err, auth.ErrWeak):
		fail(w, http.StatusBadRequest, "validation", "use at least 8 characters with letters and numbers")
	case errors.Is(err, auth.ErrEmailTaken):
		fail(w, http.StatusConflict, "conflict", err.Error())
	case errors.Is(err, auth.ErrNoUser):
		fail(w, http.StatusNotFound, "not_found", "no such account")
	default:
		s.problem(w, r, err)
	}
}

func (s *Server) listUsers(w http.ResponseWriter, r *http.Request) {
	rows, err := s.Auth.ListUsers(r.Context())
	if err != nil {
		s.problem(w, r, err)
		return
	}
	writeJSON(w, http.StatusOK, rows)
}

func (s *Server) createUser(w http.ResponseWriter, r *http.Request) {
	var in struct {
		Email    string `json:"email"`
		Password string `json:"password"`
		Role     string `json:"role"`
	}
	if !readJSON(w, r, &in) {
		return
	}
	m, err := s.Auth.CreateUser(r.Context(), in.Email, in.Password, in.Role)
	if err != nil {
		s.teamProblem(w, r, err)
		return
	}
	s.Hub.Record(r.Context(), activity.Event{Action: "added", Entity: "person", EntityID: m.ID, Label: m.Email, Detail: "role " + m.Role})
	writeJSON(w, http.StatusCreated, m)
}

func (s *Server) updateUser(w http.ResponseWriter, r *http.Request) {
	id, ok := idOf(w, r)
	if !ok {
		return
	}
	var in struct {
		Role     *string `json:"role"`
		Password *string `json:"password"`
	}
	if !readJSON(w, r, &in) {
		return
	}
	if in.Role != nil {
		if err := s.Auth.SetRole(r.Context(), id, *in.Role); err != nil {
			s.teamProblem(w, r, err)
			return
		}
		s.Hub.Record(r.Context(), activity.Event{Action: "changed role", Entity: "person", EntityID: id, Detail: "role " + *in.Role})
	}
	if in.Password != nil {
		if err := s.Auth.ResetPassword(r.Context(), id, *in.Password); err != nil {
			s.teamProblem(w, r, err)
			return
		}
		s.Hub.Record(r.Context(), activity.Event{Action: "reset password", Entity: "person", EntityID: id})
	}
	rows, _ := s.Auth.ListUsers(r.Context())
	for _, m := range rows {
		if m.ID == id {
			writeJSON(w, http.StatusOK, m)
			return
		}
	}
	fail(w, http.StatusNotFound, "not_found", "no such account")
}

func (s *Server) deleteUser(w http.ResponseWriter, r *http.Request) {
	id, ok := idOf(w, r)
	if !ok {
		return
	}
	if p, _ := r.Context().Value(principalKey).(principal); p.UserID == id {
		fail(w, http.StatusBadRequest, "validation", "you cannot remove your own account here; ask another owner")
		return
	}
	if err := s.Auth.DeleteUser(r.Context(), id); err != nil {
		s.teamProblem(w, r, err)
		return
	}
	s.Hub.Record(r.Context(), activity.Event{Action: "removed", Entity: "person", EntityID: id})
	w.WriteHeader(http.StatusNoContent)
}

// POST /api/session/password changes the signed-in person's own password.
func (s *Server) changePassword(w http.ResponseWriter, r *http.Request) {
	var in struct {
		Current  string `json:"current"`
		Password string `json:"password"`
	}
	if !readJSON(w, r, &in) {
		return
	}
	p, _ := r.Context().Value(principalKey).(principal)
	c, err := r.Cookie(sessionCookie)
	if err != nil || p.UserID == 0 {
		fail(w, http.StatusUnauthorized, "unauthorized", "sign in first")
		return
	}
	if err := s.Auth.ChangePassword(r.Context(), p.UserID, in.Current, in.Password, c.Value); err != nil {
		s.teamProblem(w, r, err)
		return
	}
	s.Hub.Record(r.Context(), activity.Event{Action: "changed password", Entity: "person", EntityID: p.UserID})
	w.WriteHeader(http.StatusNoContent)
}
