package api

import (
	"context"
	"crypto/sha256"
	"encoding/hex"
	"io"
	"math"
	"mime"
	"net/http"
	"strconv"
	"strings"
	"time"

	"github.com/Raktim94/nodedr-invoice/rewrite/internal/ecommerce"
	"github.com/Raktim94/nodedr-invoice/rewrite/internal/entity"
	"github.com/Raktim94/nodedr-invoice/rewrite/internal/httpx"
	"github.com/Raktim94/nodedr-invoice/rewrite/internal/invoices"
	"github.com/Raktim94/nodedr-invoice/rewrite/internal/orders"
	"github.com/Raktim94/nodedr-invoice/rewrite/internal/secrets"
	"github.com/Raktim94/nodedr-invoice/rewrite/internal/transfer"
)

func (a *authAPI) orderService() (*orders.Service, bool) {
	inv, ok := a.invoiceService()
	if !ok {
		return nil, false
	}
	return &orders.Service{Repo: inv.Repo, Invoices: inv, Box: a.box, Now: a.now}, true
}

func (a *authAPI) orderHandler(h func(ctx context.Context, svc *orders.Service, w http.ResponseWriter, r *http.Request)) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		svc, ok := a.orderService()
		if !ok {
			httpx.Fail(w, http.StatusBadRequest, "error.databaseNotInitialized")
			return
		}
		h(r.Context(), svc, w, r)
	}
}

// baseURL is how this server was reached, for the webhook addresses it shows.
func baseURL(r *http.Request, trustProxy bool) string {
	scheme := "http"
	if r.TLS != nil {
		scheme = "https"
	}
	if p := r.Header.Get("X-Forwarded-Proto"); trustProxy && p != "" {
		scheme = strings.TrimSpace(strings.Split(p, ",")[0])
	}
	return scheme + "://" + r.Host
}

func (a *authAPI) mountOrders(mux *http.ServeMux, hops int, box *secrets.Box) {
	a.box = box
	trust := hops > 0

	mux.HandleFunc("GET /api/ecommerce/integrations", a.requireAuth(a.orderHandler(func(ctx context.Context, svc *orders.Service, w http.ResponseWriter, r *http.Request) {
		rows, err := svc.List(ctx, baseURL(r, trust))
		if err != nil {
			failed(w, err)
			return
		}
		succeeded(w, rows)
	})))
	mux.HandleFunc("POST /api/ecommerce/integrations", a.requireAuth(a.orderHandler(func(ctx context.Context, svc *orders.Service, w http.ResponseWriter, r *http.Request) {
		row, ok := readRow(r, nil)
		if !ok {
			row = entity.Row{}
		}
		name, isStr := row["name"].(string)
		platform, _ := row["platform"].(string)
		if !isStr || !orders.ValidPlatform(platform) {
			httpx.Fail(w, http.StatusBadRequest, "error.invalidRequest")
			return
		}
		optNum := func(k string) *float64 {
			if row[k] == nil {
				return nil
			}
			f := orders.Num(row[k])
			return &f
		}
		in := orders.NewIntegration{Name: name, Platform: platform, BusinessID: orders.Num(row["businessId"]),
			CurrencyID: orders.Num(row["currencyId"]), BankID: optNum("bankId"), LayoutID: optNum("layoutId"),
			StyleProfilesID: optNum("styleProfilesId"), DefaultTaxRate: optNum("defaultTaxRate")}
		if row["autoIssue"] != nil {
			b := orders.Truthy(row["autoIssue"])
			in.AutoIssue = &b
		}
		if p := principalFrom(ctx); p.kind == bySession {
			in.CreatedByUserID = p.userID
		}
		id, plat, secret, err := svc.Create(ctx, in)
		if err != nil {
			f := entity.MapError(err)
			env := httpx.Envelope{Success: false, Key: f.Key}
			if f.Message != "" {
				env.Message = &f.Message
			}
			httpx.WriteJSON(w, http.StatusBadRequest, env)
			return
		}
		succeeded(w, entity.Row{"webhookSecret": secret,
			"webhookUrl":  baseURL(r, trust) + "/api/webhooks/ecommerce/" + plat + "/" + strconv.FormatInt(id, 10),
			"integration": entity.Row{"id": id, "name": strings.TrimSpace(name), "platform": plat}})
	})))
	mux.HandleFunc("DELETE /api/ecommerce/integrations/{id}", a.requireAuth(a.orderHandler(func(ctx context.Context, svc *orders.Service, w http.ResponseWriter, r *http.Request) {
		if err := svc.Delete(ctx, entity.IDFromPath(r.PathValue("id"))); err != nil {
			failed(w, err)
			return
		}
		httpx.WriteJSON(w, http.StatusOK, httpx.Envelope{Success: true})
	})))
	mux.HandleFunc("POST /api/ecommerce/integrations/{id}/deactivate", a.requireAuth(a.orderHandler(func(ctx context.Context, svc *orders.Service, w http.ResponseWriter, r *http.Request) {
		if err := svc.Deactivate(ctx, entity.IDFromPath(r.PathValue("id"))); err != nil {
			failed(w, err)
			return
		}
		httpx.WriteJSON(w, http.StatusOK, httpx.Envelope{Success: true})
	})))

	// The webhook is public: trust comes from the HMAC signature alone. It is
	// limited per integration (not per address), because a platform may call
	// from many addresses but only ever for one integration.
	limit := httpx.NewLimiter(time.Minute, 60, hops)
	limit.Key = func(r *http.Request) string { return r.PathValue("integrationId") }
	mux.HandleFunc("POST /api/webhooks/ecommerce/{platform}/{integrationId}", limit.Middleware(http.HandlerFunc(a.webhook)).ServeHTTP)

	a.mountPublicAPI(mux)
}

func isJSON(r *http.Request) bool {
	mt, _, err := mime.ParseMediaType(r.Header.Get("Content-Type"))
	return err == nil && (mt == "application/json" || strings.HasSuffix(mt, "+json"))
}

func (a *authAPI) webhook(w http.ResponseWriter, r *http.Request) {
	svc, ok := a.orderService()
	if !ok {
		httpx.Fail(w, http.StatusServiceUnavailable, "error.databaseNotInitialized")
		return
	}
	ctx := r.Context()
	platform := r.PathValue("platform")
	if !orders.ValidPlatform(platform) {
		httpx.Fail(w, http.StatusNotFound, "error.notFound")
		return
	}
	integ, err := svc.Active(ctx, entity.IDFromPath(r.PathValue("integrationId")))
	if err != nil {
		failed(w, err)
		return
	}
	// The same 404 whether the id is unknown, switched off or belongs to
	// another platform, so a stranger learns nothing about which it is.
	if integ == nil || integ.Platform != platform {
		httpx.Fail(w, http.StatusNotFound, "error.notFound")
		return
	}
	raw, err := io.ReadAll(r.Body)
	if err != nil || len(raw) == 0 || !isJSON(r) {
		httpx.Fail(w, http.StatusBadRequest, "error.invalidRequest")
		return
	}
	secret, err := svc.Secret(integ)
	if err != nil {
		// The key changed or was lost: our problem, but never process an
		// order we cannot authenticate.
		httpx.Fail(w, http.StatusServiceUnavailable, "error.unknownError")
		return
	}
	p := ecommerce.Platform(platform)
	if !ecommerce.VerifySignature(p, raw, r.Header.Get(ecommerce.SignatureHeader(p)), secret) {
		httpx.Fail(w, http.StatusUnauthorized, "error.unauthorized")
		return
	}
	payload, ok := parsePayload(raw)
	if !ok {
		httpx.Fail(w, http.StatusBadRequest, "error.invalidRequest")
		return
	}
	order := orders.Normalize(platform, payload)
	if !orders.Truthy(order.ExternalID) || len(order.Lines) == 0 {
		httpx.Fail(w, http.StatusBadRequest, "error.invalidRequest")
		return
	}
	_ = svc.Touch(ctx, integ.ID)
	a.ingest(ctx, svc, w, integ, order, hashHex(raw), http.StatusOK)
}

func hashHex(b []byte) string {
	sum := sha256.Sum256(b)
	return hex.EncodeToString(sum[:])
}

// ingest records an order and invoices it; a redelivery of a processed order
// only repeats the earlier answer.
func (a *authAPI) ingest(ctx context.Context, svc *orders.Service, w http.ResponseWriter, integ *orders.Integration, order orders.Order, payloadHash string, okStatus int) {
	existing, err := svc.FindOrder(ctx, integ.ID, order.ExternalID)
	if err != nil {
		failed(w, err)
		return
	}
	if existing != nil && existing.Status == "processed" {
		var invoiceID any
		if existing.InvoiceID.Valid {
			invoiceID = existing.InvoiceID.Int64
		}
		succeeded(w, entity.Row{"invoiceId": invoiceID, "deduplicated": true})
		return
	}
	var recordID int64
	if existing != nil {
		recordID = existing.ID
	} else if recordID, err = svc.RecordReceived(ctx, integ.ID, order.ExternalID, payloadHash); err != nil {
		failed(w, err)
		return
	}
	invoiceID, number, err := svc.CreateInvoice(ctx, integ, order)
	if err != nil {
		f := entity.MapError(err)
		reason := f.Message
		if reason == "" {
			reason = f.Key
		}
		if reason == "" {
			reason = "unknown"
		}
		_ = svc.MarkFailed(ctx, recordID, reason)
		key := f.Key
		if key == "" {
			key = "error.unknownError"
		}
		// 500, not 400: the request was valid and signed, the work failed on
		// our side, which is what a platform's retry exists for.
		httpx.Fail(w, http.StatusInternalServerError, key)
		return
	}
	_ = svc.MarkProcessed(ctx, recordID, invoiceID)
	httpx.WriteJSON(w, okStatus, httpx.Envelope{Success: true, Data: entity.Row{"invoiceId": invoiceID, "invoiceNumber": number}})
}

// ---- public API v1 ---------------------------------------------------------------

func (a *authAPI) mountPublicAPI(mux *http.ServeMux) {
	mux.HandleFunc("POST /api/v1/orders", a.requireAuth(a.orderHandler(func(ctx context.Context, svc *orders.Service, w http.ResponseWriter, r *http.Request) {
		raw, _ := io.ReadAll(r.Body)
		payload, ok := parsePayload(raw)
		if !ok {
			payload = map[string]any{}
		}
		integ, err := svc.Active(ctx, entity.IDFromPath(orders.Str(payload["integrationId"])))
		if err != nil {
			failed(w, err)
			return
		}
		if integ == nil || payload["integrationId"] == nil {
			httpx.Fail(w, http.StatusNotFound, "error.notFound")
			return
		}
		order := orders.NormalizeGeneric(payload)
		valid := false
		if id, isStr := order.ExternalID.(string); isStr && id != "" {
			if _, nameIsStr := order.Customer.Name.(string); nameIsStr && len(order.Lines) > 0 {
				valid = true
				for _, l := range order.Lines {
					_, lineNameIsStr := l.Name.(string)
					q, p := orders.Num(l.Quantity), orders.Num(l.UnitPriceMajor)
					if !lineNameIsStr || !(q > 0) || math.IsNaN(p) || math.IsInf(p, 0) {
						valid = false
					}
				}
			}
		}
		if !valid {
			httpx.Fail(w, http.StatusBadRequest, "error.invalidRequest")
			return
		}
		a.ingest(ctx, svc, w, integ, order, "api-v1", http.StatusCreated)
	})))
	mux.HandleFunc("GET /api/v1/invoices", a.invoiceHandler(func(ctx context.Context, svc *invoices.Service, w http.ResponseWriter, r *http.Request) {
		q := r.URL.Query()
		query := invoices.Query{Type: q.Get("type"), Status: q.Get("status"), Search: q.Get("search"), From: q.Get("from"), To: q.Get("to")}
		if query.Type != "invoice" && query.Type != "quotation" {
			query.Type = ""
		}
		query.ClientID = queryNumber(q.Get("clientId"))
		query.Limit = queryNumber(q.Get("limit"))
		query.Offset = queryNumber(q.Get("offset"))
		page, err := svc.Find(ctx, query)
		if err != nil {
			httpx.Fail(w, http.StatusInternalServerError, "error.unknownError")
			return
		}
		succeeded(w, page)
	}))
	mux.HandleFunc("GET /api/v1/invoices/{id}", a.invoiceHandler(func(ctx context.Context, svc *invoices.Service, w http.ResponseWriter, r *http.Request) {
		inv, err := svc.ByID(ctx, entity.IDFromPath(r.PathValue("id")))
		if err != nil {
			httpx.Fail(w, http.StatusInternalServerError, "error.unknownError")
			return
		}
		if inv == nil {
			httpx.Fail(w, http.StatusNotFound, "error.invoiceNotFound")
			return
		}
		succeeded(w, inv)
	}))
}

// queryNumber is num(): a finite number or nothing.
func queryNumber(v string) *float64 {
	if v == "" {
		return nil
	}
	f, err := strconv.ParseFloat(strings.TrimSpace(v), 64)
	if err != nil || math.IsNaN(f) || math.IsInf(f, 0) {
		return nil
	}
	return &f
}

// parsePayload reads a webhook or API body. A body that is JSON but not an
// object is treated as an empty one, as the old server's parser did.
func parsePayload(raw []byte) (map[string]any, bool) {
	doc, err := transfer.Parse(raw)
	if err != nil {
		return nil, false
	}
	if m, ok := doc.(map[string]any); ok {
		return m, true
	}
	return map[string]any{}, true
}
