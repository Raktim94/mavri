# Changelog

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
