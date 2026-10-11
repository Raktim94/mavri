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
  <a href="docs/TUTORIAL.md">Tutorial</a> ·
  <a href="docs/reference/API.md">API reference</a> ·
  <a href="CONTRIBUTING.md">Contribute</a>
</p>

<p align="center">
  <a href="LICENSE"><img alt="AGPL-3.0 license" src="https://img.shields.io/badge/license-AGPL--3.0-282640"></a>
  <a href="docker-compose.standalone.yml"><img alt="Docker Compose" src="https://img.shields.io/badge/deploy-Docker%20Compose-282640?logo=docker&logoColor=white"></a>
  <a href="docs/reference/API.md"><img alt="REST API" src="https://img.shields.io/badge/API-REST-EA806E"></a>
  <a href="src/backend/mcp"><img alt="MCP server" src="https://img.shields.io/badge/integrations-MCP-EA806E"></a>
</p>

> The repository, container image, and current app identifiers still use `nodedr-invoice`. Keep those names in the commands below.

Mavri helps freelancers and small businesses create invoices and quotes without handing their business records to a hosted billing service. Run it on your computer or your own server. The app supports SQLite and PostgreSQL, and its invoice PDFs can be styled for your business.

## At a glance

| Make invoices | Keep control | Connect your workflow |
| --- | --- | --- |
| Quotes, payments, multi-currency documents, branded PDFs, UBL 2.1 and XRechnung exports | Local or self-hosted deployment, database backup and restore, JSON and XLSX import/export | REST API, signed Shopify/WooCommerce webhooks, and an MCP server |

<p align="center">
  <img src="docs/screenshots/dashboard-light.png" alt="Mavri dashboard in light mode with fictional demo data" width="100%">
</p>

<p align="center">
  <img src="docs/screenshots/dashboard-dark.png" alt="Mavri dashboard in dark mode with fictional demo data" width="49%">
  <img src="docs/tutorial-assets/invoice_pdf_preview.jpg" alt="Sample invoice PDF preview" width="49%">
</p>

*Screenshots use fictional demo data. The standalone [Mavri logo](mavri-logo.png) is available for project artwork.*

## Screens

<table>
<tr>
<td align="center"><img src="docs/screenshots/invoices.png" alt="Invoices"><br><sub>Invoices</sub></td>
<td align="center"><img src="docs/screenshots/invoice-edit.png" alt="Invoice editor"><br><sub>Invoice editor</sub></td>
</tr>
<tr>
<td align="center"><img src="docs/screenshots/invoice-preview.png" alt="PDF preview"><br><sub>PDF preview</sub></td>
<td align="center"><img src="docs/screenshots/quotes.png" alt="Quotes"><br><sub>Quotes</sub></td>
</tr>
<tr>
<td align="center"><img src="docs/screenshots/clients.png" alt="Clients"><br><sub>Clients</sub></td>
<td align="center"><img src="docs/screenshots/items.png" alt="Items"><br><sub>Items</sub></td>
</tr>
<tr>
<td align="center"><img src="docs/screenshots/banks.png" alt="Banks"><br><sub>Banks</sub></td>
<td align="center"><img src="docs/screenshots/style-profiles.png" alt="Style profiles"><br><sub>Style profiles</sub></td>
</tr>
<tr>
<td align="center"><img src="docs/screenshots/layouts.png" alt="Layouts"><br><sub>Layouts</sub></td>
<td align="center"><img src="docs/screenshots/integrations.png" alt="Integrations"><br><sub>Integrations</sub></td>
</tr>
</table>

Every screen is walked through in the [tutorial](docs/TUTORIAL.md).

## Get started

### Docker Compose

Requires Docker and Docker Compose. This path builds the app from this repository.

```bash
git clone https://github.com/Raktim94/nodedr-invoice.git
cd nodedr-invoice
docker compose -f docker-compose.standalone.yml up -d --build
```

Open **http://localhost:3001** and create the owner account. There is no database setup: on Docker and CasaOS, Mavri creates its database automatically on first start. Set `HOST_PORT=8080` to expose a different host port. Data persists in the `nodedr-invoice-data` Docker volume; back up that volume regularly. For an HTTPS reverse proxy, set `COOKIE_SECURE=true` and `FRONTEND_ORIGIN` to the public origin.

A prebuilt, version-pinned image is available at `ghcr.io/raktim94/nodedr-invoice:1.0.0` (amd64 and arm64).

### CasaOS / ZimaOS

Import [`casaos/docker-compose.yml`](casaos/docker-compose.yml) through **App Store → Custom Install → Import**. Open `http://<your-server>:8473` and create the owner account. The app stores data under `/DATA/AppData/nodedr-invoice/data`.

### Desktop

Download the Windows, macOS, or Linux build from [Releases](https://github.com/Raktim94/nodedr-invoice/releases). On Linux, make the AppImage executable before opening it.

After launch, add a business, currency, client, item, bank, and layout; then create an invoice or quote and export its PDF. The [tutorial](docs/TUTORIAL.md) walks through the full flow.

## What Mavri can do

- **Invoices and quotes:** line items, discounts, surcharges, shipping, tax, partial payments, and status tracking.
- **Documents:** live PDF preview, A4 or Letter output, brand styles, layout presets, signatures, attachments, and payment QR codes.
- **International billing:** per-document currencies and languages, plus UBL 2.1, Peppol BIS Billing 3.0, and XRechnung export.
- **Dashboard:** a *Needs attention* queue of overdue invoices, quick *Create invoice* and *Create quote* actions, collection rate, and sales trend.
- **Business records:** clients, items, categories, banks, reports, search, filters, and archive.
- **Portability:** database backup and restore, JSON export/import, and XLSX import/export for most entities.
- **Integrations:** versioned REST API, e-commerce webhooks, and an MCP server for supported AI clients.

Each invoice and quote stores snapshots of its business, client, item, bank, currency, style, and layout details. Later edits to those records do not change existing documents.

## API and integrations

Create an API key in Mavri, then use the [`/api/v1` API](docs/reference/API.md) to create orders and fetch invoices. The order endpoint is idempotent for a given integration and external order ID.

```bash
curl -X POST http://localhost:3001/api/v1/orders \
  -H "Authorization: Bearer $KEY" \
  -H "Content-Type: application/json" \
  -d '{"integrationId":1,"externalOrderId":"ORD-1001","customer":{"name":"Acme Ltd","email":"billing@acme.test"},"lineItems":[{"name":"Consulting","quantity":2,"unitPriceMajor":150}]}'
```

Mavri also accepts HMAC-signed Shopify, WooCommerce, and generic webhooks. Run `npm run mcp` for the bundled MCP server. See [API.md](docs/reference/API.md) and the [tutorial](docs/TUTORIAL.md) for setup and examples.

## Go backend rewrite (in progress)

A Go replacement for the TypeScript backend is being built in [`rewrite/`](rewrite/README.md). The TypeScript backend stays the active application until every row of the [parity matrix](docs/rewrite/PARITY_MATRIX.md) is proven. So far the Go side has exact invoice arithmetic, India GST rules (GSTIN, Rule 46 checks, effective-dated tax calculation), UPI payment links, billing rules (terms, late fees, credit notes, recurring schedules), roles and a tamper-evident audit log. It has no database layer or REST routes yet, and it is not used by the app.

## Documentation and development

[Tutorial](docs/TUTORIAL.md) · [API](docs/reference/API.md) · [Layout JSON reference](docs/reference/LAYOUT.md) · [Contributing](CONTRIBUTING.md) · [Security](SECURITY.md) · [Privacy](PRIVACY-POLICY.md)

For local desktop development, install Node.js 20+ and npm:

```bash
git clone https://github.com/Raktim94/nodedr-invoice.git
cd nodedr-invoice
npm install
npm run dev
```

The stack is TypeScript, React, MUI, Electron, Express, SQLite/PostgreSQL, and Docker. Read [CONTRIBUTING.md](CONTRIBUTING.md) before proposing a change.

## Maintainer, origins, and license

**Created and led by [Raktim Ranjit](https://raktimranjit.com)** ([@Raktim94](https://github.com/Raktim94)) at [NodeDR Infotech Private Limited](https://nodedr.com). Raktim is the lead maintainer; see [MAINTAINERS.md](MAINTAINERS.md) for contact details. You can support the project through [GitHub Sponsors](https://github.com/sponsors/Raktim94).

Mavri builds on the open-source [Invoice Builder](https://github.com/piratuks/invoice-builder) project by Evaldas L. (piratuks). It is licensed under the [GNU Affero General Public License v3.0](LICENSE). Contributions are welcome under the same license.
