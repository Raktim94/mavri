# Contributing to Mavri

Mavri is a small self-hosted invoicing app: a Go server with SQLite, a React interface, one Docker image. Contributions that keep it simple, fast and private are very welcome. For anything bigger than a small fix, open an issue first so we can agree on the approach.

By taking part you agree to the [code of conduct](CODE_OF_CONDUCT.md). By submitting a pull request you agree that your work is licensed under the project's [AGPL-3.0](LICENSE); you keep the copyright on it.

## Set up

You need Node.js 20+ and Go 1.24+ (or Docker).

```bash
git clone https://github.com/Raktim94/mavri.git && cd mavri
npm install
(cd server && DB_DIRECTORY=/tmp/mavri PORT=3001 go run ./cmd/mavri)   # API on :3001
npm run dev                                                           # web app on :5174, proxies /api
```

To run the production image instead: `docker compose up -d --build` and open http://localhost:3001.

## Before you push

```bash
npm run typecheck && npm run lint && npm test
(cd server && gofmt -l . && go vet ./... && go test ./...)
sh e2e/run.sh        # optional: full browser run against the Docker image (needs Chrome and Playwright)
```

## How the code is organised

| Path | Contents |
| --- | --- |
| `web/src` | React interface: `pages`, `components`, one `styles.css` with design tokens at the top |
| `server/internal` | `web` (HTTP), `store` (records and rules), `auth`, `shop` (webhooks), `einvoice`, `mcp`, `db` |
| `server/cmd` | `mavri` (the server), `mavri-mcp` |
| `updater` | Tiny sidecar behind the in-app **Update now** button |
| `casaos`, `Dockerfile`, `docker-compose.yml` | Deployment |
| `docs` | Guide, API reference, design notes and screenshots |

## Rules that matter

- **One place for business rules.** Validation and calculations live in `server/internal` and are shared by the REST handlers and the MCP tools. Do not copy them into a handler.
- **Migrations are append-only.** Never edit a shipped file in `server/internal/db/migrations`; add the next numbered one.
- **Money is integer minor units** (cents). Convert only at the edges.
- **Documents are snapshots.** An invoice keeps its own copy of the business, customer, lines, bank, currency and style, so later edits never rewrite history.
- **Security changes get extra scrutiny:** sign-in, API keys, webhooks, secrets and input validation. Webhook signatures are verified over the raw body; secrets are never logged or returned.
- **Design:** change colours and spacing through the CSS variables, check light and dark mode, respect `prefers-reduced-motion`, and keep the printed invoice readable in black on white. See [docs/DESIGN.md](docs/DESIGN.md).
- No secrets, personal data or build output in commits.

## Pull requests

Keep them small and single-purpose. Write commit messages in the imperative ("Add invoice search"), explain the why when it is not obvious, and include screenshots (light and dark) for interface changes. Update the README, guide or API reference when behaviour changes. The template in `.github` lists what reviewers look for.

## Reporting bugs and security issues

Use the bug template and include your version (Settings → Updates) and how you run Mavri. Report security problems privately as described in [SECURITY.md](SECURITY.md).
