#!/usr/bin/env python3
"""Regenerates the README and guide screenshots from a fresh Mavri server.

It walks the real first-run flow (account, setup wizard with logo), creates a
few fictional invoices and takes the pictures in docs/screenshots.
usage: screenshots.py [BASE_URL] [OUT_DIR]   needs: playwright, Google Chrome
Run it against an empty server (e.g. the e2e container), never real data.
"""
import sys
from pathlib import Path
from playwright.sync_api import sync_playwright

URL = (sys.argv[1] if len(sys.argv) > 1 else "http://localhost:3921").rstrip("/")
OUT = Path(sys.argv[2] if len(sys.argv) > 2 else Path(__file__).resolve().parent.parent / "docs" / "screenshots")
LOGO = Path(__file__).resolve().parent.parent / "mavri-logo.png"
PASSWORD = "Correct-Horse-9"


def shot(pg, name):
    pg.wait_for_timeout(900)  # let entrance animations finish
    pg.add_style_tag(content=".toasts{display:none!important}")  # no stray toasts in pictures
    pg.screenshot(path=str(OUT / f"{name}.png"))
    print("  wrote", name)


def new_invoice(pg, number, customer, lines, status=None):
    pg.click("nav >> text=Invoices")
    pg.click("button.primary:text-is('New invoice')") if pg.locator("button.primary:text-is('New invoice')").count() else pg.click("button.primary")
    sels = pg.locator("form.editor select")
    sels.nth(0).select_option(index=1)
    sels.nth(1).select_option(label=customer)
    sels.nth(2).select_option(label="USD $")
    for i, (desc, qty, price) in enumerate(lines):
        if i:
            pg.click("button:text-is('Add line')")
        pg.locator("input[aria-label=Description]").nth(i).fill(desc)
        pg.locator("input[aria-label=Quantity]").nth(i).fill(str(qty))
        pg.locator("input[aria-label=Price]").nth(i).fill(str(price))
        pg.locator("input[aria-label='Tax rate']").nth(i).fill("10")
    pg.locator("input[aria-label=Number]").fill(number)
    pg.click("button.primary:text-is('Save')")
    pg.wait_for_selector("article.paper")


with sync_playwright() as p:
    OUT.mkdir(parents=True, exist_ok=True)
    browser = p.chromium.launch(channel="chrome")
    ctx = browser.new_context(viewport={"width": 1280, "height": 860}, color_scheme="light")
    pg = ctx.new_page()
    pg.goto(URL)
    pg.wait_for_selector("text=Create your account")
    pg.fill("input[type=email]", "owner@studionorth.example")
    pg.fill("input[type=password]", PASSWORD)
    shot(pg, "first-run")
    pg.click("button.primary")
    pg.wait_for_selector("text=Tell us about your business")
    pg.set_input_files("input[type=file]", str(LOGO))
    pg.fill("label:has-text('Business name') input", "Studio North")
    pg.locator("label:has-text('Email') input").first.fill("hello@studionorth.example")
    pg.locator("label:has-text('Phone') input").first.fill("+44 20 7946 0123")
    pg.fill("label:has-text('Address') textarea", "14 Wharf Lane\nLondon E14 9TS")
    pg.locator("label:has-text('Tax ID') input").fill("GB 123 4567 89")
    shot(pg, "onboarding")
    pg.click("button.primary:text-is('Continue')")
    pg.wait_for_selector("text=Currency and how you get paid")
    pg.fill("label:has-text('Bank name') input", "Northern Bank")
    pg.fill("label:has-text('Account holder') input", "Studio North Ltd")
    pg.fill("label:has-text('Account number') input", "GB29 NWBK 6016 1331 9268 19")
    pg.fill("label:has-text('SWIFT') input", "NWBKGB2L")
    pg.click("button.primary:text-is('Continue')")
    pg.fill("label:has-text('Customer name') input", "Brightwave Studio")
    pg.fill("label:has-text('Customer email') input", "finance@brightwave.example")
    pg.click("button.primary:text-is('Save and finish')")
    pg.wait_for_selector("text=You are all set")
    pg.click("button:text-is('Go to the dashboard')")
    pg.wait_for_selector("h1:has-text('Good')")

    new_invoice(pg, "1001", "Brightwave Studio", [("Brand identity", 1, 3200), ("Logo animation", 2, 450)])
    new_invoice(pg, "1002", "Brightwave Studio", [("Website design", 1, 2400)])
    new_invoice(pg, "1003", "Brightwave Studio", [("Monthly retainer", 1, 1800), ("Hosting", 12, 25)])
    pg.wait_for_timeout(1000)
    pg.locator("article.paper").screenshot(path=str(OUT / "invoice-view.png"))
    print("  wrote invoice-view")
    pg.click("nav >> text=Dashboard")
    pg.wait_for_selector("tbody tr")
    shot(pg, "dashboard")
    pg.click("nav >> text=Invoices")
    pg.wait_for_selector("tbody tr")
    shot(pg, "invoices")
    pg.click("nav >> text=Settings")
    pg.wait_for_selector("text=Updates")
    shot(pg, "settings")
    pg.click("nav >> text=Businesses")
    pg.click("button:text-is('Edit')")
    shot(pg, "businesses")

    # Seed fictional records through the API (same session) so every list has something to show.
    def api(method, path, body=None):
        return pg.evaluate(
            """async ([m, p, b]) => { const r = await fetch(p, {method: m, headers: {'Content-Type': 'application/json'}, body: b ? JSON.stringify(b) : undefined}); return r.status; }""",
            [method, path, body],
        )

    for name, email in [("Harbor & Pine Cafe", "accounts@harborpine.example"), ("Ledgerline Co", "ap@ledgerline.example")]:
        api("POST", "/api/parties", {"kind": "customer", "name": name, "email": email, "country": "GB"})
    for kind, name in [("category", "Design"), ("category", "Hosting"), ("unit", "hour"), ("unit", "project"), ("unit", "month")]:
        api("POST", "/api/groups", {"kind": kind, "name": name})
    for name, desc, cents, cat, unit in [
        ("Brand identity", "Logo, colours and type", 320000, 1, 3),
        ("Design hour", "Senior designer", 9500, 1, 2),
        ("Managed hosting", "Includes backups", 2500, 2, 4),
    ]:
        api("POST", "/api/products", {"name": name, "description": desc, "priceCents": cents, "categoryId": cat, "unitId": unit})
    api("POST", "/api/styles", {"name": "Studio coral", "accent": "#EA806E", "font": "serif", "textSize": "medium", "pageSize": "A4"})
    api("POST", "/api/presets", {"name": "Brightwave monthly", "issuerId": 1, "customerId": 2, "currencyId": 1, "bankId": 1, "noteThanks": "Thank you for your business."})
    api("POST", "/api/shops", {"name": "Online shop", "platform": "generic", "issuerId": 1, "currencyId": 1, "bankId": 1})
    api("POST", "/api/documents", {"kind": "quote", "issuerId": 1, "customerId": 2, "currencyId": 1, "issuedOn": "2026-10-13",
        "lines": [{"name": "Website redesign", "quantity": 1, "unitCents": 480000, "taxRate": 10, "taxMode": "add"}]})
    # Record a full payment on invoice 1002 so one invoice shows as paid.
    pg.evaluate(
        """async () => {
          const list = await (await fetch('/api/documents?kind=invoice')).json();
          const id = list.items.find(d => d.fullNumber === '1002').id;
          const d = await (await fetch('/api/documents/' + id)).json();
          const body = {kind: d.kind, issuerId: d.issuerId, customerId: d.customerId, currencyId: d.currencyId, bankId: d.bankId, styleId: d.styleId,
            number: d.number, numberPrefix: d.numberPrefix, numberSuffix: d.numberSuffix, issuedOn: d.issuedOn, dueOn: d.dueOn, lines: d.lines,
            discount: d.discount, surcharge: d.surcharge, shippingCents: d.shippingCents, taxRate: d.taxRate, taxMode: d.taxMode,
            payments: [{amountCents: d.totals.totalCents, paidOn: d.issuedOn, method: 'bank', note: ''}],
            noteCustomer: d.noteCustomer, noteTerms: d.noteTerms, noteThanks: d.noteThanks};
          await fetch('/api/documents/' + id, {method: 'PUT', headers: {'Content-Type': 'application/json'}, body: JSON.stringify(body)});
        }"""
    )
    pg.reload()  # drop the client-side cache so the seeded records show up everywhere
    pg.wait_for_selector("nav")
    for label, name in [("Quotes", "quotes"), ("Customers", "customers"), ("Products", "products"), ("Bank accounts", "bank-accounts"),
                        ("Currencies", "currencies"), ("Categories", "categories"), ("Units", "units"), ("Presets", "presets"),
                        ("Styles", "styles"), ("Reports", "reports"), ("Stores", "stores")]:
        pg.click(f"nav >> text={label}")
        pg.wait_for_timeout(500)
        shot(pg, name)
    pg.click("nav >> text=Invoices")
    pg.wait_for_selector("tbody tr")
    pg.locator("tbody tr", has_text="1002").locator("a").first.click()
    pg.wait_for_selector("article.paper")
    pg.wait_for_timeout(1000)
    pg.locator("article.paper").screenshot(path=str(OUT / "invoice-paid.png"))
    print("  wrote invoice-paid")
    pg.click("nav >> text=Invoices")
    pg.click("button.primary:text-is('New invoice')") if pg.locator("button.primary:text-is('New invoice')").count() else pg.click("button.primary")
    sels = pg.locator("form.editor select")  # presets exist now, so the business, customer and currency are one position later
    sels.nth(1).select_option(index=1)
    sels.nth(2).select_option(label="Harbor & Pine Cafe")
    sels.nth(3).select_option(label="USD $")
    pg.locator("input[aria-label=Description]").nth(0).fill("Menu redesign")
    pg.locator("input[aria-label=Quantity]").nth(0).fill("1")
    pg.locator("input[aria-label=Price]").nth(0).fill("1800")
    pg.locator("input[aria-label='Tax rate']").nth(0).fill("10")
    pg.click("button:text-is('Add line')")
    pg.locator("input[aria-label=Description]").nth(1).fill("Print-ready files")
    pg.locator("input[aria-label=Quantity]").nth(1).fill("2")
    pg.locator("input[aria-label=Price]").nth(1).fill("150")
    pg.locator("input[aria-label='Tax rate']").nth(1).fill("10")
    shot(pg, "invoice-editor")
    ctx.close()

    dark = browser.new_context(viewport={"width": 1280, "height": 860}, color_scheme="dark")
    pg = dark.new_page()
    pg.goto(URL)
    pg.fill("input[type=email]", "owner@studionorth.example")
    pg.fill("input[type=password]", PASSWORD)
    pg.click("button.primary")
    pg.wait_for_selector("tbody tr")
    shot(pg, "invoices-dark")
    browser.close()
