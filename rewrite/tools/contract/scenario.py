#!/usr/bin/env python3
"""Runs one scripted conversation against a server and writes every response to a JSON file.

usage: scenario.py BASE_URL OUT.json [--setup]
--setup creates the owner account first (only used to prepare the starting database).
"""
import json, re, sys, urllib.parse, urllib.request, urllib.error, http.cookiejar

base, out = sys.argv[1], sys.argv[2]
jar = http.cookiejar.CookieJar()
op = urllib.request.build_opener(urllib.request.HTTPCookieProcessor(jar))
log = []

def call(method, path, body=None):
    req = urllib.request.Request(base + path, method=method,
                                 data=json.dumps(body).encode() if body is not None else None,
                                 headers={"Content-Type": "application/json"})
    try:
        r = op.open(req); code, text = r.status, r.read()
    except urllib.error.HTTPError as e:
        code, text = e.code, e.read()
    try: payload = json.loads(text or b"null")
    except ValueError: payload = "<non-json>"
    log.append({"call": f"{method} {path}", "status": code, "body": payload})
    return payload

creds = {"email": "me@example.com", "password": "Correct-Horse-9"}
if "--setup" in sys.argv:
    call("POST", "/api/auth/setup", creds)
    json.dump(log, open(out, "w"), indent=1); sys.exit()
call("POST", "/api/auth/login", creds)

png = "iVBORw0KGgo="
call("POST", "/api/businesses", {"name": "Mavri Studio", "shortName": "MS", "address": "1 Main St", "logo": png, "fileType": "image/png", "isArchived": False})
call("POST", "/api/businesses", {"name": "Second Co", "shortName": "SC", "isArchived": False})
call("POST", "/api/clients", {"name": "Acme Corp", "shortName": "AC", "email": "a@acme.test", "isArchived": False})
call("POST", "/api/clients", {"name": "Beta LLC", "shortName": "BL", "taxExempt": True, "isArchived": True})
call("POST", "/api/currencies", {"code": "ZZZ", "symbol": "z", "text": "Zed", "format": "{amount}", "subunit": 1000, "isArchived": False})
call("POST", "/api/categories", {"name": "Hardware", "isArchived": False})
call("POST", "/api/units", {"name": "crate", "isArchived": False})
call("POST", "/api/items", {"name": "Widget", "amount": "12.50", "unitId": 14, "categoryId": 3, "description": "d", "isArchived": False})
call("POST", "/api/items", {"name": "NoUnit", "amount": 7, "isArchived": False})
call("POST", "/api/banks", {"name": "Main", "bankName": "First", "accountNumber": "123", "qrCode": png, "isArchived": False})
call("POST", "/api/items/batch", [{"name": "Imp", "amount": "1", "unitName": "box", "categoryName": "Imported", "isArchived": False},
                                  {"name": "Imp2", "amount": "2", "unitName": "box", "categoryName": "Imported", "isArchived": False}])
call("POST", "/api/clients/batch", [{"name": "B1", "shortName": "B1", "isArchived": False}, {"name": "B2", "shortName": "B2", "isArchived": False}])
call("POST", "/api/clients/batch", [{"name": "ok", "shortName": "o", "isArchived": False}, {"shortName": "bad", "isArchived": False}])
call("POST", "/api/clients", {"name": "Dup"})
call("PUT", "/api/clients", {"id": 1, "name": "Renamed", "shortName": "RN", "isArchived": False})
call("PUT", "/api/clients", {"id": 2, "name": "Beta LLC", "shortName": "BL", "taxExempt": False, "isArchived": False})
call("PUT", "/api/clients", {"id": 999, "name": "x", "shortName": "x", "isArchived": False})
call("PUT", "/api/currencies", {"id": 11, "code": "ZZZ", "symbol": "Z", "text": "Zed 2", "format": "{amount}", "subunit": 100, "isArchived": True})
call("PUT", "/api/banks", {"id": 1, "name": "Main", "bankName": "First", "accountNumber": "999", "isArchived": False})
call("DELETE", "/api/units/1")
call("DELETE", "/api/clients/4")
call("DELETE", "/api/clients/777")
call("DELETE", "/api/clients/abc")
for p in ["banks", "businesses", "clients", "currencies", "categories", "units", "items"]:
    call("GET", "/api/" + p)
    for f in ['[{"type":"Active","value":""}]', '[{"type":"Archived","value":""}]', '[{"type":"NoInvoices","value":""}]',
              '[{"type":"AtleastOneInvoice","value":""}]', '[{"type":"NoInvoices30","value":""}]', 'junk']:
        call("GET", "/api/" + p + "?filter=" + urllib.parse.quote(f))
# layouts / style profiles / presets
call("GET", "/api/layouts")
call("POST", "/api/layouts", {"isArchived": False, "schema": {"blocks": [{"z": 1, "a": 2}], "title": "T&C <b>"}})
call("PUT", "/api/layouts", {"id": 7, "isArchived": False, "schema": {"blocks": [], "v": 2}})
call("PUT", "/api/layouts", {"id": 999, "isArchived": False, "schema": {}})
call("GET", "/api/layouts/export/7")
call("GET", "/api/layouts/export/999")
call("GET", "/api/layouts/export/abc")
call("GET", "/api/layouts?filter=" + urllib.parse.quote('[{"type":"Active","value":""}]'))
call("GET", "/api/styleProfiles")
FULL = {"isArchived": False, "labelUpperCase": False, "showQuantity": True, "showUnit": True, "showRowNo": True}
call("POST", "/api/styleProfiles", {**FULL, "name": "Plain", "color": "#112233", "layoutId": 1, "labelUpperCase": True,
     "watermarkFileData": png, "watermarkFileName": "w.png", "fieldSortOrders": {"b": 2, "a": [1, 2, {"x": None}]}, "pdfTexts": {"title": "Facture"}})
call("POST", "/api/styleProfiles", {**FULL, "name": "NullJson", "fieldSortOrders": None, "pdfTexts": None})
call("PUT", "/api/styleProfiles", {**FULL, "id": 2, "name": "Plain 2", "layoutId": 2, "fieldSortOrders": {"x": 1}, "pdfTexts": {"title": "Rechnung"}})
call("POST", "/api/styleProfiles/batch", [{**FULL, "name": "B1", "fieldSortOrders": "{\"q\":1}", "pdfTexts": {"t": 1}},
                                          {**FULL, "name": "B2", "fieldSortOrders": {"r": 2}}])
call("POST", "/api/styleProfiles/batch", [{**FULL, "name": "B3", "fieldSortOrders": {}}, {**FULL, "fieldSortOrders": {}}])
call("DELETE", "/api/styleProfiles/4")
call("GET", "/api/styleProfiles")
call("GET", "/api/styleProfiles?filter=" + urllib.parse.quote('[{"type":"Archived","value":""}]'))
call("GET", "/api/presets")
call("POST", "/api/presets", {"name": "Std", "businessId": 1, "clientId": 1, "currencyId": 1, "bankId": 1, "styleProfilesId": 2,
     "customerNotes": "n", "language": "en", "signatureData": png, "signatureName": "s.png", "isArchived": False})
call("POST", "/api/presets", {"name": "Bare", "isArchived": False})
call("POST", "/api/presets", {"name": "Bad fk", "businessId": 999, "isArchived": False})
call("POST", "/api/presets", {"isArchived": False})
call("PUT", "/api/presets", {"id": 2, "name": "Bare 2", "currencyId": 2, "isArchived": False})
call("PUT", "/api/presets", {"id": 999, "name": "x", "isArchived": False})
call("PUT", "/api/presets", {"name": "no id", "isArchived": False})
call("POST", "/api/presets/batch", [{"name": "P1", "isArchived": False}, {"name": "P2", "isArchived": True}])
call("POST", "/api/presets/batch", [{"name": "P3", "isArchived": False}, {"isArchived": False}])
call("DELETE", "/api/presets/3")
call("GET", "/api/presets")
call("GET", "/api/presets?filter=" + urllib.parse.quote('[{"type":"Archived","value":""}]'))
call("GET", "/api/settings")
call("PUT", "/api/settings", {"id": 5, "language": "de", "isDarkMode": True, "createdAt": "x", "shouldIncludeYear": False})
call("PUT", "/api/settings", {})
call("PUT", "/api/settings", {"noSuchColumn": 1})
call("PUT", "/api/settings", {"language": {"a": 1}})
call("GET", "/api/settings")
call("GET", "/api/tax/us-states")
call("GET", "/api/tax/us-states/ca")
call("GET", "/api/tax/us-states/ZZ")
# Auth edge cases that do not depend on session ids.
call("POST", "/api/auth/login", {"email": "me@example.com", "password": "wrong-Password1"})
call("POST", "/api/auth/login", {"email": "nobody@example.com", "password": "Correct-Horse-9"})
call("GET", "/api/auth/status")
call("POST", "/api/auth/setup", creds)
call("GET", "/api/auth/me")
call("POST", "/api/auth/api-keys", {"name": "ci"})
call("GET", "/api/auth/api-keys")
call("DELETE", "/api/auth/api-keys/1")
call("GET", "/api/auth/api-keys")
call("POST", "/api/auth/logout")
call("GET", "/api/auth/me")
call("GET", "/api/clients")
json.dump(log, open(out, "w"), indent=1)
