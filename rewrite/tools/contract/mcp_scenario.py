#!/usr/bin/env python3
"""Drives an MCP server (any command) over stdio with a fixed conversation and
writes every reply to a JSON file.

usage: mcp_scenario.py OUT.json -- command [args...]   (env NODEDR_API_KEY etc. are inherited)
"""
import json, subprocess, sys

out = sys.argv[1]
cmd = sys.argv[sys.argv.index("--") + 1:]
proc = subprocess.Popen(cmd, stdin=subprocess.PIPE, stdout=subprocess.PIPE, stderr=subprocess.DEVNULL, text=True, bufsize=1)
log, next_id = [], [0]

def rpc(method, params=None):
    next_id[0] += 1
    msg = {"jsonrpc": "2.0", "id": next_id[0], "method": method}
    if params is not None: msg["params"] = params
    proc.stdin.write(json.dumps(msg) + "\n"); proc.stdin.flush()
    # The TypeScript server prints "Database opened successfully." on stdout,
    # which is not protocol; skip anything that is not a JSON object.
    while True:
        line = proc.stdout.readline()
        if not line: raise SystemExit("server closed its output")
        try:
            reply = json.loads(line)
            if isinstance(reply, dict): break
        except ValueError:
            continue
    log.append({"method": method, "params": params, "reply": reply})
    return reply

def tool(tool_name, /, **args):
    reply = rpc("tools/call", {"name": tool_name, "arguments": args})
    res = reply.get("result", {})
    text = res.get("content", [{}])[0].get("text")
    try: return json.loads(text) if text else None
    except ValueError: return text

rpc("initialize", {"protocolVersion": "2025-03-26", "capabilities": {}, "clientInfo": {"name": "contract", "version": "1"}})
proc.stdin.write(json.dumps({"jsonrpc": "2.0", "method": "notifications/initialized"}) + "\n"); proc.stdin.flush()
rpc("tools/list")
rpc("ping")

tool("list_clients")
c = tool("create_client", name="Acme Corp", shortName="AC", email="a@acme.test", phone="555", address="1 Main", vatCode="V1", countryCode="US")
tool("create_client", name="Too long", shortName="LONG")                  # schema rejects
tool("create_client", name="Exempt Org", shortName="EX", taxExempt=True)
tool("get_client", id=c["id"] if isinstance(c, dict) else 1)
tool("get_client", id=9999)
tool("update_client", id=1, name="Acme Corp 2", shortName="A2", isArchived=False)
tool("list_clients", includeArchived=True)
tool("list_items")
tool("create_item", name="Widget", amount="1999")
tool("create_item", name="Gizmo", amount="500", unitId=1, categoryId=1, description="d")
tool("update_item", id=2, name="Gizmo 2", amount="550", isArchived=False)
tool("list_items")
tool("list_us_sales_tax_rates")
tool("list_invoices")
inv = tool("create_invoice", businessId=1, clientId=1, currencyId=1, dueDate="2026-12-31", customerNotes="hi", usSalesTaxState="ca", discountPercent=5,
           shippingFeeCents="250", items=[{"itemId": 1, "quantity": "2"}, {"itemId": 2, "quantity": "1", "unitPriceCentsOverride": "600", "taxRate": 8, "taxType": "inclusive"}])
tool("create_invoice", invoiceType="quotation", businessId=1, clientId=2, currencyId=1, taxName="VAT", taxRate=20, taxType="deducted", items=[{"itemId": 1}])
tool("create_invoice", businessId=1, clientId=99, currencyId=1, items=[{"itemId": 1}])
tool("create_invoice", businessId=1, clientId=1, currencyId=1, items=[{"itemId": 77}])
tool("create_invoice", businessId=1, clientId=1, currencyId=1, items=[])
tool("list_invoices", status="unpaid", search="acme")
tool("list_invoices", invoiceType="quotation")
tool("get_invoice", id=1)
tool("get_invoice", id=999)
tool("record_payment", invoiceId=1, amountCents="500", paymentMethod="card", paidAt="2026-10-01 10:00:00", notes="deposit")
tool("record_payment", invoiceId=1, amountCents="100", paymentMethod="cash", paidAt="2026-10-02 10:00:00")
tool("record_payment", invoiceId=999, amountCents="100", paymentMethod="cash")
tool("update_invoice_status", id=1, status="partially")
tool("update_invoice_status", id=1, status="paid")
tool("update_invoice_status", id=999, status="paid")
tool("list_invoices", status="paid")
tool("delete_invoice", id=2)
tool("delete_client", id=1)                                               # still has an invoice: refused
tool("delete_client", id=2)
tool("delete_item", id=2)
tool("list_ecommerce_integrations")
integ = tool("create_ecommerce_integration", name=" Shop ", platform="generic", businessId=1, currencyId=1, defaultTaxRate=5)
tool("create_ecommerce_integration", name="Bad", platform="generic", businessId=99, currencyId=1)
tool("create_ecommerce_integration", name="Bad", platform="magento", businessId=1, currencyId=1)
tool("list_ecommerce_integrations")
order = dict(integrationId=1, externalOrderId="M-1", customerName="Zo", customerEmail="zo@x.test", customerPhone="1", customerAddress="1 St", customerCountryCode="US",
             lineItems=[{"name": "Widget", "quantity": 2, "unitPriceMajor": 12.5}], shippingMajor=5, taxRatePercent=8, notes="n")
tool("create_invoice_from_order", **order)
tool("create_invoice_from_order", **order)
tool("create_invoice_from_order", **{**order, "externalOrderId": "M-2", "integrationId": 99})
tool("deactivate_ecommerce_integration", id=1)
tool("create_invoice_from_order", **{**order, "externalOrderId": "M-3"})
tool("list_invoices")
tool("create_client")                                                       # every missing field is reported
tool("get_client", id="1")
tool("get_client", id=None)
tool("create_client", name=5, shortName="A")
tool("create_invoice", businessId=1, clientId=1, currencyId=1, items=[{"quantity": "1"}])
tool("create_invoice", businessId=1, clientId=1, currencyId=1, items=[{"itemId": 1, "taxType": "bogus"}], usSalesTaxState="CAL")
tool("create_invoice", businessId=1, clientId=1, currencyId=1, items=[{"itemId": 1}], usSalesTaxState="C")
tool("list_invoices", limit="x", status="bad")
tool("list_clients", includeArchived="yes", unknownKey=1)
rpc("nope")
rpc("tools/call", {"name": "does_not_exist", "arguments": {}})
proc.stdin.close(); proc.wait(timeout=10)
json.dump(log, open(out, "w"), indent=1)
