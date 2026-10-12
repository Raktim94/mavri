#!/usr/bin/env python3
"""Drives the real web app in Chrome against a running Mavri server and fails
if anything unexpected happens: it creates the owner account, the records an
invoice needs, an invoice with a payment, a duplicate, a quote converted to an
invoice, a preset, a store integration, an API key, a backup download and
restore, and it logs out and back in. Any HTTP error other than the first-load
401 from /api/auth/me, any page error or console error fails the run.

usage: ui_flow.py [BASE_URL]        (default http://localhost:3921)
needs: python3, `pip install playwright`, Google Chrome
"""
import sys
from playwright.sync_api import sync_playwright

URL = (sys.argv[1] if len(sys.argv) > 1 else "http://localhost:3921").rstrip("/")
EMAIL, PASSWORD = "owner@example.com", "Correct-Horse-9"
failures, problems = [], []


def check(ok, what):
    print(("  ok    " if ok else "  FAIL  ") + what)
    if not ok:
        failures.append(what)


def add(pg, nav, button, fields):
    pg.click(f"nav >> text={nav}")
    pg.click(f"button:text-is('{button}')")
    for label, value in fields.items():
        pg.locator(f"form.dialog label:text-matches('^{label}') input").first.fill(value)
    pg.click("form.dialog button.primary")
    pg.wait_for_selector(f"td:has-text('{list(fields.values())[0]}')")


with sync_playwright() as p:
    browser = p.chromium.launch(channel="chrome")
    ctx = browser.new_context(viewport={"width": 1280, "height": 900}, accept_downloads=True)
    pg = ctx.new_page()
    pg.on("console", lambda m: problems.append(("console", m.text[:200])) if m.type == "error" and "401" not in m.text else None)
    pg.on("pageerror", lambda e: problems.append(("pageerror", str(e)[:200])))
    pg.on("response", lambda r: problems.append(("http", r.status, r.url.replace(URL, "")))
          if r.status >= 400 and "/api/auth/me" not in r.url else None)

    pg.goto(URL)
    pg.wait_for_selector("text=Create your account")
    pg.fill("input[type=email]", EMAIL)
    pg.fill("input[type=password]", PASSWORD)
    pg.click("button.primary")
    pg.wait_for_selector("h1:text-is('Invoices')")
    check(True, "owner account created and signed in")

    add(pg, "Businesses", "New business", {"Name": "Studio North"})
    add(pg, "Clients", "New client", {"Name": "Acme Ltd"})
    check(True, "business and client created")

    def new_doc(kind, number):
        pg.click(f"nav >> text={kind}")
        pg.click("button.primary")
        sels = pg.locator("form.editor select")
        sels.nth(0).select_option(index=1)
        sels.nth(1).select_option(index=1)
        sels.nth(2).select_option(index=1)
        pg.fill("input[aria-label=Description]", "Consulting")
        pg.fill("input[aria-label=Quantity]", "3")
        pg.fill("input[aria-label=Price]", "100")
        pg.fill("input[aria-label='Tax rate']", "10")
        pg.locator("label:text-matches('^Number') input").fill(number)
        pg.click("button.primary:text-is('Save')")
        pg.wait_for_selector("article.paper")

    new_doc("Invoices", "1001")
    check("$330.00" in pg.inner_text("article.paper"), "invoice total is 330.00 (3 x 100 + 10% tax)")

    pg.click("a:text-is('Edit')")
    pg.click("button:text-is('Record payment')")
    pg.click("button.primary:text-is('Save')")
    pg.wait_for_selector("article.paper")
    check("Paid" in pg.inner_text("article.paper"), "payment marks the invoice paid")

    pg.click("nav >> text=Invoices")
    pg.click("button:text-is('Duplicate')")
    pg.wait_for_function("document.querySelectorAll('tbody tr').length === 2")
    check(True, "invoice duplicated")

    new_doc("Quotes", "Q1")
    pg.click("button:text-is('Convert to invoice')")
    pg.wait_for_url("**/invoices/*")
    check(True, "quote converted to an invoice")

    pg.click("nav >> text=Reports")
    pg.wait_for_selector("h2:text-is('By client')")
    check(True, "reports render")

    pg.click("nav >> text=Presets")
    pg.click("button:text-is('New preset')")
    pg.fill("form.dialog label:text-matches('^Name') input", "Monthly")
    for label in ("Business", "Client", "Currency"):
        pg.locator(f"form.dialog label:text-matches('^{label}') select").select_option(index=1)
    pg.click("form.dialog button.primary")
    pg.wait_for_selector("td:has-text('Monthly')")
    check(True, "preset created")

    pg.click("nav >> text=Integrations")
    pg.click("button:text-is('New integration')")
    pg.fill("form.dialog label:text-matches('^Name') input", "Shop")
    pg.locator("form.dialog label:text-matches('^Business') select").select_option(index=1)
    pg.locator("form.dialog label:text-matches('^Currency') select").select_option(index=1)
    pg.click("form.dialog button.primary")
    pg.wait_for_selector("text=Webhook URL:")
    check(True, "integration created, secret shown once")

    pg.click("nav >> text=Settings")
    pg.fill("input[placeholder='Key name']", "e2e")
    pg.click("button:text-is('Create key')")
    pg.wait_for_selector("text=New key:")
    check(True, "API key created")
    with pg.expect_download() as dl:
        pg.click("button:text-is('Download backup')")
    path = dl.value.path()
    pg.once("dialog", lambda d: d.accept())
    pg.set_input_files("input[type=file]", path)
    pg.wait_for_selector("text=Backup restored")
    check(True, "backup downloaded and restored")

    pg.click("button:text-is('Log out')")
    pg.wait_for_selector("text=Sign in to Mavri")
    pg.fill("input[type=email]", EMAIL)
    pg.fill("input[type=password]", PASSWORD)
    pg.click("button.primary")
    pg.wait_for_selector("nav >> text=Log out")
    check(True, "logged out and back in")
    browser.close()

for pr in problems:
    check(False, f"unexpected {pr}")
print("\nFAILED" if failures else "\nALL PASSED")
sys.exit(1 if failures else 0)
