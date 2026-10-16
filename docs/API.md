# API

Mavri's backend is one Go program (`server/`). It serves the web app, a JSON REST API, signed store webhooks and, as a separate program, an MCP server.

## Basics

- **Authentication.** The web app uses a session cookie. Scripts use an API key made in **Settings → API keys**: `Authorization: Bearer mvr_…`. Keys can do everything except what needs a person at the keyboard: managing keys, backups and restores, sending email, webhooks, CSV import, and the email, payment and backup settings. The full description is in [OpenAPI](../server/internal/web/openapi.yaml), also served at `/api/openapi.yaml`.
- **Success** returns the resource as JSON (`204` with no body for deletes and logout, `201` for creates).
- **Failure** returns `{"error": {"code": "...", "message": "..."}}` with a matching status: `400 validation`, `401 unauthorized`, `403 forbidden`, `404 not_found`, `409 conflict` (in use or duplicate), `422 einvoice_incomplete`, `423 locked`, `429 rate_limited`.
- **Money** is always whole minor units (cents) in fields ending in `Cents`; a currency's `decimals` says how many decimals the major unit has. Dates are `YYYY-MM-DD`.

## Orders from other systems

### `POST /api/v1/orders`

Creates an invoice from an order. Idempotent per store connection and `externalOrderId`: a repeat returns the same invoice with `duplicate: true` (status `200`; the first delivery is `201`). `shopId` is a store connection (Stores page, or the `create_shop` MCP tool); it supplies the business, currency, bank account, style and default tax.

```bash
curl -X POST http://localhost:3001/api/v1/orders \
  -H "Authorization: Bearer $KEY" -H "Content-Type: application/json" \
  -d '{
    "shopId": 1,
    "externalOrderId": "ORD-1001",
    "customer": { "name": "Acme Ltd", "email": "billing@acme.test", "address": "1 Main St\n12345 Town", "country": "DE" },
    "lineItems": [{ "name": "Consulting", "quantity": 2, "unitPriceMajor": 150.0 }],
    "shippingMajor": 0,
    "taxRatePercent": 19,
    "notes": "Thanks!",
    "paid": true
  }'
```

Add `?dryRun=1` to see what the order would become without writing anything: the customer (found or created), the lines, totals and warnings such as tax that would be charged twice because the store already collected it. The preview also says whether the order id was already turned into an invoice.

Reply: `{ "documentId": 42, "duplicate": false }`. A customer with the same email is reused. If the connection has _record a payment when paid_ switched on and `paid` is true, the invoice is created paid.

### Webhooks

Stores post orders to `POST /api/hooks/{platform}/{shopId}` where platform is `shopify`, `woocommerce` or `generic`. The raw body must be signed with the connection's secret (HMAC-SHA256):

| Platform      | Header                   | Encoding | Body                                                 |
| ------------- | ------------------------ | -------- | ---------------------------------------------------- |
| `shopify`     | `X-Shopify-Hmac-Sha256`  | base64   | Shopify order JSON                                   |
| `woocommerce` | `X-WC-Webhook-Signature` | base64   | WooCommerce order JSON                               |
| `generic`     | `X-Webhook-Signature`    | hex      | the same JSON as `/api/v1/orders` (without `shopId`) |

A wrong signature is `401`, a paused connection `403`. Requests are limited to 120 a minute per connection.

## Documents

Invoices and quotes (`kind` is `invoice` or `quote`).

| Route                                                                      |                                                                                                                |
| -------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------- |
| `GET /api/documents?kind=&status=&q=&customerId=&from=&to=&limit=&offset=` | Summaries, newest first: `{ items, total, limit, offset }`. `q` searches the number and the customer's name.   |
| `POST /api/documents`                                                      | Create. Body is a document (below). The number is filled in if you leave it out.                               |
| `GET /api/documents/{id}`                                                  | One document with lines, payments, totals and the copies saved with it.                                        |
| `PUT /api/documents/{id}`                                                  | Replace the contents. Copies of the business, customer and bank details are kept unless you pass `?refresh=1`. |
| `DELETE /api/documents/{id}`                                               | Delete.                                                                                                        |
| `POST /api/documents/{id}/duplicate`                                       | Copy with the next number and today's date.                                                                    |
| `POST /api/documents/{id}/convert`                                         | Turn a quote into an invoice; the quote becomes `accepted`.                                                    |
| `GET /api/documents/{id}/einvoice?format=ubl\|xrechnung`                   | UBL 2.1 (Peppol BIS 3.0) or XRechnung 3.0 XML. `422` lists what is missing in `error.problems`.                |
| `GET /api/documents/next-number?kind=&issuerId=`                           | The number the next document would get.                                                                        |
| `GET /api/v1/documents`, `GET /api/v1/documents/{id}`                      | The same list and read routes, under the stable public path.                                                   |

A document:

```json
{
  "kind": "invoice",
  "issuerId": 1,
  "customerId": 3,
  "currencyId": 1,
  "bankId": null,
  "styleId": null,
  "number": "",
  "numberPrefix": "INV-",
  "numberSuffix": "",
  "issuedOn": "2026-10-12",
  "dueOn": "2026-11-11",
  "lines": [
    { "name": "Consulting", "unit": "hour", "quantity": 2, "unitCents": 15000, "taxRate": 19, "taxMode": "add" }
  ],
  "discount": { "mode": "percent", "percent": 10, "cents": 0 },
  "surcharge": { "mode": "", "percent": 0, "cents": 0 },
  "shippingCents": 500,
  "taxRate": 0,
  "taxMode": "",
  "payments": [{ "amountCents": 10000, "paidOn": "2026-10-20", "method": "bank", "note": "" }],
  "noteCustomer": "",
  "noteTerms": "",
  "noteThanks": ""
}
```

- Line `taxMode`: `add` (tax on top), `included` (price already has it) or empty. Document `taxMode`: `add`, `included`, `withheld` (tax deducted at source) or empty.
- Calculation order: line amounts, per-line tax, discount and surcharge on the sum of lines without tax, document tax on that base, then shipping. Half cents round away from zero.
- Invoice `status` follows the payments (`unpaid`, `partial`, `paid`) unless you set `void`. Quotes are `open`, `accepted` or `declined`.
- The response adds `fullNumber`, `totals` (`subtotalCents`, `discountCents`, `surchargeCents`, `shippingCents`, `taxCents`, `totalCents`), `paidCents`, and the `issuer`, `customer`, `currency`, `bank` and `style` as they were when saved.
- Numbers are unique per business, kind, prefix and suffix.

## Records

Each is `GET` (list), `POST`, `GET /{id}`, `PUT /{id}`, `DELETE /{id}`. Deleting a record that documents use gives `409`; set `archived: true` instead.

| Path                                 | Record                                                                                                                                                                        |
| ------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `/api/parties?kind=issuer\|customer` | Businesses and customers: `name`, `email`, `phone`, `address`, `taxId`, `country`, `eScheme`, `eAddress`, `buyerReference`, `taxExempt`, `note`, `logo` (base64), `logoType`. |
| `/api/products`                      | `name`, `description`, `priceCents`, `categoryId`, `unitId`.                                                                                                                  |
| `/api/groups?kind=category\|unit`    | Categories and units.                                                                                                                                                         |
| `/api/currencies`                    | `code`, `symbol`, `name`, `pattern` (e.g. `{symbol}{amount}`), `decimals`.                                                                                                    |
| `/api/banks`                         | Bank accounts.                                                                                                                                                                |
| `/api/styles`, `/api/presets`        | Saved looks and starting points.                                                                                                                                              |

## Other routes

| Route                                                                            |                                                                                                                                                                                                                                                                    |
| -------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `GET`, `PUT /api/settings`                                                       | Numbering prefixes and feature switches.                                                                                                                                                                                                                           |
| `GET /api/reports/year?year=2026`                                                | Billed and paid by month and by customer.                                                                                                                                                                                                                          |
| `GET /api/backup`, `POST /api/backup`                                            | Download everything as one gzip file; restore from one (multipart field `file`, and `passphrase` if it is encrypted). Accounts, keys, store connections, webhook endpoints and the email, backup and payment settings are not part of a backup; see Backups below. |
| `GET`, `POST /api/shops`, `POST /api/shops/{id}/pause`, `DELETE /api/shops/{id}` | Store connections. Creating one returns its signing `secret` once.                                                                                                                                                                                                 |
| `GET`, `POST /api/keys`, `DELETE /api/keys/{id}`                                 | API keys. The `secret` is returned once.                                                                                                                                                                                                                           |
| `GET`, `POST /api/setup`; `POST`, `GET`, `DELETE /api/session`                   | First-run setup, sign in, current user, sign out.                                                                                                                                                                                                                  |
| `GET /api/health`, `GET /api/version`                                            | Liveness and version.                                                                                                                                                                                                                                              |

## Sharing, email and the client link

| Route                                                                      |                                                                                                                                                                                                             |
| -------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `POST`, `GET`, `DELETE /api/documents/{id}/share`                          | Create, read or revoke the secure link of a document. The link is `<public address>/d/<token>`.                                                                                                             |
| `POST /api/documents/{id}/email/preview`, `POST /api/documents/{id}/email` | Render, then send, the email for a document (`kind` is `send` or `reminder`). Sending needs a person. Placeholders: `{{customer}} {{number}} {{total}} {{balance}} {{due}} {{when}} {{link}} {{business}}`. |
| `POST /api/documents/bulk`                                                 | `{ids, action}` with action `email`, `remind`, `paid` or `void` (up to 200). Answers one result per document.                                                                                               |
| `GET /api/public/documents/{token}`                                        | What the client sees. No sign-in.                                                                                                                                                                           |
| `GET /api/public/documents/{token}/options`                                | `{pay, payAmount, einvoice}`.                                                                                                                                                                               |
| `POST /api/public/documents/{token}/respond`                               | `{action: accept\|decline, message}` for a quote. For an invoice: `{action: dispute, message}` or `{action: promise, date, message}`, which record a follow-up for the sender (see Collections).            |
| `GET /api/public/documents/{token}/payment-options`                        | How the client can pay: UPI, SEPA and bank details, with the QR payload.                                                                                                                                    |
| `POST /api/public/documents/{token}/pay`                                   | Starts a Stripe Checkout for the balance; answers `{url}`.                                                                                                                                                  |
| `GET /api/public/documents/{token}/einvoice?format=ubl\|xrechnung`         | The e-invoice XML.                                                                                                                                                                                          |
| `POST /api/hooks/stripe`                                                   | Stripe's signed webhook (see below).                                                                                                                                                                        |

Public routes are rate limited, send `Referrer-Policy: no-referrer` and `X-Robots-Tag: noindex`, and answer `404` for a link that does not exist or was revoked.

## Payment options and QR codes

`GET /api/documents/{id}/payment-options` lists how a client can pay what is still owed: **UPI** (the bank account has a UPI ID and the invoice is in INR), **SEPA** (the account number is a valid IBAN and the invoice is in EUR) and a plain **bank transfer**. UPI and SEPA options carry a `payload`, the exact text to encode in a QR code (a `upi://pay` link, or an EPC "BCD" credit-transfer payload); every option also carries the same details as `lines` for people who cannot scan, and a `reference` to quote. The amount is the remaining balance. A payment QR code only opens the client's banking app: scanning it never marks an invoice paid, and it is not the signed e-invoice QR code some tax authorities require. Record the payment when the money arrives.

## Collections

| Route                                        |                                                                                                                                                                                                                                                |
| -------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `GET /api/attention`                         | The daily list: unpaid invoices that are disputed, past a promised date, with a failed email, overdue, due within 7 days, part paid or promised, most urgent first, each with a suggested next step. Paused invoices are left out and counted. |
| `GET`, `POST /api/documents/{id}/follow-ups` | What was agreed with the client: `{kind: promise\|dispute\|snooze\|note, dueOn, amountCents, note}`. A dispute, a pause, or a promise that is not due yet stops automatic reminders for that invoice.                                          |
| `POST /api/follow-ups/{id}/resolve`          | Close a follow-up (a dispute settled, a pause ended).                                                                                                                                                                                          |

Mavri never adds late fees or interest, and the list sends nothing by itself.

## Tax guidance

Guidance, not advice: Mavri never applies a rate on its own and does not file anything.

| Route                                   |                                                                                                                                                                                                                                                                                                                                                |
| --------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `GET /api/tax/packs?date=YYYY-MM-DD`    | The packs (India GST, UK VAT, EU VAT, UAE VAT, US sales tax) with status, source, version, owner, whether a person has reviewed them (`reviewedOn`), what they cover and what they do not, and the rates in force on that date.                                                                                                                |
| `POST /api/tax/explain`                 | `{issuerCountry, issuerTaxId, customerCountry, customerTaxId, customerTaxExempt, date}`. Answers the usual treatment (for example `intra_state`, `inter_state`, `reverse_charge`, `export`), a `trace` of the facts used, `missing` facts, `decisions` for a person, `warnings`, `suggested` rates and, for India, the CGST/SGST/IGST `split`. |
| `GET /api/tax/validate?country=IN&id=…` | Reads a tax number: GSTIN (structure and check character, with the state), UK VAT (check digits), EU VAT (shape per member state), UAE TRN and US EIN (shape). `level` says what was checked; a valid number is not proof of registration.                                                                                                     |

Rates carry the dates they apply, so a document dated before a change uses the rates of that day. No pack is marked reviewed until a person has checked it against its official source (see `taxpack` in the server source for the owner, source and version of each).

## Online payments

Set up in **Automation → Online payments (Stripe)**, or `PUT /api/payments/config` (`{enabled, secretKey, webhookSecret}`; secrets are never returned). Point a Stripe webhook at `/api/hooks/stripe` for `checkout.session.completed`, `checkout.session.async_payment_succeeded`, `checkout.session.async_payment_failed` and `payment_intent.payment_failed`. Mavri verifies the `Stripe-Signature` header (HMAC-SHA256, 5 minute tolerance), applies each event once, checks the currency, adds a payment (method `card (Stripe)`) and emits `payment.recorded` and, if the invoice is now paid, `invoice.paid`. A failed payment emits `payment.failed`.

## Automation

| Route                                                             |                                                                                                            |
| ----------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------- |
| `GET`, `PUT /api/automation`                                      | Reminder days (`remindBefore`, `remindOnDue`, `remindAfter`), the quote rule and the public address.       |
| `GET`, `PUT /api/mail/config`, `POST /api/mail/test`              | SMTP settings (password never returned) and a test message.                                                |
| `GET /api/mail/log`, `GET /api/documents/{id}/mail`               | Delivery log.                                                                                              |
| `GET`, `POST /api/recurring`, `PUT`, `DELETE /api/recurring/{id}` | Recurring invoices: `{documentId, every: week\|month\|quarter\|year, interval, startOn, endOn, autoSend}`. |
| `POST /api/recurring/preview`, `GET /api/recurring/{id}/preview`  | The next dates and the invoice that is copied.                                                             |
| `GET /api/overdue`                                                | Unpaid invoices past their due date.                                                                       |

## Activity history

`GET /api/activity` (filters `source`, `entity`, `entityId`, `q`, `from`, `to`, `limit`, `offset`) and `GET /api/activity.csv`. Each entry has `actor` and `source`: `ui`, `api`, `mcp`, `public`, `webhook` or `system`.

## Webhooks from Mavri

Create endpoints in **Integrations** or with `POST /api/webhooks` (`{url, description, events}`). The response has the signing secret, once. Events: `invoice.created`, `invoice.updated`, `invoice.paid`, `invoice.voided`, `invoice.deleted`, `quote.created`, `quote.updated`, `quote.accepted`, `quote.declined`, `quote.deleted`, `payment.recorded`, `payment.failed`, `document.shared`, `document.viewed`, `document.emailed`, `reminder.sent`, `email.failed`, `payment.promised`, `dispute.opened`, `dispute.resolved`, `customer.created`, `customer.updated`, `backup.completed`, `backup.failed`.

Each delivery is a `POST` with the JSON body `{"id": "evt_…", "type": "invoice.paid", "createdAt": "…", "data": {…}}` and the headers `Mavri-Event`, `Mavri-Event-Id`, `Mavri-Delivery` and `Mavri-Signature: t=<unix>,v1=<hex>`, where `v1` is `HMAC-SHA256(secret, "<t>.<raw body>")`. Check it, and reject deliveries whose `t` is more than a few minutes old. Any non-2xx answer (or a redirect) is retried after 1 minute, 5 minutes, 30 minutes, 2 hours and 6 hours, then marked failed. `GET /api/webhooks/deliveries` is the log and `POST /api/webhooks/deliveries/{id}/replay` sends one again with the same event id, so receivers can ignore duplicates. `POST /api/webhooks/{id}/test` sends a `ping`.

## CSV and backups

| Route                                                                                                        |                                                                                                                                                                                                                                                                                                       |
| ------------------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `GET /api/export/{customers\|products\|invoices\|payments}.csv`                                              | UTF-8 CSV with amounts in major units; add `ids=1,2,3` to `invoices` or `payments` for a selection. Cells that start like a formula are neutralised.                                                                                                                                                  |
| `GET /api/export/documents.json`                                                                             | Every invoice and quote exactly as the API returns it, with the business, customer, bank, currency and style as saved. For leaving Mavri without loss.                                                                                                                                                |
| `POST /api/import/{customers\|products\|invoices}?dryRun=1`                                                  | Multipart `file`. The report lists every problem row with its line number. Without `dryRun` the valid rows are imported. Invoices: one row per line item, rows with the same number are one invoice; one bad row skips that invoice; a number that already exists is skipped, so a re-import is safe. |
| `GET /api/backups`, `PUT /api/backups/config`                                                                | Schedule, retention, encryption passphrase and S3 destination; status, history and what a backup includes.                                                                                                                                                                                            |
| `POST /api/backups/run`, `POST /api/backups/test-s3`, `GET /api/backups/s3`, `GET /api/backups/files/{name}` | Back up now, test the bucket, list and download copies.                                                                                                                                                                                                                                               |
| `POST /api/backups/verify`, `POST /api/backups/restore?confirm=replace`                                      | Open a copy and count what it holds; replace the data with it (a safety copy is made first). Body: a multipart `file` (and `passphrase`) or `{source: local\|s3, name, passphrase}`.                                                                                                                  |
| `GET /api/admin/health`                                                                                      | Database check, sizes, backup age, webhook and email failures, recent errors.                                                                                                                                                                                                                         |

Backups are gzip JSON; encrypted ones are `MAVRIBK1` + salt + nonce + AES-256-GCM (key from the passphrase with PBKDF2-SHA256, 210,000 rounds). S3 uploads are signed with Signature Version 4.

## Examples

```bash
# unpaid invoices
curl -H "Authorization: Bearer $KEY" "$BASE/api/v1/documents?kind=invoice&status=unpaid"

# create an invoice (amounts in minor units)
curl -X POST "$BASE/api/documents" -H "Authorization: Bearer $KEY" -H "Content-Type: application/json" \
  -d '{"kind":"invoice","issuerId":1,"customerId":2,"currencyId":1,"issuedOn":"2026-11-01","lines":[{"name":"Consulting","quantity":3,"unitCents":15000}]}'
```

```js
// verify a Mavri webhook (Node.js)
import { createHmac, timingSafeEqual } from 'node:crypto';
function verify(rawBody, header, secret) {
  const p = Object.fromEntries(header.split(',').map(x => x.split('=')));
  const expected = createHmac('sha256', secret)
    .update(p.t + '.' + rawBody)
    .digest('hex');
  return Math.abs(Date.now() / 1000 - p.t) < 300 && timingSafeEqual(Buffer.from(expected), Buffer.from(p.v1));
}
```

## MCP

`mavri-mcp` is a stdio MCP server. Set `MAVRI_API_KEY` (a key from Settings), `DB_DIRECTORY`, `DB_FILE` and, if you pinned one, `ENCRYPTION_KEY`, the same as the server. Tools: `list_documents`, `get_document`, `create_document`, `record_payment`, `set_document_status`, `duplicate_document`, `convert_quote`, `delete_document`, `export_einvoice`, `year_report`, `overdue_summary`, `send_document`, `share_document`, `list_activity`, `list_/create_/update_/delete_` for `customer` and `issuer`, `list_products`, `create_product`, `list_currencies`, `list_shops`, `create_shop`, `pause_shop` and `create_invoice_from_order`, and for drafting and collections `preview_document`, `tax_guidance`, `payment_options`, `needs_attention` and `add_follow_up`. Amounts in tool arguments are in major units (12.50), results are in minor units.

**Approval.** Actions with consequences outside Mavri or that cannot be undone change nothing until the user has approved them: `send_document`, `share_document`, `record_payment`, `delete_document`, `add_follow_up` (it decides whether reminders go out) and `set_document_status` with `void`. `preview_document` works out the totals of an invoice exactly as `create_document` would, without saving a document or a customer, so the figures can be agreed first; `tax_guidance`, `payment_options` and `needs_attention` only read. The assistant cannot change a tax registration, send money or submit anything to a tax authority. Called without `confirm: true` they return `{"status": "approval_required", "preview": …}` describing exactly what would happen; the assistant is told to show it to the user and only repeat the call with `confirm: true` after an explicit yes. Everything the MCP server changes is recorded in the activity history with source `mcp`, and its events reach webhooks. `send_document` and `share_document` need the public address to be set in Automation.
