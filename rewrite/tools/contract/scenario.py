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

import gzip, uuid

def call_raw(method, path, data, content_type, headers=None):
    req = urllib.request.Request(base + path, method=method, data=data, headers={"Content-Type": content_type, **(headers or {})})
    try:
        r = op.open(req); code, text = r.status, r.read()
    except urllib.error.HTTPError as e:
        code, text = e.code, e.read()
    try: payload = json.loads(text or b"null")
    except ValueError: payload = "<non-json>"
    log.append({"call": f"{method} {path} [{content_type.split(';')[0]}]", "status": code, "body": payload})
    return payload

def upload(doc_bytes, gz=True, field="file"):
    boundary = uuid.uuid4().hex
    body = (f"--{boundary}\r\nContent-Disposition: form-data; name=\"{field}\"; filename=\"backup.json.gz\"\r\n"
            f"Content-Type: application/gzip\r\n\r\n").encode() + (gzip.compress(doc_bytes) if gz else doc_bytes) + f"\r\n--{boundary}--\r\n".encode()
    return call_raw("POST", "/api/import", body, f"multipart/form-data; boundary={boundary}")

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
# database chooser (rate limit is 5 per 10 s, so keep to four calls)
call("GET", "/api/databases")
call("POST", "/api/databases", {"fullPath": "../evil.db", "mode": "create"})
call("POST", "/api/databases", {"fullPath": "missing.db", "mode": "open"})
call("POST", "/api/databases", {"fullPath": "t.db", "mode": "open"})
call("GET", "/api/auth/me")
# ---- export / import ---------------------------------------------------------------
exported = call("GET", "/api/export")
doc = exported["data"]
upload(json.dumps(doc).encode())                      # round trip
call("GET", "/api/export")
changed = json.loads(json.dumps(doc))
changed["clients"][0]["name"] = "Imported Name"
changed["currencies"].append({**changed["currencies"][0], "id": 500, "code": "IMP"})
changed["settings"]["language"] = "fr"
upload(json.dumps(changed).encode())
call("GET", "/api/export")
call("GET", "/api/invoices")
upload(b"not gzip at all", gz=False)
upload(gzip.compress(b"not json")[:-3], gz=False)
upload(b"null")
# (an uploaded "[]" wipes the database in the TypeScript server; Go refuses it, so it is tested in Go only)
broken = json.loads(json.dumps(doc)); broken["clients"][0]["nope"] = 1
upload(json.dumps(broken).encode())                   # unknown column: rolled back
call("GET", "/api/clients")
upload(json.dumps(doc).encode(), field="other")
call_raw("POST", "/api/import", b"{}", "application/json")
# ---- invoices -------------------------------------------------------------------
def snaps(number, kind="invoice", **over):
    inv = {
        "invoiceType": kind, "businessId": 1, "clientId": 1, "currencyId": 1, "bankId": 1, "layoutId": 1, "styleProfilesId": 1,
        "issuedAt": "2026-10-01", "dueDate": "2026-10-31", "invoiceNumber": number, "isArchived": False, "status": "unpaid",
        "customerNotes": "Thanks", "thanksNotes": "Bye", "termsConditionNotes": "Net 30", "discountName": "Promo",
        "discountType": "fixed", "discountAmountCents": "500", "discountPercent": 0, "shippingFeeCents": "250",
        "surchargeName": None, "surchargeType": None, "surchargeAmountCents": "0", "surchargePercent": 0,
        "taxName": "VAT", "taxRate": 10, "taxType": "exclusive", "language": "en", "signatureData": png, "signatureSize": 8,
        "signatureType": "image/png", "signatureName": "sig.png",
        "invoiceBusinessSnapshot": {"businessName": "Mavri Studio", "businessShortName": "MS", "businessLogo": png, "businessFileType": "image/png"},
        "invoiceClientSnapshot": {"clientName": "Renamed", "clientEmail": "a@acme.test"},
        "invoiceCurrencySnapshot": {"currencyCode": "USD", "currencySymbol": "$", "currencySubunit": 100},
        "invoiceBankSnapshot": {"name": "Main", "bankName": "First", "accountNumber": "999", "qrCode": png},
        "invoiceStyleProfileSnapshot": {"styleProfileName": "Plain"},
        "invoiceLayoutSnapshot": {"layoutSchema": {"schemaVersion": 1, "sections": [{"type": "header", "z": 1, "a": 2}]}},
        "invoiceCustomization": {"color": "#112233", "logoSize": "medium", "fontSize": "medium", "fontFamily": "Roboto",
                                 "tableHeaderStyle": "light", "tableRowStyle": "classic", "pageFormat": "A4", "labelUpperCase": True,
                                 "showQuantity": True, "showUnit": True, "showRowNo": False, "watermarkFileData": png,
                                 "fieldSortOrders": {"no": 0, "item": 1, "unit": 2, "quantity": 3, "unitCost": 4, "total": 5},
                                 "pdfTexts": {"title": "Invoice", "note": "z<&>"}},
        "invoiceItems": [
            {"itemId": 1, "quantity": "2", "taxRate": 10, "taxType": "exclusive",
             "invoiceItemSnapshot": {"itemName": "Widget", "unitPriceCents": "1250", "unitName": "crate"}},
            {"itemId": 2, "quantity": "1.5", "taxRate": 0, "customField": {"header": "Serial", "value": "A-1", "sortOrder": 7, "alignment": "left"},
             "invoiceItemSnapshot": {"itemName": "NoUnit", "unitPriceCents": "700"}}],
        "invoicePayments": [{"amountCents": "1000", "paidAt": "2026-10-02 10:00:00", "paymentMethod": "cash", "notes": "deposit"}],
        "invoiceAttachments": [{"fileName": "a.png", "fileType": "image/png", "fileSize": 8, "data": png}],
    }
    inv.update(over)
    return inv

call("POST", "/api/invoices", snaps("0001"))
call("POST", "/api/invoices", snaps("0002", status="paid", issuedAt="2026-10-03", invoicePayments=[], invoiceAttachments=[]))
call("POST", "/api/invoices", snaps("Q-1", kind="quotation"))
call("POST", "/api/invoices", snaps("0007", clientId=2, invoiceClientSnapshot={"clientName": "Beta LLC"}, invoiceItems=[]))
call("POST", "/api/invoices", snaps("X", businessId=999))
call("GET", "/api/invoices/sequence?businessId=1&clientId=1")
call("GET", "/api/invoices/sequence?businessId=1&clientId=1&invoiceType=quotation")
call("GET", "/api/invoices/sequence?businessId=9&clientId=9")
call("GET", "/api/invoices/sequence")
call("GET", "/api/invoices/headers?type=invoice")
call("GET", "/api/invoices/headers?type=quotation")
call("GET", "/api/invoices")
for q in ["type=invoice", "type=quotation", "type=bogus"]:
    call("GET", "/api/invoices?" + q)
for f in ['[{"type":"Status","value":"paid"}]', '[{"type":"Client","value":"Beta LLC"}]', '[{"type":"Business","value":"Mavri Studio"}]',
          '[{"type":"Date","value":"2026-10-02,2026-10-31"}]', '[{"type":"Active","value":""}]', '[{"type":"Archived","value":""}]',
          '[{"type":"Status","value":"paid"},{"type":"Client","value":"Renamed"}]', "[{\"type\":\"Status\",\"value\":\"x' OR '1'='1\"}]"]:
    call("GET", "/api/invoices?filter=" + urllib.parse.quote(f))
call("PUT", "/api/invoices", {**snaps("0001", status="closed"), "id": 1, "invoiceBusinessSnapshot": {"id": 1, "businessName": "Mavri Studio 2", "businessShortName": "M2"},
     "invoiceClientSnapshot": {"id": 1, "clientName": "Renamed"}, "invoiceCurrencySnapshot": {"id": 1, "currencyCode": "USD", "currencySymbol": "$", "currencySubunit": 100},
     "invoiceCustomization": {"id": 1, "color": "#abcdef", "logoSize": "large", "fontSize": "medium", "fontFamily": "Roboto", "tableHeaderStyle": "light", "tableRowStyle": "classic",
                              "pageFormat": "A4", "labelUpperCase": False, "showQuantity": True, "showUnit": False, "showRowNo": True,
                              "fieldSortOrders": {"total": 0, "no": 1}, "pdfTexts": {"title": "Updated"}},
     "invoicePayments": [{"id": 1, "amountCents": "1500", "paidAt": "2026-10-02 10:00:00", "paymentMethod": "card"}, {"amountCents": "250", "paidAt": "2026-10-05 09:00:00", "paymentMethod": "cash"}],
     "invoiceAttachments": []})
call("PUT", "/api/invoices", {**snaps("0002"), "id": 2, "bankId": None, "invoiceBankSnapshot": None, "invoiceNumber": "0010", "invoicePayments": [], "invoiceAttachments": []})
call("PUT", "/api/invoices", {**snaps("0001"), "id": 999})
call("PUT", "/api/invoices", {**snaps("0001"), "businessId": 999, "id": 1})
call("GET", "/api/invoices/sequence?businessId=1&clientId=1")
call("POST", "/api/invoices/duplicate", {"invoiceId": 1, "invoiceType": "invoice"})
call("POST", "/api/invoices/duplicate", {"invoiceId": 3, "invoiceType": "invoice"})
call("POST", "/api/invoices/duplicate", {"invoiceId": 3, "invoiceType": "quotation"})
call("GET", "/api/invoices/sequence?businessId=1&clientId=1")
call("GET", "/api/invoices/sequence?businessId=1&clientId=1&invoiceType=quotation")
call("DELETE", "/api/invoices/2")
call("DELETE", "/api/invoices/999")
call("GET", "/api/invoices")
call("GET", "/api/clients")
# ---- e-commerce integrations, signed webhooks, public API v1 -----------------------
import hmac, hashlib, base64

def sign(secret, body, scheme):
    mac = hmac.new(secret.encode(), body, hashlib.sha256)
    return mac.hexdigest() if scheme == "hex" else base64.b64encode(mac.digest()).decode()

def hook(integ, platform, doc, secret, scheme, header, content_type="application/json", tamper=False):
    body = json.dumps(doc, separators=(",", ":")).encode() if not isinstance(doc, bytes) else doc
    sig = sign(secret, body, scheme)
    if tamper: sig = sign(secret + "x", body, scheme)
    hdrs = {header: sig} if header else {}
    return call_raw("POST", f"/api/webhooks/ecommerce/{platform}/{integ}", body, content_type, hdrs)

call("POST", "/api/ecommerce/integrations", {"name": "x", "platform": "bogus", "businessId": 1, "currencyId": 1})
call("POST", "/api/ecommerce/integrations", {"name": 5, "platform": "generic", "businessId": 1, "currencyId": 1})
call("POST", "/api/ecommerce/integrations", {"name": "No business", "platform": "generic", "currencyId": 1})
call("POST", "/api/ecommerce/integrations", {"name": "   ", "platform": "generic", "businessId": 1, "currencyId": 1})
call("POST", "/api/ecommerce/integrations", {"name": "Bad fk", "platform": "generic", "businessId": 999, "currencyId": 1})
gen = call("POST", "/api/ecommerce/integrations", {"name": " Generic shop ", "platform": "generic", "businessId": 1, "currencyId": 1, "bankId": 1, "defaultTaxRate": 8, "autoIssue": True})["data"]
shop = call("POST", "/api/ecommerce/integrations", {"name": "Shopify shop", "platform": "shopify", "businessId": 1, "currencyId": 1, "autoIssue": False})["data"]
woo = call("POST", "/api/ecommerce/integrations", {"name": "Woo shop", "platform": "woocommerce", "businessId": 1, "currencyId": 1})["data"]
call("GET", "/api/ecommerce/integrations")
G, S, W = gen["integration"]["id"], shop["integration"]["id"], woo["integration"]["id"]
order = {"externalOrderId": "G-1", "customer": {"name": "Zo", "email": "zo@x.test", "phone": "555", "address": "1 Main St", "countryCode": "US"},
         "lineItems": [{"name": "Widget", "quantity": 2, "unitPriceMajor": 12.5}, {"name": "Gizmo", "quantity": "3", "unitPriceMajor": "4.10"}],
         "shippingMajor": 5, "notes": "leave at door"}
hook(G, "generic", order, gen["webhookSecret"], "hex", "X-Webhook-Signature")
hook(G, "generic", order, gen["webhookSecret"], "hex", "X-Webhook-Signature")            # redelivery
hook(G, "generic", {**order, "externalOrderId": "G-2"}, gen["webhookSecret"], "hex", "X-Webhook-Signature")   # same email: client reused
hook(G, "generic", {**order, "externalOrderId": "G-3"}, gen["webhookSecret"], "hex", "X-Webhook-Signature", tamper=True)
hook(G, "generic", {**order, "externalOrderId": "G-4"}, gen["webhookSecret"], "hex", None)
hook(G, "generic", {**order, "externalOrderId": "G-5", "lineItems": []}, gen["webhookSecret"], "hex", "X-Webhook-Signature")
hook(G, "generic", {**order, "externalOrderId": ""}, gen["webhookSecret"], "hex", "X-Webhook-Signature")
hook(G, "generic", {**order, "externalOrderId": "G-6"}, gen["webhookSecret"], "hex", "X-Webhook-Signature", content_type="text/plain")
hook(G, "generic", b"", gen["webhookSecret"], "hex", "X-Webhook-Signature")
hook(G, "shopify", order, gen["webhookSecret"], "hex", "X-Webhook-Signature")             # platform does not match the integration
hook(G, "nope", order, gen["webhookSecret"], "hex", "X-Webhook-Signature")
hook(9999, "generic", order, gen["webhookSecret"], "hex", "X-Webhook-Signature")
hook("abc", "generic", order, gen["webhookSecret"], "hex", "X-Webhook-Signature")
hook(S, "shopify", {"id": 450789469, "name": "#1001", "email": "bob@shop.test", "currency": "USD",
     "customer": {"first_name": "Bo", "last_name": "", "phone": "555"},
     "shipping_address": {"address1": "1 Main", "city": "X", "country": "US", "country_code": "US"},
     "line_items": [{"title": "Shirt", "quantity": 1, "price": "19.99", "sku": "S"}, {"name": "Cap", "quantity": 2, "price": "7.5"}],
     "total_shipping_price_set": {"shop_money": {"amount": "3.50"}}, "note": "gift"}, shop["webhookSecret"], "base64", "X-Shopify-Hmac-Sha256")
hook(S, "shopify", {"id": 450789469}, shop["webhookSecret"], "base64", "X-Shopify-Hmac-Sha256")
hook(S, "shopify", {"id": 1, "line_items": [{"title": "T", "quantity": 1, "price": "1"}]}, shop["webhookSecret"], "base64", "X-Shopify-Hmac-Sha256", tamper=True)
hook(W, "woocommerce", {"id": 727, "number": "727", "currency": "USD", "billing": {"first_name": "Wu", "last_name": "", "email": "wu@shop.test", "phone": "1", "city": "Y", "country": "GB"},
     "line_items": [{"name": "Mug", "quantity": 3, "price": "4.25", "sku": "M"}], "shipping_total": "2.00", "customer_note": "fragile"},
     woo["webhookSecret"], "base64", "X-WC-Webhook-Signature")
call("GET", "/api/invoices?type=invoice")
call("GET", "/api/v1/invoices")
call("GET", "/api/v1/invoices?type=invoice&search=zo&limit=2&offset=0")
call("GET", "/api/v1/invoices?status=open")
call("GET", "/api/v1/invoices?search=nobody")
call("GET", "/api/v1/invoices?limit=0&offset=-5")
call("GET", "/api/v1/invoices?limit=1000")
call("GET", "/api/v1/invoices?from=2030-01-01")
call("GET", "/api/v1/invoices?from=2026-10-01&to=2026-10-02")
call("GET", "/api/v1/invoices?from=garbage")
last = call("GET", "/api/v1/invoices?search=zo&limit=1")["data"]["items"]
if last: call("GET", f"/api/v1/invoices/{last[0]['id']}")
call("GET", "/api/v1/invoices/999999")
call("GET", "/api/v1/invoices/abc")
v1 = {"integrationId": G, "externalOrderId": "API-1", "customer": {"name": "Yi", "email": "yi@x.test"},
      "lineItems": [{"name": "Widget", "quantity": 1, "unitPriceMajor": 12.5}], "shippingMajor": 0, "taxRatePercent": 20}
call("POST", "/api/v1/orders", v1)
call("POST", "/api/v1/orders", v1)
call("POST", "/api/v1/orders", {**v1, "externalOrderId": "API-2", "lineItems": []})
call("POST", "/api/v1/orders", {**v1, "externalOrderId": "API-3", "lineItems": [{"name": "X", "quantity": 0, "unitPriceMajor": 1}]})
call("POST", "/api/v1/orders", {**v1, "externalOrderId": "API-4", "customer": {}})
call("POST", "/api/v1/orders", {**v1, "externalOrderId": ""})
call("POST", "/api/v1/orders", {**v1, "integrationId": 9999})
call("POST", "/api/v1/orders", {k: v for k, v in v1.items() if k != "integrationId"})
call("POST", "/api/ecommerce/integrations/%d/deactivate" % G)
hook(G, "generic", {**order, "externalOrderId": "G-7"}, gen["webhookSecret"], "hex", "X-Webhook-Signature")
call("POST", "/api/v1/orders", {**v1, "externalOrderId": "API-5"})
call("GET", "/api/ecommerce/integrations")
call("DELETE", "/api/ecommerce/integrations/%d" % S)
call("DELETE", "/api/ecommerce/integrations/999")
call("GET", "/api/ecommerce/integrations")
call("GET", "/api/invoices?type=invoice")
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
# The TypeScript server crashes on the next two and is left inside an open
# transaction, and duplicating an unknown invoice leaves it in one too (every
# later write is then silently rolled back), so these run last.
call("POST", "/api/invoices/duplicate", {"invoiceId": 999, "invoiceType": "invoice"})
call("POST", "/api/invoices", {**snaps("Y"), "invoiceBusinessSnapshot": None})
call("POST", "/api/invoices", snaps("0003", invoiceCustomization=None, discountType="bogus"))
json.dump(log, open(out, "w"), indent=1)
