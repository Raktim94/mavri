package api

import (
	"bytes"
	"compress/gzip"
	"encoding/json"
	"mime/multipart"
	"net/http"
	"net/http/httptest"
	"reflect"
	"testing"
)

// upload posts a gzipped document the way the app's import dialog does.
func (e *env) upload(t *testing.T, doc []byte, ck *http.Cookie, gz bool, field string) reply {
	t.Helper()
	var buf bytes.Buffer
	mw := multipart.NewWriter(&buf)
	part, _ := mw.CreateFormFile(field, "backup.json.gz")
	if gz {
		zw := gzip.NewWriter(part)
		zw.Write(doc)
		zw.Close()
	} else {
		part.Write(doc)
	}
	mw.Close()
	req := httptest.NewRequest("POST", "/api/import", &buf)
	req.Header.Set("Content-Type", mw.FormDataContentType())
	req.AddCookie(ck)
	rec := httptest.NewRecorder()
	e.h.ServeHTTP(rec, req)
	var m map[string]any
	_ = json.Unmarshal(rec.Body.Bytes(), &m)
	return reply{Code: rec.Code, Body: m}
}

func exportDoc(t *testing.T, do func(method, path, body string) reply) map[string]any {
	t.Helper()
	r := do("GET", "/api/export", "")
	if r.Body["success"] != true {
		t.Fatalf("export: %v", r.Body)
	}
	return r.data()
}

func TestExportImportRoundTripWithInvoicesAndPayments(t *testing.T) {
	e, do := invoiceEnv(t)
	ck := e.setupCookie()
	do("POST", "/api/invoices", invoiceBody(t, "0001", nil))
	do("POST", "/api/invoices", invoiceBody(t, "0002", map[string]any{"status": "paid"}))
	before := exportDoc(t, do)
	if len(before["invoicePayments"].([]any)) != 2 || len(before["attachments"].([]any)) != 2 {
		t.Fatalf("export is missing child rows: %v", before["invoicePayments"])
	}
	if inv := before["invoices"].([]any)[0].(map[string]any); inv["signatureData"] != png || inv["invoiceFullNumber"] == nil {
		t.Errorf("invoice export: %v", inv)
	}
	doc, _ := json.Marshal(before)
	// Importing over data that has payments is what the old server could not do.
	if r := e.upload(t, doc, ck, true, "file"); r.Body["success"] != true {
		t.Fatalf("import: %v", r.Body)
	}
	after := exportDoc(t, do)
	if !reflect.DeepEqual(before, after) {
		for k := range before {
			if !reflect.DeepEqual(before[k], after[k]) {
				t.Errorf("%s differs after a round trip:\n%v\n%v", k, before[k], after[k])
			}
		}
	}
	var fk int
	e.sql.DB().QueryRow(`PRAGMA foreign_keys`).Scan(&fk)
	if fk != 1 {
		t.Error("foreign keys must be switched back on after an import")
	}
}

func TestImportReplacesData(t *testing.T) {
	e, do := invoiceEnv(t)
	ck := e.setupCookie()
	doc := exportDoc(t, do)
	doc["clients"].([]any)[0].(map[string]any)["name"] = "Imported Name"
	doc["settings"].(map[string]any)["language"] = "fr"
	doc["currencies"] = append(doc["currencies"].([]any), map[string]any{"id": 500, "code": "IMP", "symbol": "i", "text": "Imp", "format": "{amount}", "subunit": 100, "isArchived": false})
	body, _ := json.Marshal(doc)
	if r := e.upload(t, body, ck, true, "file"); r.Body["success"] != true {
		t.Fatalf("%v", r.Body)
	}
	if rows(t, do("GET", "/api/clients", ""))[0]["name"] != "Imported Name" {
		t.Error("clients not replaced")
	}
	if do("GET", "/api/settings", "").data()["language"] != "fr" {
		t.Error("settings not updated")
	}
	if len(rows(t, do("GET", "/api/currencies", ""))) != 11 {
		t.Error("currency not added")
	}
	// The account and sign-in survive: users are not part of an export.
	if r := do("GET", "/api/auth/me", ""); r.Code != 200 {
		t.Errorf("session after import: %d", r.Code)
	}
}

func TestBadImportsChangeNothing(t *testing.T) {
	e, do := invoiceEnv(t)
	ck := e.setupCookie()
	good, _ := json.Marshal(exportDoc(t, do))
	clients := func() int { return len(rows(t, do("GET", "/api/clients", ""))) }
	want := clients()

	for name, tc := range map[string]struct {
		doc   []byte
		gz    bool
		field string
		code  int
		key   any
	}{
		"not gzip":    {[]byte("plain text"), false, "file", 400, "error.invalidFile"},
		"not json":    {[]byte("{oops"), true, "file", 400, "error.invalidFile"},
		"json null":   {[]byte("null"), true, "file", 200, "invalidFile"},
		"json array":  {[]byte("[]"), true, "file", 200, "invalidFile"},
		"json number": {[]byte("42"), true, "file", 200, "invalidFile"},
		"wrong field": {good, true, "other", 400, "error.invalidFile"},
	} {
		r := e.upload(t, tc.doc, ck, tc.gz, tc.field)
		if r.Code != tc.code || r.Body["success"] != false || r.key() != tc.key {
			t.Errorf("%s: %d %v", name, r.Code, r.Body)
		}
		if clients() != want {
			t.Fatalf("%s: a refused import changed the data (%d clients, want %d)", name, clients(), want)
		}
	}
	// A document naming a column that does not exist is refused whole.
	var doc map[string]any
	json.Unmarshal(good, &doc)
	doc["clients"].([]any)[0].(map[string]any)["nope"] = 1
	bad, _ := json.Marshal(doc)
	if r := e.upload(t, bad, ck, true, "file"); r.Body["success"] != false || r.key() != "error.sqlSyntaxError" {
		t.Errorf("unknown column: %v", r.Body)
	}
	if clients() != want {
		t.Error("a failed import must roll back")
	}
	if r := do("POST", "/api/import", `{}`); r.Code != 400 || r.key() != "error.invalidFile" {
		t.Errorf("no file: %d %v", r.Code, r.Body)
	}
}
