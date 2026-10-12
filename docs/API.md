# API

Mavri's backend is one Go program. It serves the web app, a REST API, signed webhooks and (as a separate binary) an MCP server.

## Authentication

- The web app uses a session cookie after sign-in.
- Scripts use an API key made in **Settings → API keys**:

  ```
  Authorization: Bearer <api-key>
  ```

Every reply is JSON shaped `{ "success": true|false, "data": ..., "key": "error.something" }`. Failures carry a translation-style `key`.

## External API (v1)

Lets other systems (stores, Zapier or n8n, ERPs) create and read invoices.

### Create an invoice from an order: `POST /api/v1/orders`

Idempotent on `externalOrderId` for each integration: a retry returns the existing invoice with `deduplicated: true`. `integrationId` is a connected integration (Integrations page, or the `create_ecommerce_integration` MCP tool). It supplies the business, currency, bank and style.

```bash
curl -X POST http://localhost:3001/api/v1/orders \
  -H "Authorization: Bearer $KEY" -H "Content-Type: application/json" \
  -d '{
    "integrationId": 1,
    "externalOrderId": "ORD-1001",
    "customer": { "name": "Acme Ltd", "email": "billing@acme.test" },
    "lineItems": [{ "name": "Consulting", "quantity": 2, "unitPriceMajor": 150.0 }],
    "shippingMajor": 0,
    "taxRatePercent": 18,
    "notes": "Thanks!"
  }'
```

Reply `201`: `{ "success": true, "data": { "invoiceId": 42 } }`

### Read invoices

- `GET /api/v1/invoices`: summaries. Query: `type` (`invoice` or `quotation`), `clientId`, `status` (`open`, `unpaid`, `closed`, `partially`, `paid`), `search` (invoice number or client name), `from` and `to` (ISO dates on the issue date), `limit` (default 50, max 200), `offset`. Returns `{ total, limit, offset, items }`.
- `GET /api/v1/invoices/:id`: full detail with items, snapshots and payments.

## Webhooks

Stores post orders to `POST /api/webhooks/ecommerce/{platform}/{integrationId}`. The platform is `shopify`, `woocommerce` or `generic`. The body must be signed with the integration's secret (HMAC-SHA256 over the exact raw body):

| Platform | Header | Encoding |
| --- | --- | --- |
| Shopify | `X-Shopify-Hmac-Sha256` | base64 |
| WooCommerce | `X-WC-Webhook-Signature` | base64 |
| generic | `X-Webhook-Signature` | hex |

Unsigned or wrongly signed requests are rejected. Requests are rate-limited per integration.

## App API

The web app uses these routes (session or API key):

| Route | Purpose |
| --- | --- |
| `GET/POST/PUT /api/{clients,businesses,items,banks,currencies,categories,units,presets,styleProfiles}`, `DELETE …/{id}` | Records. `GET` takes an optional `filter` JSON array. |
| `GET/POST/PUT /api/invoices`, `DELETE /api/invoices/{id}` | Invoices and quotes (`?type=invoice` or `quotation`) with their snapshots, lines and payments. |
| `POST /api/invoices/duplicate` | Copy an invoice. |
| `GET /api/invoices/sequence` | Next invoice number for a business and client. |
| `GET /api/invoices/xml?invoiceId=&einvoice=ubl21\|xrechnung` | Electronic invoice. |
| `GET/PUT /api/settings` | Settings. |
| `GET /api/export`, `POST /api/import` | Backup (import takes a gzip file in a multipart `file` field). |
| `/api/ecommerce/integrations` | Manage store integrations. |
| `/api/auth/*` | Status, setup, login, logout, current user, API keys. |
| `GET /api/health`, `GET /api/version` | Liveness and version. |

## MCP

The MCP server is a stdio program built from `rewrite/cmd/mcp` (set `NODEDR_API_KEY`, `DB_DIRECTORY` and `DB_FILE`). It gives AI agents the same operations: `list_invoices` (search and pagination), `get_invoice`, `create_invoice`, `create_invoice_from_order`, `record_payment`, `update_invoice_status`, `delete_invoice`, client and item tools (`list_`, `get_`, `create_`, `update_`, `delete_`), `list_ecommerce_integrations`, `create_ecommerce_integration`, `deactivate_ecommerce_integration` and `list_us_sales_tax_rates`.
