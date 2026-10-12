<p align="center">
  <img src="mavri-logo.png" alt="Mavri circular invoice logo" width="136">
</p>

<p align="center">
  <img src="mavri-banner.png" alt="Mavri: invoicing, on your terms" width="100%">
</p>

<h1 align="center">Mavri</h1>

<p align="center">
  Self-hosted invoicing and quotes for people who want to own their data.
  Create polished PDFs, track payments, and connect your tools through an API.
</p>

<p align="center">
  <a href="https://mavri.nodedr.com">Website</a> ·
  <a href="#get-started">Get started</a> ·
  <a href="docs/GUIDE.md">Guide</a> ·
  <a href="docs/API.md">API reference</a> ·
  <a href="CONTRIBUTING.md">Contribute</a>
</p>

<p align="center">
  <a href="LICENSE"><img alt="AGPL-3.0 license" src="https://img.shields.io/badge/license-AGPL--3.0-282640"></a>
  <a href="docker-compose.yml"><img alt="Docker Compose" src="https://img.shields.io/badge/deploy-Docker%20Compose-282640?logo=docker&logoColor=white"></a>
  <a href="docs/API.md"><img alt="REST API" src="https://img.shields.io/badge/API-REST-EA806E"></a>
  <a href="rewrite/internal/mcp"><img alt="MCP server" src="https://img.shields.io/badge/integrations-MCP-EA806E"></a>
</p>

> The repository, container image, and current app identifiers still use `nodedr-invoice`. Keep those names in the commands below.

Mavri helps freelancers and small businesses create invoices and quotes without handing their records to a hosted billing service. It runs as one small Docker container (about 31 MB) with a SQLite database that you own.

## At a glance

| Make invoices | Keep control | Connect your workflow |
| --- | --- | --- |
| Quotes, payments, several currencies, tax, discounts, printable documents, UBL 2.1 and XRechnung export | One container, one data volume, one-click backup and restore | REST API, signed Shopify, WooCommerce and generic webhooks, and an MCP server |

<p align="center">
  <img src="docs/screenshots/invoices.png" alt="Mavri invoice list with fictional demo data" width="100%">
</p>

<p align="center">
  <img src="docs/screenshots/invoice-view.png" alt="A printable invoice" width="49%">
  <img src="docs/screenshots/invoices-dark.png" alt="Mavri in dark mode" width="49%">
</p>

*Screenshots use fictional demo data. The standalone [Mavri logo](mavri-logo.png) is available for project artwork.*

## Get started

### Docker Compose

Requires Docker and Docker Compose. This path builds the app from this repository.

```bash
git clone https://github.com/Raktim94/nodedr-invoice.git
cd nodedr-invoice
docker compose up -d --build
```

Open **http://localhost:3001** and create the owner account. There is no database setup: Mavri creates its SQLite database in the data volume on first start. Back that volume up, or use **Settings → Backup**. Behind an HTTPS reverse proxy (nginx, Caddy, Cloudflare Tunnel), set `COOKIE_SECURE=true` and `TRUST_PROXY=1`.

A prebuilt, version-pinned image is available at `ghcr.io/raktim94/nodedr-invoice:1.0.0` (amd64 and arm64).

### CasaOS / ZimaOS

Import [`casaos/docker-compose.yml`](casaos/docker-compose.yml) through **App Store → Custom Install → Import**. Open `http://<your-server>:8473` and create the owner account. The app stores data under `/DATA/AppData/nodedr-invoice/data`.

Then follow the [guide](docs/GUIDE.md): add a business, client and items, and create your first invoice.

## What Mavri can do

- **Invoices and quotes:** line items from your catalog or typed freely, tax per line and per document (added, included or deducted), discount, surcharge, shipping, partial payments, status tracking, duplicate, and convert a quote to an invoice.
- **Documents:** a printable page you can save as PDF from the browser, bank details, notes and terms, UBL 2.1 and XRechnung XML downloads.
- **Records:** clients, businesses, items, bank accounts, currencies, categories and units, with archive and restore. Presets and styles speed up new documents.
- **Reports:** billed, paid and outstanding by month and by client.
- **Portability:** one-file backup and restore.
- **Integrations:** versioned REST API with API keys, signed webhooks from Shopify, WooCommerce or any sender, and an MCP server for AI clients.

Each invoice and quote stores a snapshot of its business, client, items, bank, currency and style. Later edits to those records do not change existing documents.

The interface is in English. The database is SQLite only.

## API and integrations

Create an API key in **Settings**, then use the [`/api/v1` API](docs/API.md) to create orders and fetch invoices. The order endpoint is idempotent for a given integration and external order ID.

```bash
curl -X POST http://localhost:3001/api/v1/orders \
  -H "Authorization: Bearer $KEY" \
  -H "Content-Type: application/json" \
  -d '{"integrationId":1,"externalOrderId":"ORD-1001","customer":{"name":"Acme Ltd","email":"billing@acme.test"},"lineItems":[{"name":"Consulting","quantity":2,"unitPriceMajor":150}]}'
```

The MCP server is the `mcp` binary built from `rewrite/cmd/mcp` (see [rewrite/README.md](rewrite/README.md)). Everything is documented in [docs/API.md](docs/API.md).

## Project layout

| Path | What is in it |
| --- | --- |
| `web` | React user interface |
| `rewrite` | Go backend: REST API, MCP server, SQLite schema, tests and the browser end-to-end check |
| `docs` | Guide, API reference, screenshots |
| `casaos`, `Dockerfile`, `docker-compose*.yml` | Container and CasaOS deployment |

## Documentation and development

[Guide](docs/GUIDE.md) · [API](docs/API.md) · [Contributing](CONTRIBUTING.md) · [Security](SECURITY.md) · [Privacy](PRIVACY-POLICY.md)

For local development you need Node.js 20+ and Go 1.24+ (or Docker). Run the backend, then the web app:

```bash
git clone https://github.com/Raktim94/nodedr-invoice.git
cd nodedr-invoice
npm install
(cd rewrite && DEFAULT_DATABASE=invoice.db DB_DIRECTORY=/tmp/mavri PORT=3001 go run ./cmd/server)   # API on :3001
npm run dev                                                                                         # web app on :5174, proxies /api
```

The stack is TypeScript and React for the interface, Go and SQLite for the backend, and Docker. Read [CONTRIBUTING.md](CONTRIBUTING.md) before proposing a change.

## Maintainer, origins, and license

**Created and led by [Raktim Ranjit](https://raktimranjit.com)** ([@Raktim94](https://github.com/Raktim94)) at [NodeDR Infotech Private Limited](https://nodedr.com). Raktim is the lead maintainer; see [MAINTAINERS.md](MAINTAINERS.md) for contact details. You can support the project through [GitHub Sponsors](https://github.com/sponsors/Raktim94).

Mavri is licensed under the [GNU Affero General Public License v3.0](LICENSE). Contributions are welcome under the same license.
