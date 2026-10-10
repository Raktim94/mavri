# External API (v1)

Lets other systems (store backends, Zapier/n8n, ERPs) create and fetch invoices.
Authenticate every request with an API key created in the app:

```
Authorization: Bearer <api-key>
```

## Create an invoice from an order — `POST /api/v1/orders`

Idempotent on `externalOrderId` per integration (retries return the existing invoice with `deduplicated: true`).
`integrationId` refers to a connected integration (Integrations page, or the `create_ecommerce_integration` MCP tool), which supplies business, currency, bank and layout.

```bash
curl -X POST http://localhost:1995/api/v1/orders \
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

Response `201`: `{ "success": true, "data": { "invoiceId": 42 } }`

## Fetch

- `GET /api/v1/invoices` — summaries. Query: `type` (`invoice|quotation`), `clientId`, `status` (`open|unpaid|closed|partially|paid`), `search` (invoice number or client name), `from`, `to` (ISO dates on issue date), `limit` (default 50, max 200), `offset`. Returns `{ total, limit, offset, items }`.
- `GET /api/v1/invoices/:id` — full detail incl. items, snapshots and payments.

## MCP

The MCP server (`npm run` script in `package.json`, `src/backend/mcp`) exposes the same operations to AI agents: `list_invoices` (search + pagination), `get_invoice`, `create_invoice`, `create_invoice_from_order`, `record_payment`, and more.
