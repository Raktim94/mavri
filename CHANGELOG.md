# Changelog

## 2.4.0

### Added

- **Drafts, issuing and a lock.** An invoice starts as a draft; **Issue invoice** locks it (figures, parties, dates, number, notes and look), after which only payments, refunds and voiding change it, and it cannot be deleted. Existing invoices are unaffected.
- **Credit notes and debit notes** against an issued invoice, with their own numbers (`CN-`, `DN-`), linked to it and immutable; a credit note that covers the invoice marks it _Credited_. Credit notes reduce billed totals in reports and the dashboard.
- **Refunds** recorded as payments of kind refund; `receivedCents` and `creditedCents` on documents.
- **Richer lines and documents:** item code, tax code (HSN/SAC), service period, kind of line, and a tax reason (exempt, zero-rated, reverse charge, export); date of supply, purchase order and project references; a settlement currency with an exchange rate you enter; product SKU, barcode and tax code, picked by typing or scanning into a line; customer payment terms, time zone, quiet hours and contact preference.
- **People and roles:** owner, staff and viewer accounts, a Team panel in Settings, and changing your own password.
- **Replay-safe writes** with an `Idempotency-Key` header, and `X-RateLimit-*` headers (600 calls a minute per API key).
- **Accounting exports:** a balanced double-entry journal and a one-row-per-line CSV.
- Webhook events `invoice.issued`, `credit_note.created`, `debit_note.created` and `payment.refunded`.

### Changed

- New invoices from the composer are saved as drafts by default; issue them when ready.
- The invoice list has _Draft_ and _Credited_ tabs, and drafts are left out of the dashboard, reports, reminders and the needs-attention list.

### Upgrading

Migrations `006` and `007` run on first start and keep your data. Staff and viewer accounts cannot reach settings, payments, backups, webhooks, keys or people.

## 2.3.0

### Added

- **One-page invoice composer.** Customer, items, tax, dates and terms, payment, brand and notes, and a review, with a live preview, a checklist of what is required, recommended and optional, keyboard shortcuts (Enter adds a line, Alt + ↑ ↓ moves one, Ctrl + S saves), Net 7 / 14 / 30 / 45 / 60 shortcuts, and a browser-kept draft with a polite "Draft saved" status. Add a customer without leaving the page. After saving, a confirmation with the next steps.
- **Fifteen templates** with a gallery (filters, favourites, full-size preview): Ledger Classic, Blue Wave, Editorial Serif, Studio Signature, Agency Services, Product Catalogue, GST India Detailed and Compact, US Professional, UK VAT Standard, EU Cross-border VAT, UAE VAT, International, Milestone & Deposit and Thermal Counter. A template only changes how a document looks.
- **Needs attention.** A daily list of unpaid invoices that need a person, with a suggested next step. On an invoice, **Collections** records a promise to pay, a dispute, a pause on reminders or a note; those stop automatic reminders for that invoice. Clients can say "I will pay by…" or "I need help" from the secure link. Mavri never adds late fees.
- **Payment QR codes.** UPI (INR) and SEPA (EUR with an IBAN) codes for the remaining balance, always with the same details as text. Scanning never marks an invoice paid.
- **Record payment** from the invoice page, and **Create similar**.
- **Tax guidance** for India GST, UK VAT, EU VAT, UAE VAT and US sales tax: effective-dated rates, tax number checks (GSTIN and UK VAT check digits, shape for the rest), a plain-language explanation with missing facts and decisions, and a CGST/SGST/IGST split on the GST templates. No pack has been reviewed by a person yet, and the app says so.
- **Document languages.** Set a language per customer: French, German, Spanish, Italian, Portuguese, Dutch, Hindi and Arabic (right to left) as draft translations, English by default.
- **Invoice CSV import** with a dry run (one row per line item; whole invoices skipped on any problem; re-import is safe), **JSON export** of every document, and `?dryRun=1` on `POST /api/v1/orders`.
- New webhook events `payment.promised`, `dispute.opened`, `dispute.resolved`, `customer.created` and `customer.updated`.
- MCP: `preview_document`, `tax_guidance`, `payment_options`, `needs_attention` and `add_follow_up` (behind approval).

### Changed

- The accent colour is a deeper blue (`#2459a6`).
- `POST /api/public/documents/{token}/respond` also accepts `dispute` and `promise` for an invoice.

### Upgrading

Migrations `004` and `005` run on first start and keep your data. Existing styles keep the original layout until you pick a template. Backups now include follow-ups; older backups restore fine.

## 2.2.0

### Added

- **Share and email.** A secure link per invoice or quote that clients open without an account to read, print or save as PDF, download the UBL or XRechnung XML, and (for quotes) accept or decline. A Share button (system share sheet, WhatsApp, email app, copy link). Email through your own SMTP server with editable templates, a preview, and a delivery log.
- **Getting paid.** Clients can pay the balance online with Stripe Checkout; Mavri records the payment when Stripe's signed webhook confirms it. Automatic payment reminders before and after the due date, per-customer opt-out, and a Remind button.
- **Automation.** Recurring invoices with a preview, the rule "when a quote is accepted, draft an invoice", and bulk email, remind, mark paid, void and export from the invoice list.
- **Activity history.** Who changed what, when and from where (app, API, MCP, client link, automatic), exportable as CSV.
- **Webhooks from Mavri** for invoice, quote, payment, sharing, email and backup events: HMAC-signed, retried with backoff, delivery log, replay.
- **CSV** export (customers, products, invoices, payments) and import (customers, products) with a check before anything is written.
- **Backups.** Scheduled backups with retention, optional passphrase encryption (AES-256-GCM), upload to S3-compatible storage, a read-back check after each backup, a guided restore, and a clear list of what a backup does and does not contain.
- **Health page** and an **OpenAPI** description at `/api/openapi.yaml`.
- Motion polish: springy dialogs with exits, animated figures, a sliding menu marker; phone layout fixes.

### Changed

- The MCP server now returns a preview and changes nothing until called again with `confirm: true` for sending, sharing, recording a payment, voiding and deleting. New tools: `overdue_summary`, `send_document`, `share_document`, `list_activity`.
- Backups no longer include the email, backup and payment settings or webhook endpoints (they belong to the installation); restoring leaves them alone.
- The `mavri-legacy` converter for pre-2.0 databases was removed.

### Upgrading

Database migrations `002` and `003` run on first start and keep your data. Set the **public address** in Automation to use links in emails and reminders. Online payments, email and scheduled backups are off until you configure them.
