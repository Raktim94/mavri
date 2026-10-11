// Package httpx holds transport helpers shared by every REST handler:
// the response envelope and the middleware stack.
package httpx

import (
	"encoding/json"
	"net/http"
)

// Envelope is the JSON shape the renderer already expects:
// {success, message, data, key}. Empty fields are omitted, matching how the
// TypeScript server serialises `undefined`.
type Envelope struct {
	Success bool    `json:"success"`
	Message *string `json:"message,omitempty"`
	Data    any     `json:"data,omitempty"`
	Key     string  `json:"key,omitempty"`
}

// WriteJSON writes v as JSON with the given status.
func WriteJSON(w http.ResponseWriter, status int, v any) {
	w.Header().Set("Content-Type", "application/json; charset=utf-8")
	w.WriteHeader(status)
	_ = json.NewEncoder(w).Encode(v)
}

// OK writes a successful envelope.
func OK(w http.ResponseWriter, data any) {
	WriteJSON(w, http.StatusOK, Envelope{Success: true, Data: data})
}

// Fail writes a failed envelope carrying a stable error key.
func Fail(w http.ResponseWriter, status int, key string) {
	WriteJSON(w, status, Envelope{Success: false, Key: key})
}
