"""Browser check of the invoice lifecycle: draft, issue (lock), credit note, and matching a bank statement.

usage: lifecycle_flow.py [BASE_URL]   needs: playwright, Google Chrome. Run it against an empty server."""
import json,sys,urllib.request,http.cookiejar,tempfile,os
from playwright.sync_api import sync_playwright
U=(sys.argv[1] if len(sys.argv)>1 else "http://localhost:3921").rstrip("/")
cj=http.cookiejar.CookieJar(); op=urllib.request.build_opener(urllib.request.HTTPCookieProcessor(cj))
def call(m,p,b=None):
    r=urllib.request.Request(U+p,method=m,data=json.dumps(b).encode() if b is not None else None,headers={'Content-Type':'application/json'})
    return json.loads(op.open(r).read() or 'null')
call('POST','/api/setup',{'email':'o@x.example','password':'Correct-Horse-9'})
iss=call('POST','/api/parties',{'kind':'issuer','name':'Northwind','email':'hi@nw.example','address':'12 Rd\nPune 411001','taxId':'27AAPFU0939F1ZV','country':'IN'})
cus=call('POST','/api/parties',{'kind':'customer','name':'Acme Traders','email':'ap@acme.example','address':'48 St\nMumbai 400001','country':'IN'})
usd=[c for c in call('GET','/api/currencies') if c['code']=='USD'][0]
ok=[]
def check(c,m):
    ok.append(c); print(('  ok    ' if c else '  FAIL  ')+m)
with sync_playwright() as p:
    b=p.chromium.launch(channel="chrome"); pg=b.new_context(viewport={"width":1300,"height":950}).new_page()
    errs=[]; pg.on("console",lambda m: errs.append(m.text) if m.type=="error" and "401" not in m.text else None)
    pg.goto(U); pg.fill("input[type=email]","o@x.example"); pg.fill("input[type=password]","Correct-Horse-9"); pg.click("button.primary"); pg.wait_for_selector("nav")
    try: pg.click("text=Skip",timeout=1200)
    except Exception: pass
    # draft -> issue
    pg.goto(U+"/invoices/new"); pg.wait_for_selector(".compose")
    pg.locator("#sec-customer select").last.select_option(index=1); pg.fill("#customer-search","Acme Traders")
    pg.locator("#sec-payment select").first.select_option(label="USD $")
    pg.fill("input[aria-label^='Description']","Consulting"); pg.fill("input[aria-label^='Quantity']","3"); pg.fill("input[aria-label^='Price']","100")
    pg.fill("input[aria-label^='Tax rate']","10"); pg.fill("input[aria-label='Number']","7001"); 
    pg.click("button:text-is('Save draft')"); pg.wait_for_selector("article.paper")
    check("Draft" in pg.inner_text(".docsummary"),"a new invoice saves as a draft")
    check(pg.locator("button:text-is('Issue invoice')").count()==1 and pg.locator("a:text-is('Edit')").count()==1,"a draft can be edited and issued")
    pg.click("button:text-is('Issue invoice')"); pg.click(".confirm button.primary"); pg.wait_for_selector("text=Issued 2026")
    check(pg.locator("a:text-is('Edit')").count()==0,"an issued invoice has no Edit")
    # credit note, lines mode
    pg.click("button:text-is('Credit note')"); pg.wait_for_selector(".modal")
    pg.check("text=Some lines"); pg.fill("input[aria-label^='Quantity to credit']","1"); pg.fill(".modal input:not([type]):not([type=radio]):not([type=number])","Cancelled a day")
    pg.click(".modal button.primary"); pg.wait_for_selector("text=This credit note corrects")
    check("Credit note" in pg.inner_text("article.paper") and "Corrects" in pg.inner_text("article.paper"),"a credit note is issued and names the invoice")
    pg.click("text=INV-7001") if pg.locator("text=INV-7001").count() else pg.go_back()
    pg.wait_for_selector("article.paper")
    check("Credit notes" in pg.inner_text("article.paper") or "7001" in pg.inner_text("article.paper"),"back on the invoice")
    # statement
    pg.goto(U+"/data"); pg.wait_for_selector("text=Match a bank statement")
    csv=tempfile.NamedTemporaryFile("w",suffix=".csv",delete=False); csv.write("Date,Narration,Credit\n2026-10-10,NEFT 7001 Acme,220.00\n2026-10-11,Unknown,5.00\n"); csv.close()
    pg.set_input_files("input[aria-label='Bank statement CSV']",csv.name); pg.click("button:text-is('Check statement')"); pg.wait_for_selector("text=match an invoice")
    check(pg.locator(".badge.recon-matched").count()==1,"the statement line is matched to the invoice")
    pg.click("button:has-text('Record 1 payment')"); pg.wait_for_timeout(1200)
    d=call('GET','/api/documents?kind=invoice')
    inv=[x for x in d['items'] if x['fullNumber']=='7001'][0]
    check(inv['status']=='paid',"confirming records the payment and the invoice is paid (status %s)"%inv['status'])
    print("console errors:",errs)
    b.close()
print("ALL PASSED" if all(ok) else "SOME FAILED")
sys.exit(0 if all(ok) else 1)
