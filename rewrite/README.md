# Mavri Go backend (rewrite)

A new backend written in Go. The TypeScript backend in `src/backend/` stays the
active application until every row in
[`docs/rewrite/PARITY_MATRIX.md`](../docs/rewrite/PARITY_MATRIX.md) is proven.
The React/TypeScript renderer and Electron shell are unchanged.

The Go code is written fresh against the behaviour recorded in the matrix, not
translated line by line. The project still builds on the upstream Invoice
Builder project, so the repository `LICENSE` and attribution in the root
`README.md` stay in place.

## Layout

| Path | Purpose |
|---|---|
| `cmd/server` | HTTP server entry point, graceful shutdown |
| `internal/config` | Environment settings (same variable names as the TS server) |
| `internal/httpx` | Response envelope, security headers, CORS, body limit, rate limiter |
| `internal/api` | Route wiring, `/api/auth/*`, the database chooser (`/api/databases`, which can switch the open SQLite file at runtime) and the resource handlers |
| `internal/schema` | `baseline.sql`: full schema and seed rows after TS migration 32, applied to an empty database; existing databases are only checked. Verified both ways: the TS server opens a Go-created database and logs in the Go-created account (in dev mode it records its own `.ts` migration names, which is harmless) |
| `internal/store` | Persistence interface for users, API keys and sessions, plus an in-memory version for tests. `sqlitestore` is the SQLite version (same tables as the TS backend); PostgreSQL is still to do. Both pass one shared contract test (`storetest`) |
| `internal/scrypt` | scrypt (RFC 7914), standard library only, checked against Node |
| `internal/auth` | Password hashing, API-key secrets, password policy, lockout rules |
| `internal/money` | Exact (rational) invoice arithmetic, differential-tested against the real TS functions |
| `internal/gst` | India GST: identifiers, Rule 46 checks, effective-dated rules, tax calculation (no built-in rates) |
| `internal/upi` | UPI payment links and payment state machine (trusted evidence only) |
| `internal/billing` | Terms, aging, late fees, allocation, lifecycle, credit notes, numbering, recurring, reminders, quotes, statements, FX records |
| `internal/rbac` | Roles, permissions, approval thresholds |
| `internal/audit` | Tamper-evident hash-chained audit log |
| `internal/secrets` | AES-256-GCM for webhook secrets, readable by values the TS server wrote |
| `internal/orders` | Store integrations, order normalisation (Shopify, WooCommerce, generic), order ledger, order to invoice |
| `internal/transfer` | Whole-database JSON export and import (all or nothing) |
| `internal/invoices` | Invoice service: read with everything attached, save/update with snapshots, items, payments and attachments in one transaction, duplicate and quotation conversion, numbering |
| `internal/entity` | Generic list/create/update/delete/batch engine for the simple resources (banks, businesses, clients, currencies, categories, units, items) |
| `tools/contract` | `run.sh`: starts the TS server and the Go server on copies of one database, runs the same 238-call conversation against both and diffs every response (timestamps and random key secrets masked) |
| `tools/difftest` | Script that generates the TS reference cases (run outside the repo) |
| `internal/ecommerce` | Webhook signature schemes and verification |

## Run and test

Requires Go 1.24 or newer. No Go on your machine? Use a container:

```sh
docker run --rm -v "$PWD":/w -w /w golang:1.24 sh -c 'gofmt -l . && go vet ./... && go test ./...'
```

With Go installed:

```sh
cd rewrite
go vet ./... && go test -race ./...
DEFAULT_DATABASE=invoice.db PORT=3000 go run ./cmd/server   # without DEFAULT_DATABASE the server starts with no database
```

Last verified on 2026-10-11 with `golang:1.24`: `gofmt -l` lists nothing, `go vet ./...` is clean, and `go test ./...` passes in every package that has tests. The `-race` run was not repeated.

## Status

Done and unit-tested: configuration, middleware stack, `/api/health`,
`/api/version`, `/api/databases/ready`; password and API-key hashing (existing
hashes verify), password policy, lockout rules and webhook signatures, all
cross-checked against values produced by Node's crypto and the TS code.
Invoice totals, line discounts and tax in exact arithmetic, compared with the
real renderer functions on 1,500 synthetic invoices: identical except where a
line's discount share is exactly n.5 cents (the old float code rounds down,
the exact version rounds up). Which behaviour to keep is an open decision.
GST (India) logic with tests: see the matrix for what is unverified. Rates are
never built in; they come from rules the business loads.
The auth routes and the simple resource routes (banks, businesses,
clients, currencies, categories, units, items) run on SQLite and answer
identically to the TypeScript server, as do settings, the US tax lookups, style profiles, layouts, presets and invoices (create, update, duplicate, convert, delete, numbering), export/import, e-commerce integrations, signed webhooks and the public v1 API: `tools/contract/run.sh` compares 238
responses (status and body) and reports 0 differences. It does not cover rate
limits, response headers, or PostgreSQL.

Known, deliberate differences: a customer's new client gets a two-letter short name derived from their name (the old server tried to store the whole name, which the column refuses, so most first orders failed), `GET /api/v1/invoices?clientId=` filters by client id (the old server compared it with client names and always came back empty), `GET /api/v1/invoices/:id` returns binary fields as base64 like every other route (the old server leaked Node Buffer JSON), import also clears `invoice_payments` (the old server forgot, so importing over any data that had payments failed with a duplicate id), and a file holding `[]` is refused instead of wiping the database; a saved invoice and its numbering change are one transaction (the old server advanced the counter after committing, so a failure there left an invoice that never took its number); the old server answered an HTML 500 page when an invoice was rejected for a missing snapshot or a bad enum value, Go answers `success:false` with the key (the contract run lists these two); opening a database with mode `create` refuses to overwrite an existing file (the old server deleted it); an empty database name is refused; PostgreSQL answers "not supported"; a field left out of a create request takes the
column default instead of failing on NULL; batch imports decode base64 logos
and QR codes instead of storing the base64 text.

Not started: PostgreSQL, e-invoice XML export (`/api/invoices/xml`), the migrations runner (a fresh database gets the
baseline; later schema changes still need a Go migration mechanism), import/export, MCP, e-commerce
webhooks, desktop bridge.

Not yet verified: that response headers match the TypeScript server byte for
byte. That needs a contract test against a running TS server.

## Dependencies

Only `modernc.org/sqlite` (a pure-Go SQLite driver, no cgo) is pulled in; v1.44.0
is the newest release that builds with Go 1.24. `pgx` is still to be added for
PostgreSQL. Run `go mod tidy` and commit `go.sum` after changing dependencies.
