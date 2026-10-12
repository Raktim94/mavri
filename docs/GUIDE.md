# Guide

This walks through Mavri from a fresh install to a sent invoice. Screenshots use fictional demo data.

## 1. Create your account

Open the app (http://localhost:3001 for Docker Compose). The first visit asks for an email and a password; this becomes the owner account. Use at least 8 characters with letters and numbers. Setup only works once; after that the page is a normal sign-in.

![First run](screenshots/first-run.png)

## 2. Add what an invoice needs

Use the left menu:

- **Businesses**: who is sending the invoice (name, address, email, phone, tax ID). Add the e-invoice address here if you will export UBL or XRechnung.
- **Clients**: who you bill. Add an address, tax ID and country code for e-invoices, and a buyer reference if the client requires one.
- **Items**: optional catalog of things you sell, with a price. You can also type any line freely when you make an invoice.
- **Bank accounts**: optional payment details printed on the invoice.
- **Currencies**: common currencies are already there. Add others with their symbol and a format such as `{symbol}{amount}`.

Every list has *New*, *Edit*, *Archive* and *Delete*. Archive hides a record without breaking old invoices; delete is refused while a record is in use.

![Clients](screenshots/clients.png)

## 3. Make an invoice

**Invoices → New invoice.**

1. Choose the business, client and currency. The next number is filled in for you and can be changed.
2. Set the date, due date and status.
3. Add lines. Pick a catalog item or type a description, then set quantity, price and tax. Tax can be *Added* on top or *Included* in the price.
4. Optionally add a discount, a surcharge, shipping, or a tax for the whole document (*Added*, *Included* or *Deducted*).
5. Record payments. The status changes to *Partly paid* or *Paid* by itself.
6. Add notes, terms or a thank-you line, then **Save**.

If you have presets or styles, *Start from a preset* fills the business, client, currency, bank and notes in one step, and *Style* copies a saved look.

![Invoice editor](screenshots/invoice-editor.png)

## 4. Send it

Open the invoice. **Print / save as PDF** uses your browser's print dialog, so choose *Save as PDF* as the printer. **UBL XML** and **XRechnung XML** download an electronic invoice; if a required field is missing, Mavri says which one.

![Invoice](screenshots/invoice-view.png)

## Quotes

**Quotes** works the same way. When a client accepts, open the quote and choose **Convert to invoice**.

## Presets and styles

A **preset** is a saved combination of business, client, currency, bank and notes. A **style** stores accent colour, font, text size, page size and which columns to show.

## Reports

**Reports** adds up billed, paid and outstanding amounts by month and by client for a chosen year, per currency.

![Reports](screenshots/reports.png)

## Integrations

**Integrations** connects a store. Create an integration, copy the webhook URL and the secret (shown once) into Shopify, WooCommerce or your own system. Each paid order becomes an invoice.

![Integrations](screenshots/integrations.png)

## Settings

Language, date and number formats, invoice prefix and suffix, and switches that hide features you do not use. **Backup** downloads everything as one file and restores from it. **API keys** let scripts and tools talk to Mavri; the secret is shown once.

![Settings](screenshots/settings.png)
