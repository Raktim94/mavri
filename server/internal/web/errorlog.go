package web

import (
	"context"
	"log/slog"
	"sync"
	"time"
)

// ErrorLog keeps the most recent warnings and errors in memory for the health page.
type ErrorLog struct {
	mu    sync.Mutex
	items []ErrorItem
}

// ErrorItem is one remembered log record.
type ErrorItem struct {
	At      string `json:"at"`
	Level   string `json:"level"`
	Message string `json:"message"`
	Detail  string `json:"detail"`
}

const errorLogSize = 50

func (e *ErrorLog) add(it ErrorItem) {
	e.mu.Lock()
	defer e.mu.Unlock()
	e.items = append(e.items, it)
	if len(e.items) > errorLogSize {
		e.items = e.items[len(e.items)-errorLogSize:]
	}
}

// Recent returns the newest first.
func (e *ErrorLog) Recent() []ErrorItem {
	e.mu.Lock()
	defer e.mu.Unlock()
	out := make([]ErrorItem, 0, len(e.items))
	for i := len(e.items) - 1; i >= 0; i-- {
		out = append(out, e.items[i])
	}
	return out
}

// captureHandler passes records on and remembers warnings and errors.
type captureHandler struct {
	slog.Handler
	log *ErrorLog
}

func (h captureHandler) Handle(ctx context.Context, r slog.Record) error {
	if r.Level >= slog.LevelWarn {
		detail := ""
		r.Attrs(func(a slog.Attr) bool {
			if a.Key == "error" || a.Key == "path" {
				detail += a.Key + "=" + a.Value.String() + " "
			}
			return true
		})
		h.log.add(ErrorItem{At: r.Time.UTC().Format(time.RFC3339), Level: r.Level.String(), Message: r.Message, Detail: detail})
	}
	return h.Handler.Handle(ctx, r)
}

func (h captureHandler) WithAttrs(a []slog.Attr) slog.Handler {
	return captureHandler{h.Handler.WithAttrs(a), h.log}
}
func (h captureHandler) WithGroup(n string) slog.Handler {
	return captureHandler{h.Handler.WithGroup(n), h.log}
}

// WithErrorLog returns a logger that also remembers warnings and errors, and the log they go to.
func WithErrorLog(base *slog.Logger) (*slog.Logger, *ErrorLog) {
	el := &ErrorLog{}
	return slog.New(captureHandler{base.Handler(), el}), el
}

// errorLogFrom finds the ErrorLog of a logger made by WithErrorLog, or makes an empty one.
func errorLogFrom(l *slog.Logger) *ErrorLog {
	if h, ok := l.Handler().(captureHandler); ok {
		return h.log
	}
	return &ErrorLog{}
}
