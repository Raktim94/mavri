package httpx

import (
	"net/http"
	"strconv"
	"sync"
	"time"
)

// Limiter is a fixed-window, per-client request limiter. State is in memory
// and per process, like express-rate-limit's default store.
type Limiter struct {
	Window time.Duration
	Max    int
	Hops   int
	Now    func() time.Time // injectable for tests
	// Key picks what a request is counted against; the client address by default.
	Key func(*http.Request) string

	mu      sync.Mutex
	clients map[string]*window
}

type window struct {
	count int
	reset time.Time
}

// NewLimiter builds a limiter allowing max requests per window per client.
func NewLimiter(win time.Duration, max, hops int) *Limiter {
	return &Limiter{Window: win, Max: max, Hops: hops, Now: time.Now, clients: map[string]*window{}}
}

// Middleware enforces the limit and sets the standard RateLimit-* headers.
// Rejections use the existing `error.rateLimiter` key.
func (l *Limiter) Middleware(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		now := l.Now()
		ip := ""
		if l.Key != nil {
			ip = l.Key(r)
		} else {
			ip = ClientIP(r, l.Hops)
		}

		l.mu.Lock()
		l.sweep(now)
		c, ok := l.clients[ip]
		if !ok || !now.Before(c.reset) {
			c = &window{reset: now.Add(l.Window)}
			l.clients[ip] = c
		}
		c.count++
		count, reset := c.count, c.reset
		l.mu.Unlock()

		secs := int(reset.Sub(now).Seconds() + 0.999)
		remaining := l.Max - count
		if remaining < 0 {
			remaining = 0
		}
		h := w.Header()
		h.Set("RateLimit-Limit", strconv.Itoa(l.Max))
		h.Set("RateLimit-Remaining", strconv.Itoa(remaining))
		h.Set("RateLimit-Reset", strconv.Itoa(secs))
		if count > l.Max {
			h.Set("Retry-After", strconv.Itoa(secs))
			Fail(w, http.StatusTooManyRequests, "error.rateLimiter")
			return
		}
		next.ServeHTTP(w, r)
	})
}

// sweep drops expired windows so the map cannot grow without bound.
// Callers must hold l.mu.
func (l *Limiter) sweep(now time.Time) {
	if len(l.clients) < 1024 {
		return
	}
	for k, c := range l.clients {
		if !now.Before(c.reset) {
			delete(l.clients, k)
		}
	}
}
