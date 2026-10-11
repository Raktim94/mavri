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
| `internal/api` | Route wiring |
| `internal/scrypt` | scrypt (RFC 7914), standard library only, checked against Node |
| `internal/auth` | Password hashing, API-key secrets, password policy, lockout rules |
| `internal/money` | Exact (rational) invoice arithmetic, differential-tested against the real TS functions |
| `tools/difftest` | Script that generates the TS reference cases (run outside the repo) |
| `internal/ecommerce` | Webhook signature schemes and verification |

## Run and test

```sh
cd rewrite
go vet ./... && go test -race ./...
PORT=3000 go run ./cmd/server
```

## Status

Done and unit-tested: configuration, middleware stack, `/api/health`,
`/api/version`, `/api/databases/ready`; password and API-key hashing (existing
hashes verify), password policy, lockout rules and webhook signatures, all
cross-checked against values produced by Node's crypto and the TS code.
Invoice totals, line discounts and tax in exact arithmetic, compared with the
real renderer functions on 1,500 synthetic invoices: identical except where a
line's discount share is exactly n.5 cents (the old float code rounds down,
the exact version rounds up). Which behaviour to keep is an open decision.
These are pure functions: they are not yet wired to a database or routes.

Not started: database layer, migrations, authentication, every resource route,
invoices, import/export, MCP, e-commerce webhooks, desktop bridge.

Not yet verified: that response headers match the TypeScript server byte for
byte. That needs a contract test against a running TS server.

## Dependencies

Only the Go standard library is used so far. The SQLite driver, `pgx` and an
`golang.org/x/crypto/scrypt` replacement are still to be added; they could not be downloaded in the
session that wrote this slice because module downloads were blocked. Add them
with `go get` and commit `go.sum` when building outside that environment.
