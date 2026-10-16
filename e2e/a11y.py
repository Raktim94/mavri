#!/usr/bin/env python3
"""Automated accessibility check: runs axe-core (WCAG 2.0, 2.1 and 2.2 level A and AA rules) on the main screens, in
light and dark themes, at desktop and phone width, against a fresh Mavri server. It finds what a tool can find (names,
contrast, roles, labels, focus order hints); it is not a substitute for testing with people and assistive technology.

usage: a11y.py [BASE_URL]      needs: playwright, Google Chrome, and `npm install` (for axe-core)
Run it against an empty server, never real data. Exit code 1 when any violation is found."""
import json
import sys
import urllib.request
import http.cookiejar
from pathlib import Path
from playwright.sync_api import sync_playwright

URL = (sys.argv[1] if len(sys.argv) > 1 else "http://localhost:3921").rstrip("/")
AXE = (Path(__file__).resolve().parent.parent / "node_modules" / "axe-core" / "axe.min.js").read_text()
TAGS = ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"]
PW = "Correct-Horse-9"

cj = http.cookiejar.CookieJar()
op = urllib.request.build_opener(urllib.request.HTTPCookieProcessor(cj))


def api(method, path, body=None):
    req = urllib.request.Request(URL + path, method=method, data=json.dumps(body).encode() if body is not None else None, headers={"Content-Type": "application/json"})
    return json.loads(op.open(req).read() or "null")


def seed():
    api("POST", "/api/setup", {"email": "a11y@example.com", "password": PW})
    iss = api("POST", "/api/parties", {"kind": "issuer", "name": "Northwind Studio", "email": "hi@nw.example", "address": "12 Harbour Rd\nPune 411001", "taxId": "27AAPFU0939F1ZV", "country": "IN"})
    cus = api("POST", "/api/parties", {"kind": "customer", "name": "Acme Traders", "email": "ap@acme.example", "address": "48 Market St\nMumbai 400001", "taxId": "07AAGFF2194N1Z1", "country": "IN"})
    inr = [c for c in api("GET", "/api/currencies") if c["code"] == "INR"][0]
    bank = api("POST", "/api/banks", {"label": "Main", "bankName": "Example Bank", "holder": "Northwind", "accountNumber": "0000111122", "swift": "EXAMPINBB", "upi": "nw@examplebank"})
    st = api("POST", "/api/styles", {"name": "GST", "accent": "#1b1f27", "template": "gst-india-detailed", "font": "sans", "textSize": "small", "logoSize": "medium", "pageSize": "A4", "headerStyle": "light", "rowStyle": "plain", "showNumbers": True, "showUnit": True, "showQty": True})
    doc = api("POST", "/api/documents", {"kind": "invoice", "issuerId": iss["id"], "customerId": cus["id"], "currencyId": inr["id"], "bankId": bank["id"], "styleId": st["id"], "issuedOn": "2026-08-20", "dueOn": "2026-09-01", "number": "1", "numberPrefix": "INV-",
                                          "lines": [{"name": "Brand workshop", "quantity": 2, "unitCents": 80000, "taxRate": 18, "taxMode": "add", "unit": "day", "taxCode": "998399"}]})
    api("POST", f"/api/documents/{doc['id']}/issue")
    return cus["id"], doc["id"]


def main():
    cus, doc = seed()
    pages = ["/dashboard", "/invoices", "/invoices/new", f"/invoices/{doc}", "/quotes", "/collections", "/templates", "/tax", "/customers", f"/customers/{cus}", "/issuers", "/products", "/data", "/settings", "/automation", "/integrations", "/activity", "/health", "/reports"]
    failures = 0
    with sync_playwright() as p:
        browser = p.chromium.launch(channel="chrome")
        for scheme in ("light", "dark"):
            for width, height in ((1280, 900), (390, 844)):
                ctx = browser.new_context(viewport={"width": width, "height": height}, color_scheme=scheme, reduced_motion="reduce", bypass_csp=True)
                pg = ctx.new_page()
                pg.goto(URL)
                pg.fill("input[type=email]", "a11y@example.com")
                pg.fill("input[type=password]", PW)
                pg.click("button.primary")
                pg.wait_for_selector("nav", state="attached")
                try:
                    pg.click("text=Skip", timeout=1200)
                except Exception:
                    pass
                for path in pages:
                    pg.goto(URL + path)
                    pg.wait_for_timeout(700)
                    pg.add_script_tag(content=AXE)
                    res = pg.evaluate("(tags) => axe.run(document, {runOnly: {type: 'tag', values: tags}})", TAGS)
                    for v in res["violations"]:
                        failures += 1
                        print(f"[{scheme} {width}px] {path}: {v['id']} ({v['impact']}) {v['help']}")
                        for n in v["nodes"][:3]:
                            print("    ", n["html"][:140].replace("\n", " "), "->", n["failureSummary"].splitlines()[1] if len(n["failureSummary"].splitlines()) > 1 else "")
                ctx.close()
        browser.close()
    print("violations:", failures)
    sys.exit(1 if failures else 0)


main()
