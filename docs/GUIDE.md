# Guide

This walks through Mavri from a fresh install to a sent invoice. Screenshots use fictional demo data.

## 1. Create your account

Open the app (http://localhost:3001 for Docker Compose). The first visit asks for an email and a password; this becomes the owner account. Use at least 8 characters with letters and numbers. Setup only works once; after that the page is a normal sign-in.

![First run](screenshots/first-run.png)

A short setup follows. Add your business (with a logo if you have one), pick a currency, add bank details and a first customer, or skip any step; everything can be changed later under **Businesses**, **Currencies** and so on.

![Setup](screenshots/onboarding.png)

## 2. Add what an invoice needs

The setup already created your business, a bank account and a customer if you filled them in. To add more:

Use the left menu:

- **Businesses**: who is sending the invoice (name, address, email, phone, tax ID). Add the country code, tax ID and e-invoice address here if you will export UBL or XRechnung.
- **Customers**: who you bill. Add an address, tax ID and country code for e-invoices, and a buyer reference if the customer requires one.
- **Products**: optional catalog of things you sell, with a price, a category and a unit. You can also type any line freely when you make an invoice.
- **Bank accounts**: optional payment details printed on the invoice.
- **Currencies**: common currencies are already there. Add others with their symbol and a format such as `{symbol}{amount}`.

Every list has *New*, *Edit*, *Archive* and *Delete*. Archive hides a record without breaking old invoices; delete is refused while a record is in use.

![Businesses](screenshots/businesses.png)

## 3. Make an invoice

**Invoices → New invoice.**

1. Choose the business, customer and currency. The next number is filled in for you and can be changed.
2. Set the date and the due date.
3. Add lines. Pick a product or type a description, then set quantity, price and tax. Tax can be *Added* on top or *Included* in the price.
4. Optionally add a discount, a surcharge, shipping, or a tax for the whole document (*Added*, *Included* or *Withheld*).
5. Record payments. The status becomes *Partly paid* or *Paid* by itself; **Void** on the invoice page cancels it.
6. Add notes, terms or a thank-you line, then **Save**.

If you have presets or styles, *Start from a preset* fills the business, customer, currency, bank and notes in one step, and *Style* copies a saved look.

![Invoice editor](screenshots/invoice-editor.png)

## 4. Send it

Open the invoice. Changes to a business or customer record do not change documents you already made; tick *Update details from their records* when editing to copy them again. **Print / save as PDF** uses your browser's print dialog, so choose *Save as PDF* as the printer. **UBL XML** and **XRechnung XML** download an electronic invoice; if a required field is missing, Mavri says which one.

![Invoice](screenshots/invoice-view.png)

A paid invoice shows the payment and a zero balance:

![Paid invoice](screenshots/invoice-paid.png)

## Quotes

**Quotes** works the same way. When a customer accepts, open the quote and choose **Convert to invoice**.

## Presets and styles

A **preset** is a saved combination of business, customer, currency, bank and notes. A **style** stores accent colour, font, text size, page size and which columns to show.

## Reports

**Reports** adds up billed, paid and outstanding amounts by month and by client for a chosen year, per currency.

![Reports](screenshots/reports.png)

## Stores

**Stores** connects an online shop. Connect a store, then copy the webhook URL and the signing secret (shown once) into Shopify, WooCommerce or your own system. Each order becomes an invoice, once.

![Stores](screenshots/stores.png)

## Settings

Invoice and quote number prefixes, and switches that hide features you do not use. **Backup** downloads everything as one file and restores from it. **API keys** let scripts and tools talk to Mavri; the secret is shown once. **Updates** shows your version and whether a newer one is published; on CasaOS, with the bundled updater container, **Update now** pulls the new version and restarts Mavri in a few seconds (your data is kept). Elsewhere it tells you that a new version exists and you update the way you installed.

![Settings](screenshots/settings.png)

## All screens

![Quotes](screenshots/quotes.png)
![Businesses](screenshots/businesses.png)
![Products](screenshots/products.png)
![Bank accounts](screenshots/bank-accounts.png)
![Currencies](screenshots/currencies.png)
![Categories](screenshots/categories.png)
![Units](screenshots/units.png)
![Presets](screenshots/presets.png)
![Styles](screenshots/styles.png)
