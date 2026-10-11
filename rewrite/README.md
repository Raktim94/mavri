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

## Run and test

```sh
cd rewrite
go vet ./... && go test -race ./...
PORT=3000 go run ./cmd/server
```

## Status

Done and unit-tested: configuration, middleware stack, `/api/health`,
`/api/version`, `/api/databases/ready`.

Not started: database layer, migrations, authentication, every resource route,
invoices, import/export, MCP, e-commerce webhooks, desktop bridge.

Not yet verified: that response headers match the TypeScript server byte for
byte. That needs a contract test against a running TS server.

## Dependencies

Only the Go standard library is used so far. The SQLite driver, `pgx` and an
scrypt implementation are still to be added; they could not be downloaded in the
session that wrote this slice because module downloads were blocked. Add them
with `go get` and commit `go.sum` when building outside that environment.
