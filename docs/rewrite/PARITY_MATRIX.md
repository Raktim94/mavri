# Mavri backend parity matrix

Generated from the TypeScript backend at commit `1308d57` by an extraction script, so row counts match the source. Every row starts as TODO. A row becomes DONE only when a Go test or a contract comparison against the TS backend passes, not when it compiles.

## 1. REST routes (`/api`)

86 routes extracted from `src/backend/webserver`. All also sit behind the global limiter of 300 requests/min per IP and a 50 MB JSON limit.

| # | Method | Path | Access | Extra limiter | TS source | Go status |
|---|---|---|---|---|---|---|
| 1 | GET | `/api/auth/api-keys` | session or Bearer API key |  | auth.ts | IN PROGRESS: unit-tested, TS contract check pending |
| 2 | POST | `/api/auth/api-keys` | session or Bearer API key |  | auth.ts | IN PROGRESS: unit-tested, TS contract check pending |
| 3 | DELETE | `/api/auth/api-keys/:id` | session or Bearer API key |  | auth.ts | IN PROGRESS: unit-tested, TS contract check pending |
| 4 | POST | `/api/auth/login` | public | 10 / 15 min | auth.ts | IN PROGRESS: unit-tested, TS contract check pending |
| 5 | POST | `/api/auth/logout` | public |  | auth.ts | IN PROGRESS: unit-tested, TS contract check pending |
| 6 | GET | `/api/auth/me` | session or Bearer API key |  | auth.ts | IN PROGRESS: unit-tested, TS contract check pending |
| 7 | POST | `/api/auth/setup` | public | 5 / hour | auth.ts | IN PROGRESS: unit-tested, TS contract check pending |
| 8 | GET | `/api/auth/status` | public |  | auth.ts | IN PROGRESS: unit-tested, TS contract check pending |
| 9 | GET | `/api/banks` | session or Bearer API key |  | banks.ts | TODO |
| 10 | POST | `/api/banks` | session or Bearer API key |  | banks.ts | TODO |
| 11 | PUT | `/api/banks` | session or Bearer API key |  | banks.ts | TODO |
| 12 | DELETE | `/api/banks/:id` | session or Bearer API key |  | banks.ts | TODO |
| 13 | POST | `/api/banks/batch` | session or Bearer API key |  | banks.ts | TODO |
| 14 | GET | `/api/businesses` | session or Bearer API key |  | businesses.ts | TODO |
| 15 | POST | `/api/businesses` | session or Bearer API key |  | businesses.ts | TODO |
| 16 | PUT | `/api/businesses` | session or Bearer API key |  | businesses.ts | TODO |
| 17 | DELETE | `/api/businesses/:id` | session or Bearer API key |  | businesses.ts | TODO |
| 18 | POST | `/api/businesses/batch` | session or Bearer API key |  | businesses.ts | TODO |
| 19 | GET | `/api/categories` | session or Bearer API key |  | categories.ts | TODO |
| 20 | POST | `/api/categories` | session or Bearer API key |  | categories.ts | TODO |
| 21 | PUT | `/api/categories` | session or Bearer API key |  | categories.ts | TODO |
| 22 | DELETE | `/api/categories/:id` | session or Bearer API key |  | categories.ts | TODO |
| 23 | POST | `/api/categories/batch` | session or Bearer API key |  | categories.ts | TODO |
| 24 | GET | `/api/clients` | session or Bearer API key |  | clients.ts | TODO |
| 25 | POST | `/api/clients` | session or Bearer API key |  | clients.ts | TODO |
| 26 | PUT | `/api/clients` | session or Bearer API key |  | clients.ts | TODO |
| 27 | DELETE | `/api/clients/:id` | session or Bearer API key |  | clients.ts | TODO |
| 28 | POST | `/api/clients/batch` | session or Bearer API key |  | clients.ts | TODO |
| 29 | GET | `/api/currencies` | session or Bearer API key |  | currencies.ts | TODO |
| 30 | POST | `/api/currencies` | session or Bearer API key |  | currencies.ts | TODO |
| 31 | PUT | `/api/currencies` | session or Bearer API key |  | currencies.ts | TODO |
| 32 | DELETE | `/api/currencies/:id` | session or Bearer API key |  | currencies.ts | TODO |
| 33 | POST | `/api/currencies/batch` | session or Bearer API key |  | currencies.ts | TODO |
| 34 | GET | `/api/databases` | public until first user exists | listDbLimiter | database.ts | TODO |
| 35 | POST | `/api/databases` | public until first user exists | listDbLimiter | database.ts | TODO |
| 36 | GET | `/api/databases/ready` | public |  | main.ts | IN PROGRESS: unit-tested, TS contract check pending |
| 37 | POST | `/api/databases/test` | public until first user exists | listDbLimiter | database.ts | TODO |
| 38 | GET | `/api/ecommerce/integrations` | session or Bearer API key |  | ecommerceIntegrations.ts | TODO |
| 39 | POST | `/api/ecommerce/integrations` | session or Bearer API key |  | ecommerceIntegrations.ts | TODO |
| 40 | DELETE | `/api/ecommerce/integrations/:id` | session or Bearer API key |  | ecommerceIntegrations.ts | TODO |
| 41 | POST | `/api/ecommerce/integrations/:id/deactivate` | session or Bearer API key |  | ecommerceIntegrations.ts | TODO |
| 42 | GET | `/api/export` | session or Bearer API key |  | importExport.ts | TODO |
| 43 | GET | `/api/health` | public |  | main.ts | IN PROGRESS: unit-tested, TS contract check pending |
| 44 | POST | `/api/import` | session or Bearer API key |  | importExport.ts | TODO |
| 45 | GET | `/api/invoices` | session or Bearer API key |  | invoices.ts | TODO |
| 46 | POST | `/api/invoices` | session or Bearer API key |  | invoices.ts | TODO |
| 47 | PUT | `/api/invoices` | session or Bearer API key |  | invoices.ts | TODO |
| 48 | DELETE | `/api/invoices/:id` | session or Bearer API key |  | invoices.ts | TODO |
| 49 | POST | `/api/invoices/duplicate` | session or Bearer API key |  | invoices.ts | TODO |
| 50 | GET | `/api/invoices/headers` | session or Bearer API key |  | invoices.ts | TODO |
| 51 | GET | `/api/invoices/sequence` | session or Bearer API key |  | invoices.ts | TODO |
| 52 | GET | `/api/invoices/xml` | session or Bearer API key |  | invoices.ts | TODO |
| 53 | GET | `/api/items` | session or Bearer API key |  | items.ts | TODO |
| 54 | POST | `/api/items` | session or Bearer API key |  | items.ts | TODO |
| 55 | PUT | `/api/items` | session or Bearer API key |  | items.ts | TODO |
| 56 | DELETE | `/api/items/:id` | session or Bearer API key |  | items.ts | TODO |
| 57 | POST | `/api/items/batch` | session or Bearer API key |  | items.ts | TODO |
| 58 | GET | `/api/layouts` | session or Bearer API key |  | layouts.ts | TODO |
| 59 | POST | `/api/layouts` | session or Bearer API key |  | layouts.ts | TODO |
| 60 | PUT | `/api/layouts` | session or Bearer API key |  | layouts.ts | TODO |
| 61 | DELETE | `/api/layouts/:id` | session or Bearer API key |  | layouts.ts | TODO |
| 62 | GET | `/api/layouts/export/:id` | session or Bearer API key |  | layouts.ts | TODO |
| 63 | GET | `/api/presets` | session or Bearer API key |  | presets.ts | TODO |
| 64 | POST | `/api/presets` | session or Bearer API key |  | presets.ts | TODO |
| 65 | PUT | `/api/presets` | session or Bearer API key |  | presets.ts | TODO |
| 66 | DELETE | `/api/presets/:id` | session or Bearer API key |  | presets.ts | TODO |
| 67 | POST | `/api/presets/batch` | session or Bearer API key |  | presets.ts | TODO |
| 68 | GET | `/api/settings` | session or Bearer API key |  | settings.ts | TODO |
| 69 | PUT | `/api/settings` | session or Bearer API key |  | settings.ts | TODO |
| 70 | GET | `/api/styleProfiles` | session or Bearer API key |  | styleProfiles.ts | TODO |
| 71 | POST | `/api/styleProfiles` | session or Bearer API key |  | styleProfiles.ts | TODO |
| 72 | PUT | `/api/styleProfiles` | session or Bearer API key |  | styleProfiles.ts | TODO |
| 73 | DELETE | `/api/styleProfiles/:id` | session or Bearer API key |  | styleProfiles.ts | TODO |
| 74 | POST | `/api/styleProfiles/batch` | session or Bearer API key |  | styleProfiles.ts | TODO |
| 75 | GET | `/api/tax/us-states` | session or Bearer API key |  | usSalesTax.ts | TODO |
| 76 | GET | `/api/tax/us-states/:stateCode` | session or Bearer API key |  | usSalesTax.ts | TODO |
| 77 | GET | `/api/units` | session or Bearer API key |  | units.ts | TODO |
| 78 | POST | `/api/units` | session or Bearer API key |  | units.ts | TODO |
| 79 | PUT | `/api/units` | session or Bearer API key |  | units.ts | TODO |
| 80 | DELETE | `/api/units/:id` | session or Bearer API key |  | units.ts | TODO |
| 81 | POST | `/api/units/batch` | session or Bearer API key |  | units.ts | TODO |
| 82 | GET | `/api/v1/invoices` | session or Bearer API key |  | publicApi.ts | TODO |
| 83 | GET | `/api/v1/invoices/:id` | session or Bearer API key |  | publicApi.ts | TODO |
| 84 | POST | `/api/v1/orders` | session or Bearer API key |  | publicApi.ts | TODO |
| 85 | GET | `/api/version` | public |  | main.ts | IN PROGRESS: unit-tested, TS contract check pending |
| 86 | POST | `/api/webhooks/ecommerce/:platform/:integrationId` | public + HMAC signature | 60 / min | ecommerceWebhooks.ts | TODO |

## 2. Electron IPC channels

73 channels. "Electron" rows stay native (dialogs, updater, printing, shell); "Go bridge" rows must call the shared Go services.

| # | Channel | Owner after rewrite | Go status |
|---|---|---|---|
| 1 | `add-bank` | Go bridge | TODO |
| 2 | `add-business` | Go bridge | TODO |
| 3 | `add-category` | Go bridge | TODO |
| 4 | `add-client` | Go bridge | TODO |
| 5 | `add-currency` | Go bridge | TODO |
| 6 | `add-invoice` | Go bridge | TODO |
| 7 | `add-item` | Go bridge | TODO |
| 8 | `add-layout` | Go bridge | TODO |
| 9 | `add-preset` | Go bridge | TODO |
| 10 | `add-styleProfile` | Go bridge | TODO |
| 11 | `add-unit` | Go bridge | TODO |
| 12 | `batch-add-bank` | Go bridge | TODO |
| 13 | `batch-add-business` | Go bridge | TODO |
| 14 | `batch-add-category` | Go bridge | TODO |
| 15 | `batch-add-client` | Go bridge | TODO |
| 16 | `batch-add-currency` | Go bridge | TODO |
| 17 | `batch-add-item` | Go bridge | TODO |
| 18 | `batch-add-preset` | Go bridge | TODO |
| 19 | `batch-add-styleProfile` | Go bridge | TODO |
| 20 | `batch-add-unit` | Go bridge | TODO |
| 21 | `check-for-updates` | Electron (native adapter) | TODO |
| 22 | `delete-bank` | Go bridge | TODO |
| 23 | `delete-business` | Go bridge | TODO |
| 24 | `delete-category` | Go bridge | TODO |
| 25 | `delete-client` | Go bridge | TODO |
| 26 | `delete-currency` | Go bridge | TODO |
| 27 | `delete-invoice` | Go bridge | TODO |
| 28 | `delete-item` | Go bridge | TODO |
| 29 | `delete-layout` | Go bridge | TODO |
| 30 | `delete-preset` | Go bridge | TODO |
| 31 | `delete-styleProfile` | Go bridge | TODO |
| 32 | `delete-unit` | Go bridge | TODO |
| 33 | `duplicate-invoice` | Go bridge | TODO |
| 34 | `export-all-data` | Go bridge | TODO |
| 35 | `export-layout` | Go bridge | TODO |
| 36 | `get-all-banks` | Go bridge | TODO |
| 37 | `get-all-businesses` | Go bridge | TODO |
| 38 | `get-all-categories` | Go bridge | TODO |
| 39 | `get-all-clients` | Go bridge | TODO |
| 40 | `get-all-currencies` | Go bridge | TODO |
| 41 | `get-all-invoices` | Go bridge | TODO |
| 42 | `get-all-items` | Go bridge | TODO |
| 43 | `get-all-layouts` | Go bridge | TODO |
| 44 | `get-all-presets` | Go bridge | TODO |
| 45 | `get-all-settings` | Go bridge | TODO |
| 46 | `get-all-styleProfiles` | Go bridge | TODO |
| 47 | `get-all-units` | Go bridge | TODO |
| 48 | `get-app-version` | Electron (native adapter) | TODO |
| 49 | `get-custom-headers` | Go bridge | TODO |
| 50 | `get-einvoice-xml` | Go bridge | TODO |
| 51 | `get-next-sequence` | Go bridge | TODO |
| 52 | `get-us-sales-tax-rate` | Go bridge | TODO |
| 53 | `get-us-sales-tax-rates` | Go bridge | TODO |
| 54 | `import-all-data` | Go bridge | TODO |
| 55 | `initialize-db` | Go bridge | TODO |
| 56 | `open-url` | Electron (native adapter) | TODO |
| 57 | `print-receipt` | Electron (native adapter) | TODO |
| 58 | `restart-app` | Electron (native adapter) | TODO |
| 59 | `show-open-db-dialog` | Electron (native adapter) | TODO |
| 60 | `show-save-db-dialog` | Electron (native adapter) | TODO |
| 61 | `test-connection` | Go bridge | TODO |
| 62 | `update-bank` | Go bridge | TODO |
| 63 | `update-business` | Go bridge | TODO |
| 64 | `update-category` | Go bridge | TODO |
| 65 | `update-client` | Go bridge | TODO |
| 66 | `update-currency` | Go bridge | TODO |
| 67 | `update-invoice` | Go bridge | TODO |
| 68 | `update-item` | Go bridge | TODO |
| 69 | `update-layout` | Go bridge | TODO |
| 70 | `update-preset` | Go bridge | TODO |
| 71 | `update-settings` | Go bridge | TODO |
| 72 | `update-styleProfile` | Go bridge | TODO |
| 73 | `update-unit` | Go bridge | TODO |

Preload exposes 79 `window.electronAPI` members (including `onUpdate*` event subscriptions and `ping`); every one needs a documented target, checked in slice 9.

## 3. MCP tools (`src/backend/mcp/tools.ts`)

| # | Tool | Go status |
|---|---|---|
| 1 | `list_clients` | TODO |
| 2 | `get_client` | TODO |
| 3 | `create_client` | TODO |
| 4 | `update_client` | TODO |
| 5 | `delete_client` | TODO |
| 6 | `list_items` | TODO |
| 7 | `create_item` | TODO |
| 8 | `update_item` | TODO |
| 9 | `delete_item` | TODO |
| 10 | `list_us_sales_tax_rates` | TODO |
| 11 | `list_invoices` | TODO |
| 12 | `get_invoice` | TODO |
| 13 | `create_invoice` | TODO |
| 14 | `update_invoice_status` | TODO |
| 15 | `record_payment` | TODO |
| 16 | `delete_invoice` | TODO |
| 17 | `list_ecommerce_integrations` | TODO |
| 18 | `create_ecommerce_integration` | TODO |
| 19 | `deactivate_ecommerce_integration` | TODO |
| 20 | `create_invoice_from_order` | TODO |

## 4. Migrations (applied in filename-sort order)

Runner: `shared/db/migrationRunner.ts` matches `^\d{8}-\d{2}-.*`, sorts by filename, runs all pending inside ONE transaction (SQLite foreign keys off for the run), records each name in `migrations`. Go must reproduce the same names and ordering, since existing databases already contain them. Note two files share sequence `21`; filename order, not the number, decides.

| # | File | Go status |
|---|---|---|
| 1 | `20260105-01-invoice_items-quantity-to-text.ts` | TODO |
| 2 | `20260108-02-invoices-prefix-suffix-language.ts` | TODO |
| 3 | `20260108-03-invoices-ghost-data-cleanup.ts` | TODO |
| 4 | `20260122-04-invoices-signature.ts` | TODO |
| 5 | `20260129-05-style_profiles.ts` | TODO |
| 6 | `20260202-06-style_profile-column-renames.ts` | TODO |
| 7 | `20260202-07-snapshot-tables.ts` | TODO |
| 8 | `20260203-08-customize-items-table.ts` | TODO |
| 9 | `20260205-09-invoice_item_snapshots_fix-name.ts` | TODO |
| 10 | `20260206-10-converting-amount-fields.ts` | TODO |
| 11 | `20260209-11-custom-fields-order.ts` | TODO |
| 12 | `20260209-12-banks-table.ts` | TODO |
| 13 | `20260212-13-vat-code-fields.ts` | TODO |
| 14 | `20260218-14-invoice_sequences.ts` | TODO |
| 15 | `20260218-15-customize-font.ts` | TODO |
| 16 | `20260218-16-custom-labels.ts` | TODO |
| 17 | `20260220-17-banks-fields.ts` | TODO |
| 18 | `20260220-18-templates.ts` | TODO |
| 19 | `20260228-19-style_profile-default-font.ts` | TODO |
| 20 | `20260228-20-peppol-fields.ts` | TODO |
| 21 | `20260304-21-xrechnung-fields.ts` | TODO |
| 22 | `20260612-21-paidAt-closedAt.ts` | TODO |
| 23 | `20260810-22-invoice-unique.ts` | TODO |
| 24 | `20260826-23-invoice-surcharge.ts` | TODO |
| 25 | `20260826-24-invoice-unique.ts` | TODO |
| 26 | `20260826-25-invoice-sequence.ts` | TODO |
| 27 | `20260831-26-settings-receipt.ts` | TODO |
| 28 | `20260902-27-invoice_layouts.ts` | TODO |
| 29 | `20260902-28-layout-schema-seeds.ts` | TODO |
| 30 | `20260903-29-style-profiles-layout-id.ts` | TODO |
| 31 | `20260924-30-us-sales-tax.ts` | TODO |
| 32 | `20260924-31-auth.ts` | TODO |
| 33 | `20260927-32-ecommerce-integrations.ts` | TODO |

## 5. Tables seen in schema/migration code

`api_keys`, `attachments`, `banks`, `businesses`, `categories`, `clients`, `currencies`, `ecommerce_integrations`, `ecommerce_orders`, `invoice_bank_snapshots`, `invoice_business_snapshots`, `invoice_client_snapshots`, `invoice_currency_snapshots`, `invoice_customizations`, `invoice_item_snaphots`, `invoice_item_snapshots`, `invoice_item_snapshots_new`, `invoice_items`, `invoice_items_new`, `invoice_layout_snapshots`, `invoice_payments`, `invoice_payments_new`, `invoice_sequences`, `invoice_sequences_new`, `invoice_style_profile_snapshots`, `invoices`, `invoices_new`, `items`, `layouts`, `migrations`, `presets`, `sessions`, `settings`, `style_profiles`, `units`, `us_sales_tax_rates`, `users`

Tables ending in `_new` are temporary rebuild tables inside migrations, not final schema. The final schema must be captured from a database migrated by the TS code, not inferred from this list.

## 6. Behaviors that must match exactly

| Area | Reference behavior (TS) | Go status |
|---|---|---|
| Password hash | `scrypt:N:r:p:salt:hash`, N=16384, r=8, p=1, keylen 64, hex, constant-time compare. Existing hashes must verify | IN PROGRESS: pure logic verified against Node vectors; DB and HTTP wiring pending |
| Lockout | 5 failed attempts, 15 minute lock | IN PROGRESS: pure logic verified against Node vectors; DB and HTTP wiring pending |
| API keys | prefix `ndr_`, 32 random bytes base64url, stored as scrypt hash with fixed salt, 12-char display prefix, last-use tracking | IN PROGRESS: pure logic verified against Node vectors; DB and HTTP wiring pending |
| Sessions | cookie `nodedr.sid`, httpOnly, sameSite lax, 24 h, secure flag from config, stored in DB, secret persisted per db dir | TODO |
| Auth guard | session first, then `Authorization: Bearer`; failure `401 {success:false, key:'error.unauthorized'}` | TODO |
| Rate limits | global 300/min on `/api`; login 10/15 min; setup 5/h; webhooks 60/min; error key `error.rateLimiter` | IN PROGRESS: unit-tested, TS contract check pending |
| Body/proxy | 50 MB JSON, raw body kept for webhooks, `trust proxy` = 1 | IN PROGRESS: unit-tested, TS contract check pending |
| Headers/CORS | helmet defaults (CSP off), CORP same-site, HSTS only when cookie secure, CORS with credentials from configured origin | IN PROGRESS: unit-tested, TS contract check pending |
| DB file names | resolved inside the data dir, `..` escapes rejected, only .db/.sqlite/.sqlite3 listed | TODO |
| Webhooks | HMAC-SHA256 over raw bytes, Shopify uses `x-shopify-hmac-sha256` base64, constant-time compare, payload hash for idempotency, secrets `whsec_...` | IN PROGRESS: pure logic verified against Node vectors; DB and HTTP wiring pending |
| Response envelope | `{success, message, data, key}`; error keys like `error.unknownError` must be preserved | TODO |
| Invoice totals | Computed in the renderer (`renderer/shared/utils/invoiceFunctions.ts`) with JS floats on cent values, not in the backend. Go (`internal/money`) is exact. Differs only when a line's discount share is exactly n.5 cents: JS rounds down through float error, Go rounds up (about 0.3% of lines in synthetic data). DECISION NEEDED: keep exact, or emulate the float result | IN PROGRESS |
| E-invoice XML maths | `shared/utils/einvoice/ubl21.ts` and `invoiceFunctions.ts` use their own rounding (`Math.round(n*100)/100`), separate from the renderer. Not yet compared with Go | TODO |
| GST module (new feature) | `internal/gst`: state codes, GSTIN parse, Rule 46 completeness, place-of-supply review, effective-dated rule book, CGST/SGST/UTGST/IGST/cess calculation, bill of supply, reverse charge. No rates are built in; rules must be loaded with a source reference. UNVERIFIED: GSTIN checksum (matches two public samples, not checked against GSTN spec), state codes 96 and 99 (omitted), UTGST territory list, rounding choices (per-line half-up). Needs review by a tax professional before release | IN PROGRESS |
| GST persistence, PDF, e-invoice/IRP | Snapshot storage on invoices, PDF/XML fields, IRN/QR persistence, IRP adapter | TODO |
| UPI (new feature) | `internal/upi`: VPA syntax check (never "verified"), static and per-invoice `upi://pay` links with fixed amount and merchant reference, pre-QR summary, payment state machine where only provider lookup or authenticated webhook evidence can mark paid (amount, currency and reference must match exactly), idempotent event handling, duplicate-payment flagging, refunds, audit trail, provider interface. UNVERIFIED: field length limits (conservative assumptions, confirm against current NPCI linking spec). No provider adapter, QR image rendering, persistence or webhook route yet | IN PROGRESS |
| Enterprise billing rules (new) | `internal/billing`: payment terms (due on receipt, net N, end of month + N, fixed date), early-payment discount, aging per currency, late fees (grace, fixed, simple annual interest, cap), payment allocation (oldest first or chosen order, credit on account), invoice lifecycle (issued invoices immutable, void only before payment), credit notes with reference checks and excess handling, invoice number series with Rule 46 shape and gap detection, recurring schedules without month-end drift, reminder plans that never burst, quote lifecycle and versions, customer statements, FX conversion records with source and effective time. Pure logic with tests. Not wired to storage, routes or screens. Legal enforceability of late fees and the "credited" status naming are product decisions to confirm | IN PROGRESS |
| Roles, approvals, audit log (new) | `internal/rbac`: five least-privilege roles, deny-by-default, approval thresholds per currency (unconfigured currency requires approval), no self-approval option. `internal/audit`: SHA-256 hash-chained activity log that detects edits, deletions and reordering; truncation needs an externally stored head hash. Also `gst.HSNSummary` for HSN/rate-wise totals. Existing TS accounts have a single `role` column; mapping of old roles to these five is undecided. Not yet persisted or enforced in routes | IN PROGRESS |
