package api

import (
	"encoding/json"
	"fmt"
	"strings"
	"testing"
)

const png = "iVBORw0KGgo="

// invoiceBody is a complete invoice request, like the one the app sends.
func invoiceBody(t *testing.T, number string, over map[string]any) string {
	t.Helper()
	m := map[string]any{
		"invoiceType": "invoice", "businessId": 1, "clientId": 1, "currencyId": 1, "issuedAt": "2026-10-01",
		"invoiceNumber": number, "isArchived": false, "status": "unpaid", "discountAmountCents": "0",
		"discountPercent": 0, "shippingFeeCents": "0", "surchargeAmountCents": "0", "surchargePercent": 0, "taxRate": 10,
		"language": "en", "signatureData": png,
		"invoiceBusinessSnapshot": map[string]any{"businessName": "Me", "businessShortName": "ME", "businessLogo": png},
		"invoiceClientSnapshot":   map[string]any{"clientName": "Acme"},
		"invoiceCurrencySnapshot": map[string]any{"currencyCode": "USD", "currencySymbol": "$", "currencySubunit": 100},
		"invoiceItems": []any{map[string]any{"itemId": 1, "quantity": "2", "taxRate": 10,
			"customField":         map[string]any{"header": "Serial", "value": "A", "sortOrder": 1, "alignment": "left"},
			"invoiceItemSnapshot": map[string]any{"itemName": "Widget", "unitPriceCents": "1250"}}},
		"invoicePayments":    []any{map[string]any{"amountCents": "100", "paymentMethod": "cash"}},
		"invoiceAttachments": []any{map[string]any{"fileName": "a.png", "fileType": "image/png", "fileSize": 8, "data": png}},
	}
	for k, v := range over {
		if v == nil {
			delete(m, k)
		} else {
			m[k] = v
		}
	}
	b, err := json.Marshal(m)
	if err != nil {
		t.Fatal(err)
	}
	return string(b)
}

// invoiceEnv has the records an invoice points at.
func invoiceEnv(t *testing.T) (*env, func(method, path, body string) reply) {
	e, ck := sqlEnv(t)
	e.do("POST", "/api/businesses", `{"name":"Me","shortName":"ME"}`, nil, ck)
	e.do("POST", "/api/clients", `{"name":"Acme","shortName":"AC"}`, nil, ck)
	e.do("POST", "/api/items", `{"name":"Widget","amount":"12.50"}`, nil, ck)
	return e, func(method, path, body string) reply { return e.do(method, path, body, nil, ck) }
}

func TestInvoiceRoundTrip(t *testing.T) {
	_, do := invoiceEnv(t)
	r := do("POST", "/api/invoices", invoiceBody(t, "0001", nil))
	if r.Body["success"] != true {
		t.Fatalf("add: %v", r.Body)
	}
	d := r.data()
	if d["signatureData"] != png || d["currencyFormat"] == nil || d["isArchived"] != false || d["invoiceFullNumber"] == nil {
		t.Errorf("invoice columns: %v", d)
	}
	if bs := d["invoiceBusinessSnapshot"].(map[string]any); bs["businessLogo"] != png {
		t.Errorf("snapshot logo is base64: %v", bs)
	}
	items := d["invoiceItems"].([]any)
	line := items[0].(map[string]any)
	if cf := line["customField"].(map[string]any); cf["header"] != "Serial" {
		t.Errorf("customField is parsed JSON: %v", line["customField"])
	}
	if line["invoiceItemSnapshot"].(map[string]any)["itemName"] != "Widget" {
		t.Errorf("item snapshot: %v", line)
	}
	if att := d["invoiceAttachments"].([]any); len(att) != 1 || att[0].(map[string]any)["data"] != png {
		t.Errorf("attachments: %v", d["invoiceAttachments"])
	}
	if _, has := d["invoiceBankSnapshot"]; has {
		t.Error("an absent bank snapshot is absent, not null")
	}
	list := rows(t, do("GET", "/api/invoices?type=invoice", ""))
	if len(list) != 1 || list[0]["invoiceNumber"] != "0001" {
		t.Errorf("list: %v", list)
	}
	if got := rows(t, do("GET", "/api/invoices?type=quotation", "")); len(got) != 0 {
		t.Errorf("quotations: %v", got)
	}
}

func TestInvoiceFailureLeavesNothingBehind(t *testing.T) {
	e, do := invoiceEnv(t)
	bad := do("POST", "/api/invoices", invoiceBody(t, "0001", map[string]any{
		"invoiceItems": []any{map[string]any{"itemId": 999, "quantity": "1", "taxRate": 0}}}))
	if bad.Body["success"] != false || bad.key() != "error.invalidConstraintForeign" {
		t.Fatalf("bad item: %v", bad.Body)
	}
	for _, table := range []string{"invoices", "invoice_business_snapshots", "invoice_payments", "attachments", "invoice_sequences"} {
		var n int
		e.sql.DB().QueryRow(`SELECT COUNT(*) FROM ` + table).Scan(&n)
		if n != 0 {
			t.Errorf("%s has %d rows after a failed save", table, n)
		}
	}
	if r := do("POST", "/api/invoices", invoiceBody(t, "0001", map[string]any{"businessId": 999})); r.key() != "error.invalidConstraintForeign" || r.Body["message"] != nil {
		t.Errorf("invoice fk: %v", r.Body)
	}
	if r := do("POST", "/api/invoices", invoiceBody(t, "0001", map[string]any{"discountType": "bogus"})); r.key() != "error.invalidConstraintCheck" {
		t.Errorf("check: %v", r.Body)
	}
	if r := do("POST", "/api/invoices", invoiceBody(t, "0001", map[string]any{"invoiceBusinessSnapshot": nil})); r.key() != "error.invalidConstraintNotNull" {
		t.Errorf("missing snapshot: %v", r.Body)
	}
}

func TestPaidAndClosedStamps(t *testing.T) {
	_, do := invoiceEnv(t)
	paid := do("POST", "/api/invoices", invoiceBody(t, "0001", map[string]any{"status": "paid"})).data()
	if paid["paidAt"] == nil || paid["closedAt"] != nil {
		t.Errorf("paid: %v %v", paid["paidAt"], paid["closedAt"])
	}
	upd := do("PUT", "/api/invoices", invoiceBody(t, "0001", map[string]any{"status": "closed", "id": paid["id"]})).data()
	if upd["closedAt"] == nil || upd["paidAt"] != nil {
		t.Errorf("closed: %v %v", upd["paidAt"], upd["closedAt"])
	}
}

func TestNumbering(t *testing.T) {
	_, do := invoiceEnv(t)
	if r := do("GET", "/api/invoices/sequence?businessId=1&clientId=1", ""); r.Body["success"] != true || r.Body["data"] != nil {
		t.Errorf("nothing numbered yet: %v", r.Body)
	}
	do("POST", "/api/invoices", invoiceBody(t, "0007", nil))
	seq := do("GET", "/api/invoices/sequence?businessId=1&clientId=1", "").data()
	if seq["nextSequence"] != float64(8) || seq["formattedSequence"] != "0008" {
		t.Errorf("after 0007: %v", seq)
	}
	do("POST", "/api/invoices", invoiceBody(t, "0008", nil))
	if s := do("GET", "/api/invoices/sequence?businessId=1&clientId=1", "").data(); s["nextSequence"] != float64(9) {
		t.Errorf("after 0008: %v", s)
	}
	// Renumbering an invoice upwards moves the counter past it, never back.
	do("PUT", "/api/invoices", invoiceBody(t, "0020", map[string]any{"id": 2}))
	if s := do("GET", "/api/invoices/sequence?businessId=1&clientId=1", "").data(); s["nextSequence"] != float64(21) {
		t.Errorf("after renumber: %v", s)
	}
	do("PUT", "/api/invoices", invoiceBody(t, "0002", map[string]any{"id": 2}))
	if s := do("GET", "/api/invoices/sequence?businessId=1&clientId=1", "").data(); s["nextSequence"] != float64(21) {
		t.Errorf("counter must not go back: %v", s)
	}
}

func TestUpdateReplacesChildren(t *testing.T) {
	_, do := invoiceEnv(t)
	do("POST", "/api/invoices", invoiceBody(t, "0001", nil))
	if r := do("PUT", "/api/invoices", invoiceBody(t, "0001", map[string]any{"id": 999})); r.key() != "error.invoiceNotFound" {
		t.Errorf("unknown id: %v", r.Body)
	}
	r := do("PUT", "/api/invoices", invoiceBody(t, "0001", map[string]any{"id": 1, "invoiceItems": []any{}, "invoicePayments": []any{}, "invoiceAttachments": []any{}}))
	d := r.data()
	for _, k := range []string{"invoiceItems", "invoicePayments", "invoiceAttachments"} {
		if l, _ := d[k].([]any); len(l) != 0 {
			t.Errorf("%s should be emptied: %v", k, d[k])
		}
	}
}

func TestDuplicateAndQuotationConversion(t *testing.T) {
	_, do := invoiceEnv(t)
	do("POST", "/api/invoices", invoiceBody(t, "0001", nil))
	do("POST", "/api/invoices", invoiceBody(t, "0001", map[string]any{"invoiceType": "quotation"}))
	copy1 := do("POST", "/api/invoices/duplicate", `{"invoiceId":1,"invoiceType":"invoice"}`).data()
	if copy1["invoiceNumber"] != "0002" || copy1["status"] != "unpaid" || len(copy1["invoiceItems"].([]any)) != 1 {
		t.Errorf("duplicate: %v %v", copy1["invoiceNumber"], copy1["status"])
	}
	conv := do("POST", "/api/invoices/duplicate", `{"invoiceId":2,"invoiceType":"invoice"}`).data()
	if conv["id"] != float64(2) || conv["status"] != "closed" || conv["invoiceType"] != "quotation" {
		t.Errorf("conversion answers with the closed quotation: %v", conv)
	}
	all := rows(t, do("GET", "/api/invoices?type=invoice", ""))
	var converted map[string]any
	for _, inv := range all {
		if inv["convertedFromQuotationId"] == float64(2) {
			converted = inv
		}
	}
	if converted == nil || converted["invoiceNumber"] != "0003" {
		t.Errorf("0001 was taken, so the converted quotation gets the next free number: %v", converted)
	}
	if r := do("POST", "/api/invoices/duplicate", `{"invoiceId":999,"invoiceType":"invoice"}`); r.Body["success"] != false || r.key() != nil {
		t.Errorf("unknown id: %v", r.Body)
	}
}

func TestDeleteRemovesEverything(t *testing.T) {
	e, do := invoiceEnv(t)
	do("POST", "/api/invoices", invoiceBody(t, "0001", nil))
	if r := do("DELETE", "/api/invoices/1", ""); r.Body["success"] != true {
		t.Fatalf("%v", r.Body)
	}
	for _, table := range []string{"invoices", "invoice_items", "invoice_item_snapshots", "invoice_payments", "attachments", "invoice_business_snapshots"} {
		var n int
		e.sql.DB().QueryRow(`SELECT COUNT(*) FROM ` + table).Scan(&n)
		if n != 0 {
			t.Errorf("%s still has %d rows", table, n)
		}
	}
}

func TestHeadersAndFiltersAreSafe(t *testing.T) {
	_, do := invoiceEnv(t)
	do("POST", "/api/invoices", invoiceBody(t, "0001", nil))
	h := do("GET", "/api/invoices/headers?type=invoice", "")
	if list := h.Body["data"].([]any); len(list) != 1 || list[0].(map[string]any)["header"] != "Serial" {
		t.Errorf("headers: %v", h.Body)
	}
	inj := `[{"type":"Status","value":"x' OR '1'='1"}]`
	if got := rows(t, do("GET", "/api/invoices?filter="+urlEscape(inj), "")); len(got) != 0 {
		t.Errorf("a filter value must never become SQL: %v", got)
	}
	if got := rows(t, do("GET", "/api/invoices?type="+urlEscape("invoice' OR '1'='1"), "")); len(got) != 0 {
		t.Errorf("type must never become SQL: %v", got)
	}
}

func urlEscape(s string) string {
	return strings.NewReplacer("%", "%25", " ", "%20", "'", "%27", "\"", "%22", "[", "%5B", "]", "%5D", "{", "%7B", "}", "%7D", ",", "%2C", "=", "%3D").Replace(s)
}

var _ = fmt.Sprint
