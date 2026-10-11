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
| `internal/api` | Route wiring and the `/api/auth/*` handlers (setup, login, logout, me, API keys) |
| `internal/store` | Persistence interface for users, API keys and sessions, plus an in-memory version for tests. `sqlitestore` is the SQLite version (same tables as the TS backend); PostgreSQL is still to do. Both pass one shared contract test (`storetest`) |
| `internal/scrypt` | scrypt (RFC 7914), standard library only, checked against Node |
| `internal/auth` | Password hashing, API-key secrets, password policy, lockout rules |
| `internal/money` | Exact (rational) invoice arithmetic, differential-tested against the real TS functions |
| `internal/gst` | India GST: identifiers, Rule 46 checks, effective-dated rules, tax calculation (no built-in rates) |
| `internal/upi` | UPI payment links and payment state machine (trusted evidence only) |
| `internal/billing` | Terms, aging, late fees, allocation, lifecycle, credit notes, numbering, recurring, reminders, quotes, statements, FX records |
| `internal/rbac` | Roles, permissions, approval thresholds |
| `internal/audit` | Tamper-evident hash-chained audit log |
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
The auth routes (setup, login, logout, me, API keys) run on SQLite and were
checked by hand against a running server, including a session surviving a
restart. They are not yet compared against the TypeScript backend.

Not started: PostgreSQL, the migrations runner (only the auth tables are
created), every resource route, invoices, import/export, MCP, e-commerce
webhooks, desktop bridge.

Not yet verified: that response headers match the TypeScript server byte for
byte. That needs a contract test against a running TS server.

## Dependencies

Only `modernc.org/sqlite` (a pure-Go SQLite driver, no cgo) is pulled in; v1.44.0
is the newest release that builds with Go 1.24. `pgx` is still to be added for
PostgreSQL. Run `go mod tidy` and commit `go.sum` after changing dependencies.
