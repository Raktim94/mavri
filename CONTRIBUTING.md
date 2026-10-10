# Contributing to NodeDR Invoice

Thanks for considering a contribution! NodeDR Invoice is a small, focused,
offline-first invoicing tool that ships as a desktop app, a Docker image and a
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

Read the [`README.md`](./README.md) and skim [`API.md`](./API.md), [`LAYOUT.md`](./LAYOUT.md) and
[`DESIGN.md`](./DESIGN.md). Keep contributions aligned with "self-hosted, data-you-own invoicing"
rather than expanding into multi-tenant SaaS territory. For anything big, open an issue first.

## Development setup

**Prerequisites:** Node.js 20+, npm, and Docker (optional, for the production-like path).

### Option A — Docker (matches production)

```bash
git clone https://github.com/Raktim94/nodedr-invoice.git
cd nodedr-invoice
docker compose -f docker-compose.standalone.yml up -d --build   # http://localhost:3001
```

### Option B — Local dev

```bash
npm install
npm run dev                    # Electron desktop app
# or, in the browser:
npm run dev:react              # terminal 1: Vite frontend
npm run dev:webserver          # terminal 2: Express REST API
npm run mcp                    # optional: MCP server
```

### Checks to run before pushing

```bash
npm run lint
npm test
npm run mcp:typecheck
npx tsc -p tsconfig.webserver.json --noEmit
```

## Project structure

```
src/
  backend/
    main/        Electron main process
    webserver/   Express app: controllers, auth middleware, /api/v1
    mcp/         MCP server and tools
    shared/      Environment-agnostic services, types, migrations
  preload/       Electron preload
  renderer/      React app (pages, state, shared UI, i18n)
casaos/          CasaOS/ZimaOS app manifest
scripts/         Docker start script and nginx template
```

## Conventions that are not optional

- **TypeScript only** for new code; ESLint + Prettier must pass (`npm run lint:fix`).
- **Business logic lives in `src/backend/shared/services`** and is reused by Electron IPC, the web
  controllers *and* the MCP tools — don't duplicate it in a controller.
- **Never edit an existing migration.** Add a new, date-prefixed file in `shared/migrations`.
- **Money is stored in minor units** (cents) as strings; convert at the edges only.
- **Invoices snapshot** business, client, items, bank, currency, style and layout. Don't make an
  invoice read live data for those.
- **Security bar:** anything touching auth, API keys, webhooks, secrets or input validation is
  reviewed strictly. Webhooks verify HMAC over raw bytes; secrets are never logged or returned.
- **i18n:** add every new UI string to all files in `src/renderer/i18n` (`npm run sort:i18n`).
- **No secrets, personal data or generated build output** in commits.

## Working on the API and MCP server

- Public endpoints live under `/api/v1` (`controllers/publicApi.ts`) and use Bearer API keys.
  Keep them versioned, idempotent where they create data, and documented in `API.md`.
- Add a matching MCP tool when you add a capability that agents would want, sharing the same
  service function (see `services/invoiceFetcher.ts`).
- Paginate list endpoints and cap `limit`.

## Working on the UI and design

The visual language is in [`DESIGN.md`](./DESIGN.md) and implemented centrally in
`renderer/shared/components/layout/theme/theme.ts`. Change tokens there, not per component, and
check both light and dark mode. PDF output must keep working with user-chosen colors.

## Making a change

1. Fork and create a branch: `git checkout -b feature/short-description`
2. Make a focused change with tests where practical (`*.spec.ts` next to the code).
3. Run the checks above.
4. Update docs (`README.md`, `API.md`, `LAYOUT.md`) if behavior changed.

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
