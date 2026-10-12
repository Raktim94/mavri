# Contributing to Mavri

Thanks for considering a contribution! Mavri is a small, focused,
invoicing tool that ships as a Docker image and a
CasaOS/ZimaOS app from the same code. This guide covers setup, conventions and
the issue/PR process.

## Table of contents

- [Code of Conduct](#code-of-conduct)
- [Maintainers & copyright](#maintainers--copyright)
- [Before you start](#before-you-start)
- [Development setup](#development-setup)
- [Project structure](#project-structure)
- [Conventions that are not optional](#conventions-that-are-not-optional)
- [Working on the API and MCP server](#working-on-the-api-and-mcp-server)
- [Working on the UI and design](#working-on-the-ui-and-design)
- [Making a change](#making-a-change)
- [Commit messages](#commit-messages)
- [Opening a pull request](#opening-a-pull-request)
- [Reporting bugs](#reporting-bugs)
- [Proposing features](#proposing-features)

## Code of Conduct

This project follows the [Contributor Covenant](./CODE_OF_CONDUCT.md). Report unacceptable
behavior to **mail@raktimranjit.com**.

## Maintainers & copyright

See [`MAINTAINERS.md`](./MAINTAINERS.md). By submitting a PR you agree your contribution is
licensed under the same [AGPL-3.0](./LICENSE) as the project; you keep copyright on your own work.

## Before you start

Read the [`README.md`](./README.md) and skim [`API.md`](./docs/API.md). Keep contributions aligned with "self-hosted, data-you-own invoicing"
rather than expanding into multi-tenant SaaS territory. For anything big, open an issue first.

## Development setup

**Prerequisites:** Node.js 20+, npm, and Docker (optional, for the production-like path).

### Option A — Docker (matches production)

```bash
git clone https://github.com/Raktim94/nodedr-invoice.git
cd nodedr-invoice
docker compose up -d --build   # http://localhost:3001
```

### Option B — Local dev

Needs Node.js 20+ and Go 1.24+.

```bash
npm install
(cd rewrite && DEFAULT_DATABASE=invoice.db FRONTEND_ORIGIN=http://127.0.0.1:5173 go run ./cmd/server)   # terminal 1: API on :3000
VITE_API_URL=http://127.0.0.1:3000 npm run dev                                                           # terminal 2: web app on :5173
```

### Checks to run before pushing

```bash
npm run lint
npm test
npx tsc -p tsconfig.app.json --noEmit
(cd rewrite && gofmt -l . && go vet ./... && go test -race ./...)
```

## Project structure

```
web/             React app (Vite, plain CSS)
rewrite/         Go backend: cmd/server, cmd/mcp, internal/* (API, SQLite, schema, MCP, e-invoice)
casaos/          CasaOS/ZimaOS app manifest
docs/            Tutorial, API and layout references, screenshots
```

## Conventions that are not optional

- **Interface code is TypeScript**; ESLint + Prettier must pass (`npm run lint:fix`). **Backend code is Go**; `gofmt` and `go vet` must be clean.
- **Business logic lives in `rewrite/internal`** and is shared by the REST handlers *and* the MCP
  tools (`invoices`, `orders`, `entity`) — don't duplicate it in a handler.
- **Never edit the baseline schema.** Add a date-prefixed `.sql` file in `rewrite/internal/schema/migrations`.
- **Money is stored in minor units** (cents) as strings; convert at the edges only.
- **Invoices snapshot** business, client, items, bank, currency, style and layout. Don't make an
  invoice read live data for those.
- **Security bar:** anything touching auth, API keys, webhooks, secrets or input validation is
  reviewed strictly. Webhooks verify HMAC over raw bytes; secrets are never logged or returned.
- **No secrets, personal data or generated build output** in commits.

## Working on the API and MCP server

- Public endpoints live under `/api/v1` (`controllers/publicApi.ts`) and use Bearer API keys.
  Keep them versioned, idempotent where they create data, and documented in `docs/API.md`.
- Add a matching MCP tool when you add a capability that agents would want, sharing the same
  service function (see `services/invoiceFetcher.ts`).
- Paginate list endpoints and cap `limit`.

## Working on the UI and design

The interface is plain React and CSS in `web/src`. Colours are CSS variables at the top of
`web/src/styles.css`; change tokens there, not per component, and check both light and dark mode.
The printed invoice must stay readable in black on white.

## Making a change

1. Fork and create a branch: `git checkout -b feature/short-description`
2. Make a focused change with tests where practical (`*.test.ts` next to the code).
3. Run the checks above.
4. Update docs (`README.md`, `docs/API.md`, `docs/GUIDE.md`) if behavior changed.

## Commit messages

- Present tense, imperative mood: "Add invoice search", not "Added".
- First line under 72 characters; explain *why* in the body when it isn't obvious.
- Reference issues/PRs (`Fixes #123`).

## Opening a pull request

Fill in the PR template. Keep PRs small and single-purpose, include screenshots for UI changes
(light and dark), and note any migration or Docker/CasaOS impact. CI must be green.

## Reporting bugs

Search existing issues first, then include: steps to reproduce, expected vs actual behavior, your
environment (OS, install method — desktop/Docker/CasaOS — and app version), and logs or
screenshots. **Security issues:** email the maintainer privately, don't open a public issue
(see [`SECURITY.md`](./SECURITY.md)).

## Proposing features

Open an issue describing the problem, the use case and any implementation ideas. Small, well-scoped
proposals that fit the self-hosted, offline-first goal are the easiest to accept.
