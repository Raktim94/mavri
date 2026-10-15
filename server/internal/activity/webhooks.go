package activity

import (
	"bytes"
	"context"
	"crypto/hmac"
	"crypto/sha256"
	"database/sql"
	"encoding/hex"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"strconv"
	"strings"
	"time"
)

// ErrInvalid is a problem with what the caller sent.
var ErrInvalid = errors.New("invalid")

// ErrNotFound means the endpoint or delivery does not exist.
var ErrNotFound = errors.New("not found")

// retryDelays is the wait before each new attempt; after the last one a delivery is marked failed.
var retryDelays = []time.Duration{time.Minute, 5 * time.Minute, 30 * time.Minute, 2 * time.Hour, 6 * time.Hour}

// Endpoint is a URL that receives events.
type Endpoint struct {
	ID          int64    `json:"id"`
	URL         string   `json:"url"`
	Description string   `json:"description"`
	Events      []string `json:"events"` // ["*"] means all
	Active      bool     `json:"active"`
	CreatedAt   string   `json:"createdAt"`
	Failing     int      `json:"failing"` // deliveries that gave up
	LastStatus  string   `json:"lastStatus"`
}

// Delivery is one attempt series to one endpoint.
type Delivery struct {
	ID            int64  `json:"id"`
	EndpointID    int64  `json:"endpointId"`
	Event         string `json:"event"`
	EventID       string `json:"eventId"`
	Status        string `json:"status"`
	Attempts      int    `json:"attempts"`
	ResponseCode  int    `json:"responseCode"`
	ResponseBody  string `json:"responseBody"`
	Error         string `json:"error"`
	NextAttemptAt string `json:"nextAttemptAt"`
	CreatedAt     string `json:"createdAt"`
	DeliveredAt   string `json:"deliveredAt"`
	Payload       string `json:"payload,omitempty"`
}

func validEvents(in []string) ([]string, error) {
	if len(in) == 0 {
		return []string{"*"}, nil
	}
	known := map[string]bool{"*": true}
	for _, e := range Events {
		known[e] = true
	}
	seen := map[string]bool{}
	var out []string
	for _, e := range in {
		e = strings.TrimSpace(e)
		if !known[e] {
			return nil, fmt.Errorf("%w: unknown event %q", ErrInvalid, e)
		}
		if !seen[e] {
			seen[e] = true
			out = append(out, e)
		}
	}
	return out, nil
}

func validURL(raw string) error {
	u, err := url.Parse(strings.TrimSpace(raw))
	if err != nil || (u.Scheme != "http" && u.Scheme != "https") || u.Host == "" {
		return fmt.Errorf("%w: the URL must start with http:// or https://", ErrInvalid)
	}
	return nil
}

// CreateEndpoint stores a new endpoint and returns it with its signing secret, shown only once.
func (h *Hub) CreateEndpoint(ctx context.Context, rawURL, description string, events []string) (Endpoint, string, error) {
	rawURL = strings.TrimSpace(rawURL)
	if err := validURL(rawURL); err != nil {
		return Endpoint{}, "", err
	}
	evs, err := validEvents(events)
	if err != nil {
		return Endpoint{}, "", err
	}
	secret := "whsec_" + randomHex(24)
	sealed, err := h.Box.Seal(secret)
	if err != nil {
		return Endpoint{}, "", err
	}
	now := stamp(h.now())
	res, err := h.DB.ExecContext(ctx, `INSERT INTO webhook_endpoints (url, description, secret_sealed, events, active, created_at) VALUES (?, ?, ?, ?, 1, ?)`,
		rawURL, strings.TrimSpace(description), sealed, strings.Join(evs, ","), now)
	if err != nil {
		return Endpoint{}, "", err
	}
	id, _ := res.LastInsertId()
	return Endpoint{ID: id, URL: rawURL, Description: strings.TrimSpace(description), Events: evs, Active: true, CreatedAt: now}, secret, nil
}

// UpdateEndpoint changes the URL, description, events or active flag.
func (h *Hub) UpdateEndpoint(ctx context.Context, id int64, rawURL, description string, events []string, active bool) error {
	if err := validURL(rawURL); err != nil {
		return err
	}
	evs, err := validEvents(events)
	if err != nil {
		return err
	}
	res, err := h.DB.ExecContext(ctx, `UPDATE webhook_endpoints SET url = ?, description = ?, events = ?, active = ? WHERE id = ?`,
		strings.TrimSpace(rawURL), strings.TrimSpace(description), strings.Join(evs, ","), boolInt(active), id)
	if err != nil {
		return err
	}
	if n, _ := res.RowsAffected(); n == 0 {
		return ErrNotFound
	}
	return nil
}

// DeleteEndpoint removes an endpoint and its delivery log.
func (h *Hub) DeleteEndpoint(ctx context.Context, id int64) error {
	res, err := h.DB.ExecContext(ctx, `DELETE FROM webhook_endpoints WHERE id = ?`, id)
	if err != nil {
		return err
	}
	if n, _ := res.RowsAffected(); n == 0 {
		return ErrNotFound
	}
	return nil
}

func boolInt(b bool) int {
	if b {
		return 1
	}
	return 0
}

// Endpoints lists them with how many deliveries gave up.
func (h *Hub) Endpoints(ctx context.Context) ([]Endpoint, error) {
	rows, err := h.DB.QueryContext(ctx, `SELECT e.id, e.url, e.description, e.events, e.active, e.created_at,
		(SELECT COUNT(*) FROM webhook_deliveries d WHERE d.endpoint_id = e.id AND d.status = 'failed'),
		COALESCE((SELECT d.status FROM webhook_deliveries d WHERE d.endpoint_id = e.id ORDER BY d.id DESC LIMIT 1), '')
		FROM webhook_endpoints e ORDER BY e.id`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	out := []Endpoint{}
	for rows.Next() {
		var e Endpoint
		var evs string
		var active int
		if err := rows.Scan(&e.ID, &e.URL, &e.Description, &evs, &active, &e.CreatedAt, &e.Failing, &e.LastStatus); err != nil {
			return nil, err
		}
		e.Events, e.Active = strings.Split(evs, ","), active == 1
		out = append(out, e)
	}
	return out, rows.Err()
}

// Emit queues the event for every active endpoint subscribed to it.
func (h *Hub) Emit(ctx context.Context, name string, data any) error {
	rows, err := h.DB.QueryContext(ctx, `SELECT id, events FROM webhook_endpoints WHERE active = 1`)
	if err != nil {
		return err
	}
	var ids []int64
	for rows.Next() {
		var id int64
		var evs string
		if err := rows.Scan(&id, &evs); err != nil {
			rows.Close()
			return err
		}
		for _, e := range strings.Split(evs, ",") {
			if e == "*" || e == name {
				ids = append(ids, id)
				break
			}
		}
	}
	rows.Close()
	if len(ids) == 0 {
		return nil
	}
	raw, err := json.Marshal(data)
	if err != nil {
		return err
	}
	now := h.now()
	body, _ := json.Marshal(envelope{ID: "evt_" + randomHex(12), Type: name, CreatedAt: stamp(now), Data: raw})
	var env envelope
	_ = json.Unmarshal(body, &env)
	for _, id := range ids {
		if _, err := h.DB.ExecContext(ctx, `INSERT INTO webhook_deliveries (endpoint_id, event, event_id, payload, status, next_attempt_at, created_at)
			VALUES (?, ?, ?, ?, 'pending', ?, ?)`, id, name, env.ID, string(body), stamp(now), stamp(now)); err != nil {
			return err
		}
	}
	return nil
}

// Deliveries lists the log, newest first; endpointID 0 means all endpoints.
func (h *Hub) Deliveries(ctx context.Context, endpointID int64, status string, limit int) ([]Delivery, error) {
	if limit <= 0 || limit > 500 {
		limit = 100
	}
	q := `SELECT id, endpoint_id, event, event_id, status, attempts, response_code, response_body, error, next_attempt_at, created_at, delivered_at FROM webhook_deliveries WHERE 1=1`
	var args []any
	if endpointID != 0 {
		q += ` AND endpoint_id = ?`
		args = append(args, endpointID)
	}
	if status != "" {
		q += ` AND status = ?`
		args = append(args, status)
	}
	rows, err := h.DB.QueryContext(ctx, q+` ORDER BY id DESC LIMIT ?`, append(args, limit)...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	out := []Delivery{}
	for rows.Next() {
		var d Delivery
		if err := rows.Scan(&d.ID, &d.EndpointID, &d.Event, &d.EventID, &d.Status, &d.Attempts, &d.ResponseCode, &d.ResponseBody, &d.Error, &d.NextAttemptAt, &d.CreatedAt, &d.DeliveredAt); err != nil {
			return nil, err
		}
		out = append(out, d)
	}
	return out, rows.Err()
}

// Replay queues a copy of a past delivery (same event id and payload) for a fresh attempt series.
func (h *Hub) Replay(ctx context.Context, deliveryID int64) (int64, error) {
	var endpoint int64
	var event, eventID, payload string
	err := h.DB.QueryRowContext(ctx, `SELECT endpoint_id, event, event_id, payload FROM webhook_deliveries WHERE id = ?`, deliveryID).Scan(&endpoint, &event, &eventID, &payload)
	if errors.Is(err, sql.ErrNoRows) {
		return 0, ErrNotFound
	}
	if err != nil {
		return 0, err
	}
	now := stamp(h.now())
	res, err := h.DB.ExecContext(ctx, `INSERT INTO webhook_deliveries (endpoint_id, event, event_id, payload, status, next_attempt_at, created_at)
		VALUES (?, ?, ?, ?, 'pending', ?, ?)`, endpoint, event, eventID, payload, now, now)
	if err != nil {
		return 0, err
	}
	return res.LastInsertId()
}

// SendTest queues a "ping" event for one endpoint, whatever its subscriptions.
func (h *Hub) SendTest(ctx context.Context, endpointID int64) (int64, error) {
	var n int
	if err := h.DB.QueryRowContext(ctx, `SELECT COUNT(*) FROM webhook_endpoints WHERE id = ?`, endpointID).Scan(&n); err != nil || n == 0 {
		return 0, ErrNotFound
	}
	now := h.now()
	body, _ := json.Marshal(envelope{ID: "evt_" + randomHex(12), Type: "ping", CreatedAt: stamp(now), Data: json.RawMessage(`{"message":"This is a test event from Mavri."}`)})
	var env envelope
	_ = json.Unmarshal(body, &env)
	res, err := h.DB.ExecContext(ctx, `INSERT INTO webhook_deliveries (endpoint_id, event, event_id, payload, status, next_attempt_at, created_at)
		VALUES (?, 'ping', ?, ?, 'pending', ?, ?)`, endpointID, env.ID, string(body), stamp(now), stamp(now))
	if err != nil {
		return 0, err
	}
	return res.LastInsertId()
}

// Sign is the Mavri-Signature header value: "t=<unix>,v1=<hex HMAC-SHA256 of "t.body">".
func Sign(secret string, t time.Time, body []byte) string {
	m := hmac.New(sha256.New, []byte(secret))
	m.Write([]byte(strconv.FormatInt(t.Unix(), 10) + "."))
	m.Write(body)
	return fmt.Sprintf("t=%d,v1=%s", t.Unix(), hex.EncodeToString(m.Sum(nil)))
}

// Run delivers queued events until ctx ends.
func (h *Hub) Run(ctx context.Context) {
	client := &http.Client{Timeout: 10 * time.Second, CheckRedirect: func(*http.Request, []*http.Request) error { return http.ErrUseLastResponse }}
	tick := time.NewTicker(3 * time.Second)
	defer tick.Stop()
	for {
		h.DeliverDue(ctx, client)
		select {
		case <-ctx.Done():
			return
		case <-tick.C:
		}
	}
}

// DeliverDue makes one pass over the deliveries that are due.
func (h *Hub) DeliverDue(ctx context.Context, client *http.Client) {
	rows, err := h.DB.QueryContext(ctx, `SELECT d.id, d.payload, d.attempts, d.event_id, d.event, e.url, e.secret_sealed
		FROM webhook_deliveries d JOIN webhook_endpoints e ON e.id = d.endpoint_id
		WHERE d.status = 'pending' AND d.next_attempt_at <= ? AND e.active = 1 ORDER BY d.id LIMIT 50`, stamp(h.now()))
	if err != nil {
		return
	}
	type job struct {
		id                           int64
		payload, eventID, event, url string
		sealed                       string
		attempts                     int
	}
	var jobs []job
	for rows.Next() {
		var j job
		if rows.Scan(&j.id, &j.payload, &j.attempts, &j.eventID, &j.event, &j.url, &j.sealed) == nil {
			jobs = append(jobs, j)
		}
	}
	rows.Close()
	for _, j := range jobs {
		code, body, derr := h.send(ctx, client, j.url, j.sealed, j.payload, j.eventID, j.event, j.id)
		attempts := j.attempts + 1
		now := h.now()
		switch {
		case derr == nil && code >= 200 && code < 300:
			_, _ = h.DB.ExecContext(ctx, `UPDATE webhook_deliveries SET status = 'delivered', attempts = ?, response_code = ?, response_body = ?, error = '', delivered_at = ?, next_attempt_at = '' WHERE id = ?`,
				attempts, code, body, stamp(now), j.id)
		case attempts > len(retryDelays):
			_, _ = h.DB.ExecContext(ctx, `UPDATE webhook_deliveries SET status = 'failed', attempts = ?, response_code = ?, response_body = ?, error = ?, next_attempt_at = '' WHERE id = ?`,
				attempts, code, body, errText(derr, code), j.id)
		default:
			_, _ = h.DB.ExecContext(ctx, `UPDATE webhook_deliveries SET attempts = ?, response_code = ?, response_body = ?, error = ?, next_attempt_at = ? WHERE id = ?`,
				attempts, code, body, errText(derr, code), stamp(now.Add(retryDelays[attempts-1])), j.id)
		}
	}
}

func errText(err error, code int) string {
	if err != nil {
		return err.Error()
	}
	return "the endpoint answered " + strconv.Itoa(code)
}

func (h *Hub) send(ctx context.Context, client *http.Client, target, sealed, payload, eventID, event string, deliveryID int64) (int, string, error) {
	secret, err := h.Box.Open(sealed)
	if err != nil {
		return 0, "", errors.New("the signing secret cannot be read")
	}
	req, err := http.NewRequestWithContext(ctx, http.MethodPost, target, strings.NewReader(payload))
	if err != nil {
		return 0, "", err
	}
	now := h.now()
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("User-Agent", "Mavri-Webhooks/1")
	req.Header.Set("Mavri-Event", event)
	req.Header.Set("Mavri-Event-Id", eventID)
	req.Header.Set("Mavri-Delivery", strconv.FormatInt(deliveryID, 10))
	req.Header.Set("Mavri-Signature", Sign(secret, now, []byte(payload)))
	resp, err := client.Do(req)
	if err != nil {
		return 0, "", err
	}
	defer resp.Body.Close()
	var buf bytes.Buffer
	_, _ = io.Copy(&buf, io.LimitReader(resp.Body, 2048))
	return resp.StatusCode, buf.String(), nil
}
