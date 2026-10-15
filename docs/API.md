# API

Mavri's backend is one Go program (`server/`). It serves the web app, a JSON REST API, signed store webhooks and, as a separate program, an MCP server.

## Basics

- **Authentication.** The web app uses a session cookie. Scripts use an API key made in **Settings → API keys**: `Authorization: Bearer mvr_…`. Keys can do everything except manage keys and restore backups.
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

Reply: `{ "documentId": 42, "duplicate": false }`. A customer with the same email is reused. If the connection has *record a payment when paid* switched on and `paid` is true, the invoice is created paid.

### Webhooks

Stores post orders to `POST /api/hooks/{platform}/{shopId}` where platform is `shopify`, `woocommerce` or `generic`. The raw body must be signed with the connection's secret (HMAC-SHA256):

| Platform | Header | Encoding | Body |
| --- | --- | --- | --- |
| `shopify` | `X-Shopify-Hmac-Sha256` | base64 | Shopify order JSON |
| `woocommerce` | `X-WC-Webhook-Signature` | base64 | WooCommerce order JSON |
| `generic` | `X-Webhook-Signature` | hex | the same JSON as `/api/v1/orders` (without `shopId`) |

A wrong signature is `401`, a paused connection `403`. Requests are limited to 120 a minute per connection.

## Documents

Invoices and quotes (`kind` is `invoice` or `quote`).

| Route | |
| --- | --- |
| `GET /api/documents?kind=&status=&q=&customerId=&from=&to=&limit=&offset=` | Summaries, newest first: `{ items, total, limit, offset }`. `q` searches the number and the customer's name. |
| `POST /api/documents` | Create. Body is a document (below). The number is filled in if you leave it out. |
| `GET /api/documents/{id}` | One document with lines, payments, totals and the copies saved with it. |
| `PUT /api/documents/{id}` | Replace the contents. Copies of the business, customer and bank details are kept unless you pass `?refresh=1`. |
| `DELETE /api/documents/{id}` | Delete. |
| `POST /api/documents/{id}/duplicate` | Copy with the next number and today's date. |
| `POST /api/documents/{id}/convert` | Turn a quote into an invoice; the quote becomes `accepted`. |
| `GET /api/documents/{id}/einvoice?format=ubl\|xrechnung` | UBL 2.1 (Peppol BIS 3.0) or XRechnung 3.0 XML. `422` lists what is missing in `error.problems`. |
| `GET /api/documents/next-number?kind=&issuerId=` | The number the next document would get. |
| `GET /api/v1/documents`, `GET /api/v1/documents/{id}` | The same list and read routes, under the stable public path. |

A document:

```json
{
  "kind": "invoice",
  "issuerId": 1, "customerId": 3, "currencyId": 1, "bankId": null, "styleId": null,
  "number": "", "numberPrefix": "INV-", "numberSuffix": "",
  "issuedOn": "2026-10-12", "dueOn": "2026-11-11",
  "lines": [{ "name": "Consulting", "unit": "hour", "quantity": 2, "unitCents": 15000, "taxRate": 19, "taxMode": "add" }],
  "discount": { "mode": "percent", "percent": 10, "cents": 0 },
  "surcharge": { "mode": "", "percent": 0, "cents": 0 },
  "shippingCents": 500,
  "taxRate": 0, "taxMode": "",
  "payments": [{ "amountCents": 10000, "paidOn": "2026-10-20", "method": "bank", "note": "" }],
  "noteCustomer": "", "noteTerms": "", "noteThanks": ""
}
```

- Line `taxMode`: `add` (tax on top), `included` (price already has it) or empty. Document `taxMode`: `add`, `included`, `withheld` (tax deducted at source) or empty.
- Calculation order: line amounts, per-line tax, discount and surcharge on the sum of lines without tax, document tax on that base, then shipping. Half cents round away from zero.
- Invoice `status` follows the payments (`unpaid`, `partial`, `paid`) unless you set `void`. Quotes are `open`, `accepted` or `declined`.
- The response adds `fullNumber`, `totals` (`subtotalCents`, `discountCents`, `surchargeCents`, `shippingCents`, `taxCents`, `totalCents`), `paidCents`, and the `issuer`, `customer`, `currency`, `bank` and `style` as they were when saved.
- Numbers are unique per business, kind, prefix and suffix.

## Records

Each is `GET` (list), `POST`, `GET /{id}`, `PUT /{id}`, `DELETE /{id}`. Deleting a record that documents use gives `409`; set `archived: true` instead.

| Path | Record |
| --- | --- |
| `/api/parties?kind=issuer\|customer` | Businesses and customers: `name`, `email`, `phone`, `address`, `taxId`, `country`, `eScheme`, `eAddress`, `buyerReference`, `taxExempt`, `note`, `logo` (base64), `logoType`. |
| `/api/products` | `name`, `description`, `priceCents`, `categoryId`, `unitId`. |
| `/api/groups?kind=category\|unit` | Categories and units. |
| `/api/currencies` | `code`, `symbol`, `name`, `pattern` (e.g. `{symbol}{amount}`), `decimals`. |
| `/api/banks` | Bank accounts. |
| `/api/styles`, `/api/presets` | Saved looks and starting points. |

## Other routes

| Route | |
| --- | --- |
| `GET`, `PUT /api/settings` | Numbering prefixes and feature switches. |
| `GET /api/reports/year?year=2026` | Billed and paid by month and by customer. |
| `GET /api/backup`, `POST /api/backup` | Download everything as one gzip file; restore from one (multipart field `file`). Accounts, keys and store connections are not part of a backup. |
| `GET`, `POST /api/shops`, `POST /api/shops/{id}/pause`, `DELETE /api/shops/{id}` | Store connections. Creating one returns its signing `secret` once. |
| `GET`, `POST /api/keys`, `DELETE /api/keys/{id}` | API keys. The `secret` is returned once. |
| `GET`, `POST /api/setup`; `POST`, `GET`, `DELETE /api/session` | First-run setup, sign in, current user, sign out. |
| `GET /api/health`, `GET /api/version` | Liveness and version. |

## MCP

`mavri-mcp` is a stdio MCP server. Set `MAVRI_API_KEY` (a key from Settings), `DB_DIRECTORY`, `DB_FILE` and, if you pinned one, `ENCRYPTION_KEY`, the same as the server. Tools: `list_documents`, `get_document`, `create_document`, `record_payment`, `set_document_status`, `duplicate_document`, `convert_quote`, `delete_document`, `export_einvoice`, `year_report`, `list_/create_/update_/delete_` for `customer` and `issuer`, `list_products`, `create_product`, `list_currencies`, `list_shops`, `create_shop`, `pause_shop` and `create_invoice_from_order`. Amounts in tool arguments are in major units (12.50), results are in minor units.
