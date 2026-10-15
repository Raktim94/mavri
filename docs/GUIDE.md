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

Every list has _New_, _Edit_, _Archive_ and _Delete_. Archive hides a record without breaking old invoices; delete is refused while a record is in use.

![Businesses](screenshots/businesses.png)

## 3. Make an invoice

**Invoices → New invoice.**

1. Choose the business, customer and currency. The next number is filled in for you and can be changed.
2. Set the date and the due date.
3. Add lines. Pick a product or type a description, then set quantity, price and tax. Tax can be _Added_ on top or _Included_ in the price.
4. Optionally add a discount, a surcharge, shipping, or a tax for the whole document (_Added_, _Included_ or _Withheld_).
5. Record payments. The status becomes _Partly paid_ or _Paid_ by itself; **Void** on the invoice page cancels it.
6. Add notes, terms or a thank-you line, then **Save**.

If you have presets or styles, _Start from a preset_ fills the business, customer, currency, bank and notes in one step, and _Style_ copies a saved look.

![Invoice editor](screenshots/invoice-editor.png)

## 4. Send it

Open the invoice. Changes to a business or customer record do not change documents you already made; tick _Update details from their records_ when editing to copy them again. **Print / save as PDF** uses your browser's print dialog, so choose _Save as PDF_ as the printer. **UBL XML** and **XRechnung XML** download an electronic invoice; if a required field is missing, Mavri says which one.

![Invoice](screenshots/invoice-view.png)

A paid invoice shows the payment and a zero balance:

![Paid invoice](screenshots/invoice-paid.png)

## Share, email and get paid

Open an invoice or quote and choose **Share**. Mavri makes a secure link that only opens that document. Your client needs no account: they read it, print it or save it as a PDF, download the UBL or XRechnung XML, and, for a quote, accept or decline it. Share opens your phone's share sheet where there is one, or WhatsApp or your email app with the message ready for you to check. Nothing is sent automatically. **Turn off link** stops it working.

![Share](screenshots/share.png)

**Email** sends the standard message with the link through your own mail server (set it up once in **Automation → Email**). You can edit the subject and text before it goes, and each email is logged on the document. Mavri sends a link rather than an attachment so the client always sees the current version.

![Email](screenshots/email.png)

![What your client sees](screenshots/client-link.png)

**Online payments.** In **Automation → Online payments (Stripe)** add a Stripe webhook that points at your Mavri, then paste Stripe's signing secret and your secret key. Clients then see a **Pay** button for the balance. They pay on Stripe's page (card details never reach Mavri) and Mavri adds the payment and marks the invoice paid when Stripe confirms. Test with Stripe's test keys first. The public address in Automation must be an HTTPS address Stripe can reach.

## Reminders and recurring invoices

In **Automation → Payment reminders** choose the days before and after the due date; Mavri emails the customer once for each invoice and day, and stops when the invoice is paid. Untick reminders on a customer's record to exclude them, or press **Remind** on an invoice to chase it by hand. Reminders need email and the public address.

**Repeat** on an invoice starts a schedule (every week, month, quarter or year, with an optional end date) and shows the dates it will issue before you start. Each copy is a normal invoice with the next number; tick _Email each new invoice_ to send it automatically. The Automation page lists the schedules and lets you pause or stop them. A rule there can also draft an invoice whenever a quote is accepted.

![Repeat](screenshots/repeat.png)

![Automation](screenshots/automation.png)

In the invoice list, tick rows to **email**, **remind**, **mark paid** or **void** many at once, or export just those rows. You get a result for every invoice, so one problem never hides the rest.

## Activity

**Activity** records who changed what, when and where from: the app, the API, an AI assistant, a client's link or an automatic job. Filter it, search it, and **Export CSV**.

![Activity](screenshots/activity.png)

## Integrations

**Integrations** adds webhooks: Mavri sends a signed message to your URL for events such as `invoice.created`, `invoice.paid`, `quote.accepted` or `payment.failed`. Failed deliveries are retried (after 1 minute, 5 minutes, 30 minutes, 2 hours and 6 hours), every delivery is logged, and **Replay** sends one again. The page also has copy-ready examples, including how to check a signature. The whole API is in `/api/openapi.yaml`.

![Integrations](screenshots/integrations.png)

## Data and backups

**Data & backups** exports customers, products, invoices and payments as CSV and imports customers and products. Choose the file, **Check file**, read what will happen (and download the list of rows with problems), then import.

Backups can run on a schedule, with a number of copies kept. Turn on **Encrypt** to protect them with a passphrase you keep elsewhere, and add an S3-compatible bucket (Amazon S3, Backblaze B2, Cloudflare R2, MinIO and others) for an off-site copy. Every backup is read back and checked right after it is made. The screen shows the last good backup and tells you if backups fall behind.

A backup contains your invoices, quotes, payments, customers, businesses, products, banks, styles, presets, schedules, share links and history. It does **not** contain sign-in accounts, API keys, store connections, webhook endpoints, or the email, backup and payment settings and their passwords, and never the server's encryption key. After restoring on a new server, add those again. **Restore** is a guided check: pick a copy, enter the passphrase if it has one, see what it holds, confirm. A safety copy of your current data is made first.

![Data and backups](screenshots/data.png)

## Health

**Health** shows whether the database passes its integrity check, how much space the data uses, how old the last backup is, webhook and email failures in the last day, and recent warnings and errors.

![Health](screenshots/health.png)

## Quotes

**Quotes** works the same way. When a customer accepts (through their link, or you convert it), the quote is marked accepted. Open it and choose **Convert to invoice**, or switch on the Automation rule to draft the invoice for you.

## Presets and styles

A **preset** is a saved combination of business, customer, currency, bank and notes. A **style** stores accent colour, font, text size, page size and which columns to show.

## Reports

**Reports** adds up billed, paid and outstanding amounts by month and by client for a chosen year, per currency.

![Reports](screenshots/reports.png)

## Stores

**Stores** connects an online shop. Connect a store, then copy the webhook URL and the signing secret (shown once) into Shopify, WooCommerce or your own system. Each order becomes an invoice, once.

![Stores](screenshots/stores.png)

## Settings

Invoice and quote number prefixes, and switches that hide features you do not use. **Backup** downloads everything as one file and restores from it; scheduled and encrypted backups are in **Data & backups**. **API keys** let scripts and tools talk to Mavri; the secret is shown once. **Updates** shows your version and whether a newer one is published; on CasaOS, with the bundled updater container, **Update now** pulls the new version and restarts Mavri in a few seconds (your data is kept). Elsewhere it tells you that a new version exists and you update the way you installed.

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
