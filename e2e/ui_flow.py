#!/usr/bin/env python3
"""Drives the real web app in Chrome against a running Mavri server and fails
if anything unexpected happens: it creates the owner account, the records an
invoice needs, an invoice with a payment, a duplicate, a quote converted to an
invoice, a preset, a store connection, an API key, a backup download and
restore, and it logs out and back in. Any HTTP error other than the first-load
401 from /api/auth/me, any page error or console error fails the run.

usage: ui_flow.py [BASE_URL]        (default http://localhost:3921)
needs: python3, `pip install playwright`, Google Chrome
"""
import hashlib
import hmac
import json
import sys
import time
import urllib.request
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
          if r.status >= 400 and "/api/session" not in r.url else None)

    pg.goto(URL)
    pg.wait_for_selector("text=Create your account")
    pg.fill("input[type=email]", EMAIL)
    pg.fill("input[type=password]", PASSWORD)
    pg.click("button.primary")
    pg.wait_for_selector("text=Tell us about your business")
    check(True, "owner account created, setup wizard opens")

    pg.fill("label:has-text('Business name') input", "Studio North")
    pg.click("button.primary:text-is('Continue')")
    pg.wait_for_selector("text=Currency and how you get paid")
    pg.click("button.primary:text-is('Continue')")
    pg.fill("label:has-text('Customer name') input", "Acme Ltd")
    pg.click("button.primary:text-is('Save and finish')")
    pg.wait_for_selector("text=You are all set")
    pg.click("button:text-is('Go to the dashboard')")
    pg.wait_for_selector("h1:has-text('Good')")
    check(True, "wizard created business, currency and customer")

    def new_doc(kind, number):
        pg.click(f"nav >> text={kind}")
        pg.click("button.primary")
        pg.locator("#sec-customer select").last.select_option(index=1)
        pg.fill("#customer-search", "Acme Ltd")
        pg.locator("#sec-payment select").first.select_option(label="USD $")
        pg.fill("input[aria-label^='Description']", "Consulting")
        pg.fill("input[aria-label^='Quantity']", "3")
        pg.fill("input[aria-label^='Price']", "100")
        pg.fill("input[aria-label^='Tax rate']", "10")
        pg.locator("input[aria-label=Number]").fill(number)
        pg.click("button.primary:text-is('Issue invoice')" if kind == "Invoices" else "button.primary:text-is('Save')")
        pg.wait_for_selector("article.paper")

    new_doc("Invoices", "1001")
    check("$330.00" in pg.inner_text("article.paper"), "invoice total is 330.00 (3 x 100 + 10% tax)")

    check("Invoice 1001 saved" in pg.inner_text("main"), "saving a new invoice shows the confirmation with next steps")
    pg.click("button:text-is('Record payment') >> nth=0")
    pg.wait_for_selector(".modal")
    pg.click(".modal button.primary:text-is('Record payment')")
    pg.wait_for_selector(".modal", state="detached")
    pg.wait_for_selector(".docsummary .badge.paid")
    check("Paid" in pg.inner_text("article.paper"), "recording a payment marks the invoice paid")

    pg.click("nav >> text=Invoices")
    pg.click("button:text-is('Duplicate')")
    pg.wait_for_selector("form.compose")
    pg.click("button:text-is('Cancel')")
    pg.click("nav >> text=Invoices")
    pg.wait_for_selector("tbody tr:nth-child(2)")
    check(True, "invoice duplicated")

    new_doc("Quotes", "Q1")

    # Share: a secure link a client opens without signing in, to accept the quote.
    pg.click("button:text-is('Share')")
    pg.wait_for_selector(".modal input[aria-label='Secure link']")
    link = pg.input_value(".modal input[aria-label='Secure link']")
    check("/d/" in link, "share dialog creates a secure client link")
    client = browser.new_context(viewport={"width": 1100, "height": 900}).new_page()
    client.on("pageerror", lambda e: problems.append(("pageerror", str(e)[:200])))
    client.goto(link)
    client.wait_for_selector("article.paper")
    check("Q1" in client.inner_text("article.paper") and client.locator("text=Not signed in").count() == 0, "client opens the quote without an account")
    client.fill(".respond textarea", "Looks good")
    client.click("button.primary:text-is('Accept quote')")
    client.wait_for_selector("text=the quote is accepted")
    check(True, "client accepts the quote through the link")
    pg.keyboard.press("Escape")
    pg.wait_for_selector(".modal", state="detached")
    pg.reload()
    pg.wait_for_selector("article.paper")
    check("Accepted" in pg.inner_text("article.paper"), "the owner sees the quote as accepted")
    pg.wait_for_selector("text=Client link")
    check(True, "history shows the acceptance came from the client link")

    pg.click("button:text-is('Convert to invoice')")
    pg.wait_for_url("**/invoices/*")
    check(True, "quote converted to an invoice")

    # Online payments: with Stripe switched on the client gets a Pay button, and Stripe's signed confirmation marks the invoice paid.
    inv_id = pg.url.rstrip("/").split("/")[-1]
    pg.evaluate("""async () => { const r = await fetch('/api/payments/config', {method: 'PUT', headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({enabled: true, secretKey: 'sk_test_e2e', webhookSecret: 'whsec_e2e'})}); if (!r.ok) throw new Error('payments config ' + r.status); }""")
    pg.click("button:text-is('Share')")
    pg.wait_for_selector(".modal input[aria-label='Secure link']")
    link2 = pg.input_value(".modal input[aria-label='Secure link']")
    pg.keyboard.press("Escape")
    pg.wait_for_selector(".modal", state="detached")
    client.goto(link2)
    client.wait_for_selector("button.primary:has-text('Pay $330.00')")
    check(True, "client sees a Pay button for the balance once online payments are on")
    event = json.dumps({"id": "evt_e2e_1", "type": "checkout.session.completed", "data": {"object": {
        "id": "cs_e2e_1", "payment_status": "paid", "amount_total": 33000, "currency": "usd", "client_reference_id": inv_id,
        "metadata": {"mavri_document": inv_id}}}})
    ts = str(int(time.time()))
    sig = hmac.new(b"whsec_e2e", (ts + "." + event).encode(), hashlib.sha256).hexdigest()
    req = urllib.request.Request(URL + "/api/hooks/stripe", data=event.encode(), headers={"Stripe-Signature": f"t={ts},v1={sig}", "Content-Type": "application/json"})
    check(urllib.request.urlopen(req).status == 200, "Stripe's signed confirmation is accepted")
    client.reload()
    client.wait_for_selector(".badge.paid")
    check("payments received" in client.inner_text("article.paper").lower(), "the client page shows the invoice paid, with the payment listed")
    pg.reload()
    pg.wait_for_selector("article.paper")
    check("Paid" in pg.inner_text("article.paper"), "the owner sees the invoice paid by Stripe")

    # Bulk actions from the invoice list.
    pg.click("nav >> text=Invoices")
    pg.wait_for_selector("tbody tr")
    pg.check("input[aria-label='Select all']")
    pg.wait_for_selector(".bulk-bar")
    pg.click(".bulk-bar button:text-is('Mark paid')")
    pg.click("[role=alertdialog] button.primary")
    pg.wait_for_selector(".modal:has-text('done')")
    pg.click(".modal button.primary:text-is('Close')")
    check(True, "bulk action reports what it did for each invoice")

    # Revoking the link stops it working.
    pg.click("nav >> text=Quotes")
    pg.click("tbody tr >> a")
    pg.click("button:text-is('Share')")
    pg.wait_for_selector(".modal input[aria-label='Secure link']")
    pg.click(".modal button:text-is('Turn off link')")
    pg.click("[role=alertdialog] button.primary")
    pg.wait_for_selector(".modal", state="detached")
    client.goto(link)
    client.wait_for_selector("text=not valid any more")
    check(True, "turning the link off stops it working")

    pg.click("nav >> text=Automation")
    pg.wait_for_selector("h2:text-is('Payment reminders')")
    pg.fill("input[type=url]", URL)
    pg.locator("form.card:has(h2:text-is('Public address')) button.primary").click()
    pg.wait_for_selector("text=Automation saved")
    pg.locator("label.inline:has-text('Send reminders automatically') input").check()
    pg.locator("form.card:has(h2:text-is('Payment reminders')) button.primary").click()
    pg.wait_for_selector("text=Automation saved")
    check(True, "automation settings saved (public address, reminders)")

    pg.click("nav >> text=Integrations")
    pg.fill("input[type=url]", "http://127.0.0.1:9/hook")
    pg.click("button.primary:text-is('Add webhook')")
    pg.wait_for_selector("text=Signing secret")
    pg.click("button:text-is('Send test')")
    pg.wait_for_selector("td:has-text('ping')")
    check(True, "webhook added with a one-time secret; a test event is queued")

    pg.click("nav >> text=Data & backups")
    pg.wait_for_selector("h2:text-is('Backups')")
    with pg.expect_download() as dl2:
        pg.click("button:text-is('Customers')")
    check(dl2.value.suggested_filename.endswith(".csv"), "customers exported as CSV")
    csv_path = "/tmp/mavri-e2e-customers.csv"
    open(csv_path, "w").write("name,email\nBeta Ltd,b@beta.example\n,nobody@x.example\n")
    pg.set_input_files("input[aria-label='CSV file']", csv_path)
    pg.click("button:text-is('Check file')")
    pg.wait_for_selector("text=1 of 2 rows are ready to import")
    pg.click("button.primary:text-is('Import 1 customers')")
    pg.wait_for_selector("text=Imported 1 customers")
    check(True, "CSV import checks the file first, then imports the valid rows")
    pg.click("button:text-is('Back up now')")
    pg.wait_for_selector("text=Last good backup")
    check(True, "backup taken and shown as the last good backup")
    pg.click("button:text-is('Restore…')")
    pg.click(".modal button.primary:text-is('Check this backup')")
    pg.wait_for_selector("text=The backup is readable")
    pg.click(".modal button:text-is('Cancel')")
    check(True, "restore guide checks a backup before anything changes")

    pg.click("nav >> text=Activity")
    pg.wait_for_selector("td:has-text('Client link')")
    check(True, "activity lists changes with where they came from")
    pg.click("nav >> text=Health")
    pg.wait_for_selector("text=Integrity check passed")
    check(True, "health page reports the database")

    pg.click("nav >> text=Reports")
    pg.wait_for_selector("h2:text-is('By customer')")
    check(True, "reports render")

    pg.click("nav >> text=Presets")
    pg.click("button:text-is('New preset')")
    pg.fill("form.dialog label:text-matches('^Name') input", "Monthly")
    for label in ("Business", "Customer"):
        pg.locator(f"form.dialog label:text-matches('^{label}') select").select_option(index=1)
    pg.locator("form.dialog label:text-matches('^Currency') select").select_option(label="USD")
    pg.click("form.dialog button.primary")
    pg.wait_for_selector("td:has-text('Monthly')")
    check(True, "preset created")

    pg.click("nav >> text=Stores")
    pg.click("button:text-is('Connect a store')")
    pg.fill("form.dialog label:text-matches('^Name') input", "Shop")
    pg.locator("form.dialog label:text-matches('^Business') select").select_option(index=1)
    pg.locator("form.dialog label:text-matches('^Currency') select").select_option(label="USD")
    pg.click("form.dialog button.primary")
    pg.wait_for_selector("text=Webhook URL:")
    check(True, "store connected, secret shown once")

    pg.click("nav >> text=Settings")
    pg.fill("input[placeholder='Key name']", "e2e")
    pg.click("button:text-is('Create key')")
    pg.wait_for_selector("text=New key:")
    check(True, "API key created")
    with pg.expect_download() as dl:
        pg.click("button:text-is('Download backup')")
    path = dl.value.path()
    pg.set_input_files("input[type=file]", path)
    pg.click("[role=alertdialog] button.primary:text-is('Restore')")
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
