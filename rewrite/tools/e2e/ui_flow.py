#!/usr/bin/env python3
"""Drives the real web app in Chrome against a running Mavri server and fails
if anything unexpected happens: it creates the owner account, the records an
invoice needs, then an invoice, its PDF preview, a payment, a duplicate, a
quote converted to an invoice, a backup export and re-import, and visits every
page. Any HTTP error other than the first-load 401 from /api/auth/me, any
page error or console error fails the run.

usage: ui_flow.py [BASE_URL]        (default http://localhost:3921)
needs: python3, `pip install playwright`, Google Chrome
"""
import os, sys, tempfile
from playwright.sync_api import sync_playwright

URL = (sys.argv[1] if len(sys.argv) > 1 else "http://localhost:3921").rstrip("/")
EMAIL, PASSWORD = "owner@example.com", "Correct-Horse-9"
failures, problems, calls = [], [], []

def check(ok, what):
    print(("  ok    " if ok else "  FAIL  ") + what)
    if not ok: failures.append(what)

with sync_playwright() as p:
    browser = p.chromium.launch(channel="chrome")
    ctx = browser.new_context(viewport={"width": 1440, "height": 1000}, accept_downloads=True)
    pg = ctx.new_page()
    pg.on("console", lambda m: problems.append(("console", m.text[:200])) if m.type == "error" else None)
    pg.on("pageerror", lambda e: problems.append(("pageerror", str(e)[:200])))
    pg.on("response", lambda r: (problems.append(("http", r.status, r.request.method, r.url.replace(URL, "")))
                                 if r.status >= 400 else None))
    pg.on("response", lambda r: calls.append((r.request.method, r.url.replace(URL, "").split("?")[0], r.status))
          if "/api/" in r.url and r.request.method != "GET" else None)

    def go(path, wait=1500): pg.goto(URL + path); pg.wait_for_timeout(wait)
    def text(): return pg.inner_text("body")
    def fill(label, value): pg.get_by_label(label, exact=True).first.fill(value)
    def add(path): go(path); pg.click('[aria-label="Add"]'); pg.wait_for_timeout(1200)
    def save(wait=1800): pg.locator('button:has-text("Save")').first.click(); pg.wait_for_timeout(wait)
    def pick(label, option):
        pg.get_by_text(label, exact=True).click(); pg.wait_for_timeout(900)
        pg.locator(f"text={option}").last.click(); pg.wait_for_timeout(900)

    print("account")
    go("/")
    pg.fill("input[type=email]", EMAIL); pg.fill("input[type=password]", PASSWORD)
    pg.click('button:has-text("Create account")'); pg.wait_for_timeout(3000)
    check("Invoices" in text(), "owner account created and signed in")

    print("records")
    add("/businesses"); fill("Name *", "Mavri Studio"); fill("Short name *", "MS")
    fill("Address", "1 Main St, Springfield, IL 62704, US"); fill("Email", "hello@mavri.test"); save()
    check("Mavri Studio" in text(), "business created")
    add("/clients"); fill("Name *", "Acme Corp"); fill("Short name *", "AC"); fill("Email", "ap@acme.test"); save()
    check("Acme Corp" in text(), "client created")
    add("/items"); fill("Name *", "Consulting"); fill("Amount *", "150.00"); save()
    check("Consulting" in text(), "item created")
    add("/banks"); fill("Name *", "Main account"); fill("Bank name", "First Bank"); fill("Account number", "DE89370400440532013000"); save()
    check("Main account" in text(), "bank created")
    add("/styleProfiles"); fill("Name *", "Classic look")
    pg.get_by_label("Layout", exact=True).first.click(); pg.wait_for_timeout(700)
    pg.locator("[role=option]").first.click(); save(2500)
    check("Classic look" in text(), "style profile created")

    def build(number, kind):
        add("/" + kind); pg.click("text=Create new"); pg.wait_for_timeout(2000)
        pick("CURRENCY *", "United States Dollar"); pick("BANK", "Main account"); pick("STYLE PROFILE", "Classic look")
        pick("BUSINESS *", "Mavri Studio"); pick("BILL TO *", "Acme Corp")
        pg.locator("text=INFORMATION *").first.click(); pg.wait_for_timeout(1200)
        fill(("Invoice" if kind == "invoices" else "Quote") + " number *", number)
        pg.get_by_label("Due date").first.click(); pg.keyboard.type("11302026"); pg.wait_for_timeout(300)
        pg.locator('button:has-text("Save")').last.click(); pg.wait_for_timeout(1000)
        pg.click("text=ADD ITEM *"); pg.wait_for_timeout(1000); pg.locator("text=Consulting").last.click(); pg.wait_for_timeout(1300)
        fill("Quantity *", "2"); pg.locator('button:has-text("Save")').last.click(); pg.wait_for_timeout(1000)
        save(3000)

    print("invoice")
    build("0001", "invoices")
    check("0001" in text() and "$300.00" in text(), "invoice created with the right total")
    pg.click("text=0001"); pg.wait_for_timeout(1500)
    pg.click('button[aria-label="Preview"]'); pg.wait_for_timeout(7000)
    check(pg.locator("iframe,canvas,embed,object").count() > 0 and "Acme Corp" in pg.inner_text("body") or pg.locator("iframe").count() > 0,
          "PDF preview rendered")
    pg.click('button[aria-label="Edit"]'); pg.wait_for_timeout(1200)
    pg.get_by_text("Mark as paid").click(); pg.wait_for_timeout(600); save(2500)
    check("PAID" in text(), "invoice marked as paid")
    pg.locator('button[aria-label="Actions"]').first.click(); pg.wait_for_timeout(800); pg.click("text=Duplicate"); pg.wait_for_timeout(3000)
    check("0002" in text(), "invoice duplicated with the next number")

    print("quote")
    build("Q-1", "quotes")
    go("/quotes"); pg.locator("text=Q-1").first.click(); pg.wait_for_timeout(1800)
    pg.locator('button[aria-label="Actions"]').first.click(); pg.wait_for_timeout(800); pg.click("text=Make invoice"); pg.wait_for_timeout(3000)
    go("/invoices", 2000); check("Q-1" in text(), "quote converted to an invoice")

    print("backup")
    go("/settings", 2000)
    with pg.expect_download(timeout=20000) as d:
        pg.locator('[role=button]:has-text("Export your data")').first.click()
    backup = os.path.join(tempfile.mkdtemp(), "backup.json"); d.value.save_as(backup)
    check(os.path.getsize(backup) > 5000 and d.value.suggested_filename.startswith("mavri-backup-"), "backup downloaded")
    pg.locator('[role=button]:has-text("Import your data")').first.click(); pg.wait_for_timeout(800)
    with pg.expect_file_chooser(timeout=15000) as fc:
        pg.locator('button:has-text("Confirm")').click()
    fc.value.set_files(backup); pg.wait_for_timeout(4000)
    go("/invoices", 2000)
    check("0001" in text() and "0002" in text() and "Q-1" in text(), "backup imported back, nothing lost")

    print("pages")
    for route in ["/reports", "/settings", "/presets", "/layouts", "/styleProfiles", "/currencies", "/units", "/categories",
                  "/integrations", "/quotes", "/items", "/banks", "/clients", "/businesses"]:
        go(route, 1800)
        check(len(text()) > 200 and "Something went wrong" not in text(), f"{route} loads")
    go("/reports", 3000)
    check("Invoiced this period" in text(), "dashboard shows figures")

    browser.close()

unexpected = [x for x in problems if not (x[0] == "http" and x[1] == 401 and x[3] == "/api/auth/me")
              and not (x[0] == "console" and "401" in x[1])]
check(not unexpected, "no unexpected HTTP, console or page errors")
for x in unexpected: print("   ", x)
print("writes seen:", sorted({(m, u) for m, u, s in calls}))
print("\nFAILED" if failures else "\nALL PASSED"); sys.exit(1 if failures else 0)
