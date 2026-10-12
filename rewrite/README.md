# Mavri backend (Go)

The backend of Mavri: REST API, MCP server, SQLite storage, e-commerce webhooks
and e-invoice export, in one Go program that also serves the React app. It
replaced an Express/Electron backend, which has been removed from the
repository (see git history before the commit "remove the Node backend and the
desktop app" if you need it).

It was written to match the behaviour of that backend, not translated line by line.

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
| `internal/einvoice` | UBL 2.1 / XRechnung XML, same float arithmetic and rounding as before; checked byte for byte against 12 documents the TS server wrote (`internal/api/testdata/einvoice`) |
| `internal/jsnum` | JavaScript's `Number()`, number printing, `Math.round` and `toFixed`, which the XML and order handling depend on |
| `internal/mcp`, `cmd/mcp` | MCP server over stdio with the same 20 tools |
| `internal/secrets` | AES-256-GCM for webhook secrets, readable by values the TS server wrote |
| `internal/orders` | Store integrations, order normalisation (Shopify, WooCommerce, generic), order ledger, order to invoice |
| `internal/transfer` | Whole-database JSON export and import (all or nothing) |
| `internal/invoices` | Invoice service: read with everything attached, save/update with snapshots, items, payments and attachments in one transaction, duplicate and quotation conversion, numbering |
| `internal/entity` | Generic list/create/update/delete/batch engine for the simple resources (banks, businesses, clients, currencies, categories, units, items) |
| `tools/e2e` | `run.sh` builds the Docker image and `ui_flow.py` drives the real web app in Chrome against it, failing on any unexpected HTTP, console or page error |
| `internal/ecommerce` | Webhook signature schemes and verification |

## Run

Requires Go 1.24 or newer (or Docker, which needs no Go install).

```sh
cd rewrite
DEFAULT_DATABASE=invoice.db DB_DIRECTORY=data PORT=3000 go run ./cmd/server
```

Without `DEFAULT_DATABASE` the server starts with no database and the app's
database chooser opens one (`/api/databases`). Set `FRONTEND_DIR=../dist-fe`
(after `npm run build` in the repository root) to serve the web app from
the same port. A database written by the Node version opens as is, as long as
that version had applied all its migrations.

One container with the app and the API, about 66 MB:

```sh
docker compose up -d --build      # from the repository root
```

Behind a reverse proxy (nginx, Caddy, a Cloudflare tunnel) set `TRUST_PROXY=1` so
rate limits see the real client address; with clients connecting directly leave
it at `0`, or anyone could dodge the limits with a made-up `X-Forwarded-For`.
(The Docker setup defaults to `0`; the plain binary to `1`, like the Node server.)

The MCP server (stdio, for AI assistants) needs an API key from Settings and an
existing database:

```sh
NODEDR_API_KEY=ndr_... DB_DIRECTORY=data DB_FILE=invoice.db go run ./cmd/mcp
```

## Test

```sh
docker run --rm -v "$PWD":/w -w /w golang:1.24 sh -c 'gofmt -l . && go vet ./... && go test -race ./...'
```

That runs the unit and HTTP tests. The e-invoice XML tests compare against
golden files (`internal/api/testdata/einvoice`) that the original Express server
produced for the same invoices, so the output stays identical to the old one.

`tools/e2e` drives the real web app in Chrome against the server in its Docker
image: it creates the owner account, the records an invoice needs, an invoice,
its PDF preview, a payment, a duplicate, a quote turned into an invoice, a backup
export and re-import, and visits every page, failing on any unexpected HTTP,
console or page error.

```sh
sh tools/e2e/run.sh             # needs docker, python3 + playwright, Google Chrome
```

Before the Express backend was removed, two scripts drove both backends with the
same conversation from copies of one database and compared every reply: 257 REST
responses and 60 MCP replies, no differences (only the places where the old
server crashed and Go answers cleanly). They are in git history.

## Status

**Everything the TypeScript web backend does is implemented**, on SQLite, and the real web app runs on it: all 86
REST routes, the 20 MCP tools, the schema and its 33 migrations (as one
baseline, plus a runner for later changes), sessions, API keys, encrypted
webhook secrets, import/export, e-commerce webhooks and the e-invoice XML.
Each route is covered by Go tests.

Also written but **not yet reachable from any route**, because the old backend
had no equivalent: exact-arithmetic invoice totals (`money`), India GST
(`gst`), UPI payment links (`upi`), billing rules such as terms, late fees,
credit notes and recurring invoices (`billing`), roles and approvals (`rbac`)
and a tamper-evident audit log (`audit`). They are tested as libraries.

**Not done**

- **PostgreSQL.** The server and MCP run on SQLite only; asking for PostgreSQL
  answers "not supported". Supporting it means a second SQL dialect (`pgx`,
  placeholders, `datetime('now')`, grouping rules) and a PostgreSQL store.
- **The desktop app** (Electron) was dropped; Mavri is installed with Docker.
- **Response headers** are not compared with the TypeScript server's (bodies and
  status codes are), nor rate limits.
- **Exact versus float rounding** in `money` is still the open decision from the
  start: the old float code and exact arithmetic differ when a line's discount
  share is exactly n.5 cents (16 of 5,176 compared invoices).

**Where Go deliberately differs.** Each of these was a bug or hazard in the
TypeScript backend, found while comparing:

- A saved invoice and its numbering change are one transaction. The old server
  advanced the counter after committing, so a failure left an invoice that
  never took its number.
- Duplicating an invoice id that does not exist left the old server's database
  connection inside an open transaction; every later write was then silently
  rolled back. Go answers `{"success":false}` and changes nothing.
- An invoice rejected for a missing snapshot or a bad enum value made the old
  server answer an HTML 500 page; Go answers `success:false` with the key.
- Import also clears `invoice_payments` (the old server forgot, so importing
  over data that had payments failed with a duplicate id), and a file holding
  `[]` is refused instead of wiping the database.
- Opening a database with mode `create` refuses to overwrite an existing file
  (the old server deleted it); an empty database name is refused.
- A new customer's client gets a two-letter short name derived from their name
  (the old server stored the whole name, which the column refuses, so most first
  orders failed).
- `GET /api/v1/invoices?clientId=` filters by client id (the old server compared
  it with client names and always came back empty); `GET /api/v1/invoices/:id`
  returns binary fields as base64 like every other route (it leaked Node Buffer
  JSON).
- `GET /api/invoices/xml` answers errors as JSON with the translation key as
  `message` and serves `application/xml` (the old server crashed to an HTML error
  page, or sent the content type `xml`).
- A field left out of a create request takes the column's default instead of
  failing on NULL; batch imports decode base64 logos and QR codes instead of
  storing the base64 text.
- Filter and type values reach SQL as parameters, never as text. The old server
  pasted them into the query.
- The MCP server prints only protocol on stdout (the old one printed
  "Database opened successfully.", which breaks clients that parse it).

## Dependencies

Only `modernc.org/sqlite` (a pure-Go SQLite driver, no cgo) is pulled in; v1.44.0
is the newest release that builds with Go 1.24. Run `go mod tidy` and commit
`go.sum` after changing dependencies.
