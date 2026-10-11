package api

import (
	"encoding/base64"
	"fmt"
	"io"
	"log/slog"
	"net/http"
	"path/filepath"
	"regexp"
	"strings"
	"testing"
	"time"

	"github.com/Raktim94/nodedr-invoice/rewrite/internal/config"
	"github.com/Raktim94/nodedr-invoice/rewrite/internal/store/sqlitestore"
)

// sqlEnv is an env backed by a real SQLite database with a signed-in owner.
func sqlEnv(t *testing.T) (*env, *http.Cookie) {
	t.Helper()
	db, err := sqlitestore.Open(filepath.Join(t.TempDir(), "t.db"))
	if err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() { db.Close() })
	e := &env{t: t, clock: time.Date(2026, 10, 11, 9, 0, 0, 0, time.UTC)}
	cfg := config.LoadFrom(func(string) string { return "" })
	e.h = newHandler(cfg, slog.New(slog.NewJSONHandler(io.Discard, nil)), db, func() time.Time { return e.clock })
	e.sql = db
	return e, e.setup()
}

func rows(t *testing.T, r reply) []map[string]any {
	t.Helper()
	list, ok := r.Body["data"].([]any)
	if !ok {
		t.Fatalf("data is not a list: %v", r.Body)
	}
	out := make([]map[string]any, len(list))
	for i, v := range list {
		out[i] = v.(map[string]any)
	}
	return out
}

func TestResourcesNeedAuth(t *testing.T) {
	e, _ := sqlEnv(t)
	for _, p := range []string{"banks", "businesses", "clients", "currencies", "categories", "units", "items"} {
		if r := e.do("GET", "/api/"+p, "", nil, nil); r.Code != 401 || r.key() != "error.unauthorized" {
			t.Errorf("%s: %d %v", p, r.Code, r.Body)
		}
	}
}

func TestResourcesWithoutDatabase(t *testing.T) {
	e := newEnv(t) // in-memory store: no SQL behind it
	ck := e.setup()
	if r := e.do("GET", "/api/clients", "", nil, ck); r.Code != 400 || r.key() != "error.databaseNotInitialized" {
		t.Errorf("%d %v", r.Code, r.Body)
	}
}

var dbTimestamp = regexp.MustCompile(`^\d{4}-\d\d-\d\d \d\d:\d\d:\d\d$`)

func TestSeededCurrencyListShape(t *testing.T) {
	e, ck := sqlEnv(t)
	list := rows(t, e.do("GET", "/api/currencies", "", nil, ck))
	if len(list) != 10 {
		t.Fatalf("seed currencies: %d", len(list))
	}
	c := list[0]
	if c["isArchived"] != false {
		t.Errorf("isArchived should be a boolean: %#v", c["isArchived"])
	}
	if c["invoiceCount"] != float64(0) || c["quotesCount"] != float64(0) {
		t.Errorf("counters: %v %v", c["invoiceCount"], c["quotesCount"])
	}
	if s, _ := c["createdAt"].(string); !dbTimestamp.MatchString(s) {
		t.Errorf("createdAt should be returned as stored, got %q", c["createdAt"])
	}
	if _, ok := c["code"].(string); !ok {
		t.Errorf("code: %#v", c["code"])
	}
}

func TestClientLifecycle(t *testing.T) {
	e, ck := sqlEnv(t)
	made := e.do("POST", "/api/clients", `{"name":"Acme","shortName":"AC","email":"a@acme.test"}`, nil, ck)
	if made.Code != 200 || made.Body["success"] != true {
		t.Fatalf("create: %v", made.Body)
	}
	d := made.data()
	if d["name"] != "Acme" || d["taxExempt"] != false || d["isArchived"] != false || d["id"] == nil || d["invoiceCount"] != float64(0) {
		t.Errorf("created row: %v", d)
	}
	id := fmt.Sprintf("%v", d["id"])
	up := e.do("PUT", "/api/clients", fmt.Sprintf(`{"id":%s,"name":"Acme Ltd","shortName":"AC","taxExempt":true}`, id), nil, ck)
	if up.data()["name"] != "Acme Ltd" || up.data()["taxExempt"] != true || up.data()["email"] != nil {
		t.Errorf("update replaces every field: %v", up.data())
	}
	// Updating an id that does not exist succeeds with no data.
	if r := e.do("PUT", "/api/clients", `{"id":999,"name":"x","shortName":"x"}`, nil, ck); r.Code != 200 || r.Body["success"] != true || r.Body["data"] != nil {
		t.Errorf("update missing: %v", r.Body)
	}
	if r := e.do("POST", "/api/clients", `{"shortName":"NN"}`, nil, ck); r.Code != 200 || r.Body["success"] != false || r.key() != "error.invalidConstraintNotNull" {
		t.Errorf("missing name: %v", r.Body)
	}
	if r := e.do("POST", "/api/clients", `{`, nil, ck); r.Code != 400 {
		t.Errorf("bad json: %d", r.Code)
	}
	if r := e.do("DELETE", "/api/clients/"+id, "", nil, ck); r.Code != 200 || r.Body["success"] != true {
		t.Errorf("delete: %v", r.Body)
	}
	if r := e.do("DELETE", "/api/clients/"+id, "", nil, ck); r.Body["success"] != true {
		t.Errorf("delete twice: %v", r.Body)
	}
	if got := rows(t, e.do("GET", "/api/clients", "", nil, ck)); len(got) != 0 {
		t.Errorf("list after delete: %v", got)
	}
}

func TestFiltersAndOrdering(t *testing.T) {
	e, ck := sqlEnv(t)
	for _, n := range []string{"First", "Second", "Third"} {
		e.do("POST", "/api/categories", fmt.Sprintf(`{"name":%q}`, n), nil, ck)
	}
	// Seeded categories exist too; make "Second" archived and give rows distinct times.
	e.sql.DB().Exec(`UPDATE categories SET "isArchived" = 1 WHERE "name" = 'Second'`)
	e.sql.DB().Exec(`UPDATE categories SET "createdAt" = '2030-01-01 00:00:00' WHERE "name" = 'Third'`)
	names := func(q string) []string {
		var out []string
		for _, r := range rows(t, e.do("GET", "/api/categories"+q, "", nil, ck)) {
			out = append(out, r["name"].(string))
		}
		return out
	}
	all := names("")
	if all[0] != "Third" {
		t.Errorf("newest first: %v", all)
	}
	has := func(list []string, n string) bool {
		for _, x := range list {
			if x == n {
				return true
			}
		}
		return false
	}
	active := names(`?filter=[{"type":"Active","value":""}]`)
	archived := names(`?filter=[{"type":"Archived","value":""}]`)
	if has(active, "Second") || !has(active, "First") || len(archived) != 1 || archived[0] != "Second" {
		t.Errorf("active=%v archived=%v", active, archived)
	}
	if got := names(`?filter=[{"type":"NoInvoices","value":""}]`); len(got) != len(all) {
		t.Errorf("nothing has invoices: %v vs %v", got, all)
	}
	if got := names(`?filter=[{"type":"AtleastOneInvoice","value":""}]`); len(got) != 0 {
		t.Errorf("atleast one: %v", got)
	}
	// Malformed or unknown filters are ignored.
	for _, q := range []string{`?filter=nope`, `?filter=[{"type":"Bogus","value":""}]`, `?filter={}`} {
		if got := names(q); len(got) != len(all) {
			t.Errorf("%s: %v", q, got)
		}
	}
}

func TestInvoiceCounters(t *testing.T) {
	e, ck := sqlEnv(t)
	cl := e.do("POST", "/api/clients", `{"name":"Acme","shortName":"AC"}`, nil, ck).data()
	biz := e.do("POST", "/api/businesses", `{"name":"Me","shortName":"ME"}`, nil, ck).data()
	cur := rows(t, e.do("GET", "/api/currencies", "", nil, ck))[0]
	ins := func(kind, num string) {
		_, err := e.sql.DB().Exec(`INSERT INTO invoices ("invoiceType","businessId","clientId","currencyId","issuedAt","invoiceNumber") VALUES (?,?,?,?,?,?)`,
			kind, biz["id"], cl["id"], cur["id"], "2026-10-01", num)
		if err != nil {
			t.Fatal(err)
		}
	}
	ins("invoice", "1")
	ins("invoice", "2")
	ins("quotation", "Q1")
	got := rows(t, e.do("GET", "/api/clients", "", nil, ck))[0]
	if got["invoiceCount"] != float64(2) || got["quotesCount"] != float64(1) {
		t.Errorf("client counters: %v %v", got["invoiceCount"], got["quotesCount"])
	}
	if got := rows(t, e.do("GET", "/api/clients?filter=[{\"type\":\"AtleastOneInvoice\",\"value\":\"\"}]", "", nil, ck)); len(got) != 1 {
		t.Errorf("filter AtleastOneInvoice: %v", got)
	}
	if got := rows(t, e.do("GET", "/api/clients?filter=[{\"type\":\"NoInvoices30\",\"value\":\"\"}]", "", nil, ck)); len(got) != 0 {
		t.Errorf("recently invoiced client must not match NoInvoices30: %v", got)
	}
	// Deleting a client that invoices reference is refused.
	if r := e.do("DELETE", fmt.Sprintf("/api/clients/%v", cl["id"]), "", nil, ck); r.Body["success"] != false || r.key() != "error.invalidConstraintForeign" {
		t.Errorf("delete in use: %v", r.Body)
	}
}

func TestBlobFieldsRoundTripAsBase64(t *testing.T) {
	e, ck := sqlEnv(t)
	png := base64.StdEncoding.EncodeToString([]byte{0x89, 'P', 'N', 'G', 0, 1, 2, 3})
	r := e.do("POST", "/api/businesses", fmt.Sprintf(`{"name":"Me","shortName":"ME","logo":%q,"fileType":"image/png"}`, png), nil, ck)
	if r.data()["logo"] != png {
		t.Errorf("logo: %v", r.data()["logo"])
	}
	if list := rows(t, e.do("GET", "/api/businesses", "", nil, ck)); list[0]["logo"] != png {
		t.Errorf("list logo: %v", list[0]["logo"])
	}
	bank := e.do("POST", "/api/banks", fmt.Sprintf(`{"name":"B","bankName":"Bank","qrCode":%q}`, png), nil, ck)
	if bank.data()["qrCode"] != png {
		t.Errorf("qrCode: %v", bank.data())
	}
	none := e.do("POST", "/api/businesses", `{"name":"No logo","shortName":"NL"}`, nil, ck)
	if none.data()["logo"] != nil {
		t.Errorf("absent logo should be null: %v", none.data()["logo"])
	}
}

func TestBatchIsAtomic(t *testing.T) {
	e, ck := sqlEnv(t)
	bad := e.do("POST", "/api/clients/batch", `[{"name":"A","shortName":"A"},{"shortName":"B"}]`, nil, ck)
	if bad.Body["success"] != false || bad.key() != "error.invalidConstraintNotNull" {
		t.Fatalf("batch: %v", bad.Body)
	}
	if got := rows(t, e.do("GET", "/api/clients", "", nil, ck)); len(got) != 0 {
		t.Errorf("a failed batch must leave nothing behind: %v", got)
	}
	ok := e.do("POST", "/api/clients/batch", `[{"name":"A","shortName":"A"},{"name":"B","shortName":"B"}]`, nil, ck)
	if ok.Body["success"] != true || len(rows(t, e.do("GET", "/api/clients", "", nil, ck))) != 2 {
		t.Errorf("good batch: %v", ok.Body)
	}
}

func TestItemBatchCreatesUnitAndCategoryByName(t *testing.T) {
	e, ck := sqlEnv(t)
	r := e.do("POST", "/api/items/batch", `[
		{"name":"Widget","amount":"12.50","unitName":"crate","categoryName":"Hardware"},
		{"name":"Gadget","amount":5,"unitName":"crate","categoryName":"Hardware"}]`, nil, ck)
	if r.Body["success"] != true {
		t.Fatalf("%v", r.Body)
	}
	items := rows(t, e.do("GET", "/api/items", "", nil, ck))
	if len(items) != 2 || items[0]["unitName"] != "crate" || items[0]["categoryName"] != "Hardware" {
		t.Fatalf("items: %v", items)
	}
	units := 0
	for _, u := range rows(t, e.do("GET", "/api/units", "", nil, ck)) {
		if u["name"] == "crate" {
			units++
		}
	}
	if units != 1 {
		t.Errorf("unit 'crate' should exist once, found %d", units)
	}
	single := e.do("POST", "/api/items", `{"name":"Single","amount":"3","unitId":`+fmt.Sprint(items[0]["unitId"])+`}`, nil, ck)
	if single.data()["unitName"] != "crate" || single.data()["categoryName"] != nil {
		t.Errorf("single: %v", single.data())
	}
	if !strings.Contains(fmt.Sprint(single.data()["amount"]), "3") {
		t.Errorf("amount: %v", single.data()["amount"])
	}
}

func TestIntegerIDsStayExact(t *testing.T) {
	e, ck := sqlEnv(t)
	r := e.do("POST", "/api/currencies", `{"code":"ZZZ","symbol":"z","text":"Zed","format":"{amount}","subunit":1000}`, nil, ck)
	if r.data()["subunit"] != float64(1000) || r.data()["code"] != "ZZZ" {
		t.Errorf("%v", r.data())
	}
	dup := e.do("POST", "/api/currencies", `{"code":"ZZZ","symbol":"z","text":"Zed","format":"{amount}","subunit":1000}`, nil, ck)
	if dup.Body["success"] == true {
		t.Log("duplicate currency codes are allowed by the schema")
	}
}

func TestSettingsAndTaxRoutes(t *testing.T) {
	e, ck := sqlEnv(t)
	s := e.do("GET", "/api/settings", "", nil, ck)
	if s.data()["language"] != "en" || s.data()["isDarkMode"] != true {
		t.Fatalf("settings: %v", s.Body)
	}
	if r := e.do("PUT", "/api/settings", `{"id":9,"language":"de","isDarkMode":false}`, nil, ck); r.Body["success"] != true {
		t.Fatalf("put: %v", r.Body)
	}
	s = e.do("GET", "/api/settings", "", nil, ck)
	if s.data()["language"] != "de" || s.data()["isDarkMode"] != false || s.data()["id"] != float64(1) {
		t.Errorf("after put: %v", s.data())
	}
	if r := e.do("PUT", "/api/settings", `{"nope":1}`, nil, ck); r.Body["success"] != false || r.key() != "error.sqlSyntaxError" {
		t.Errorf("unknown column must be refused, never put into SQL: %v", r.Body)
	}
	if r := e.do("PUT", "/api/settings", `{"language\" = 'x' --":1}`, nil, ck); r.key() != "error.sqlSyntaxError" {
		t.Errorf("injection attempt: %v", r.Body)
	}
	if r := e.do("PUT", "/api/settings", `{}`, nil, ck); r.Body["success"] != true {
		t.Errorf("empty put: %v", r.Body)
	}
	states := rows(t, e.do("GET", "/api/tax/us-states", "", nil, ck))
	if len(states) != 51 || states[0]["stateName"] != "Alabama" {
		t.Errorf("states: %d %v", len(states), states[0])
	}
	if r := e.do("GET", "/api/tax/us-states/ca", "", nil, ck); r.data()["stateCode"] != "CA" {
		t.Errorf("lower-case state code: %v", r.Body)
	}
	if r := e.do("GET", "/api/tax/us-states/ZZ", "", nil, ck); r.Code != 200 || r.Body["success"] != true || r.Body["data"] != nil {
		t.Errorf("unknown state: %v", r.Body)
	}
	if _, has := e.do("GET", "/api/tax/us-states/ZZ", "", nil, ck).Body["data"]; !has {
		t.Error(`unknown state must answer "data":null explicitly`)
	}
}

func TestStyleProfileJSONColumnsKeepOrderAndLayoutSchema(t *testing.T) {
	e, ck := sqlEnv(t)
	full := `"isArchived":false,"labelUpperCase":false,"showQuantity":true,"showUnit":true,"showRowNo":true`
	r := e.do("POST", "/api/styleProfiles", `{`+full+`,"name":"P","layoutId":1,"fieldSortOrders":{"b":2,"a":[1,{"x":null}]},"pdfTexts":{"title":"Facture"}}`, nil, ck)
	if r.Body["success"] != true {
		t.Fatalf("%v", r.Body)
	}
	var stored string
	if err := e.sql.DB().QueryRow(`SELECT "fieldSortOrders" FROM style_profiles WHERE "id" = 1`).Scan(&stored); err != nil || stored != `{"b":2,"a":[1,{"x":null}]}` {
		t.Errorf("stored text must keep the client's key order: %q %v", stored, err)
	}
	if _, has := r.data()["layoutSchema"]; has {
		t.Error("layoutSchema only appears on lists")
	}
	if fo, _ := r.data()["fieldSortOrders"].(map[string]any); fo["b"] != float64(2) {
		t.Errorf("response parses the JSON: %v", r.data()["fieldSortOrders"])
	}
	list := rows(t, e.do("GET", "/api/styleProfiles", "", nil, ck))
	if sc, _ := list[0]["layoutSchema"].(map[string]any); sc["schemaVersion"] == nil {
		t.Errorf("list should carry the layout schema: %v", list[0]["layoutSchema"])
	}
	// A batch row may carry the JSON already as text; that text is kept.
	e.do("POST", "/api/styleProfiles/batch", `[{`+full+`,"name":"B","fieldSortOrders":"{\"q\":1}"}]`, nil, ck)
	e.sql.DB().QueryRow(`SELECT "fieldSortOrders" FROM style_profiles WHERE "name" = 'B'`).Scan(&stored)
	if stored != `{"q":1}` {
		t.Errorf("batch text: %q", stored)
	}
}

func TestLayoutsAndExport(t *testing.T) {
	e, ck := sqlEnv(t)
	made := e.do("POST", "/api/layouts", `{"isArchived":false,"schema":{"z":1,"a":[]}}`, nil, ck)
	if s, _ := made.data()["schema"].(map[string]any); s["z"] != float64(1) || made.data()["invoiceCount"] != float64(0) {
		t.Fatalf("%v", made.Body)
	}
	id := fmt.Sprint(made.data()["id"])
	exp := e.do("GET", "/api/layouts/export/"+id, "", nil, ck)
	if _, has := exp.data()["invoiceCount"]; has || exp.data()["id"] != made.data()["id"] {
		t.Errorf("export is the plain row: %v", exp.data())
	}
	if r := e.do("GET", "/api/layouts/export/999", "", nil, ck); r.Body["success"] != true || r.Body["data"] != nil {
		t.Errorf("missing layout: %v", r.Body)
	}
	if r := e.do("POST", "/api/layouts/batch", `[]`, nil, ck); r.Code != 404 && r.Code != 405 {
		t.Errorf("layouts have no batch route: %d", r.Code)
	}
}

func TestPresetsCarryBorrowedData(t *testing.T) {
	e, ck := sqlEnv(t)
	biz := e.do("POST", "/api/businesses", `{"name":"Me","shortName":"ME","logo":"iVBORw0KGgo="}`, nil, ck).data()
	bare := e.do("POST", "/api/presets", `{"name":"Bare"}`, nil, ck)
	if bare.Body["success"] != true || bare.data()["businessName"] != nil || bare.data()["isArchived"] != false {
		t.Fatalf("bare: %v", bare.Body)
	}
	if _, has := bare.data()["layoutSchema"]; has {
		t.Error("layoutSchema is absent (not null) when there is no layout")
	}
	std := e.do("POST", "/api/presets", fmt.Sprintf(`{"name":"Std","businessId":%v,"signatureData":"iVBORw0KGgo="}`, biz["id"]), nil, ck)
	if std.data()["businessName"] != "Me" || std.data()["businessLogo"] != "iVBORw0KGgo=" || std.data()["signatureData"] != "iVBORw0KGgo=" {
		t.Errorf("borrowed data: %v", std.data())
	}
	bad := e.do("POST", "/api/presets", `{"name":"Bad","businessId":999}`, nil, ck)
	if bad.Body["success"] != false || bad.key() != "error.invalidConstraintForeign" || bad.Body["message"] != nil {
		t.Errorf("fk failure carries only the key: %v", bad.Body)
	}
	if got := rows(t, e.do("GET", "/api/presets", "", nil, ck)); len(got) != 2 {
		t.Errorf("failed save must leave nothing: %d", len(got))
	}
	if r := e.do("PUT", "/api/presets", `{"id":999,"name":"x"}`, nil, ck); r.Body["success"] != true || r.Body["data"] != nil {
		t.Errorf("update unknown id: %v", r.Body)
	}
}
