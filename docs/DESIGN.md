# Design notes

How Mavri looks and moves, and the rules to keep it that way when you change it.

## Principles

1. **Calm and fast.** Paper-like surfaces, generous spacing, one accent colour. Nothing competes with the numbers.
2. **Motion explains, it does not decorate.** Things slide in from where they came from, buttons respond to a press, lists settle row by row. Nothing loops except two quiet attention cues (the _Update available_ button and the _Unpaid_ badge).
3. **The paper is the product.** The invoice view and print output are designed first; the app around it supports them. Printing is always black on white without animation.
4. **Private by default.** No web fonts, icon CDNs or analytics. The font stack is the system UI font and every icon is an inline SVG.

## Tokens

All design tokens are CSS variables at the top of [`web/src/styles.css`](../web/src/styles.css). Change them there, never per component.

| Token                         | Purpose                                                                                    |
| ----------------------------- | ------------------------------------------------------------------------------------------ |
| `--bg`, `--panel`, `--line`   | Page, surface and hairline colours                                                         |
| `--text`, `--muted`           | Primary and secondary text                                                                 |
| `--accent`, `--accent-text`   | Brand colour and the text on top of it. Invoices override `--accent` from the chosen style |
| `--danger`                    | Destructive actions and errors                                                             |
| `--shadow-sm` / `-md` / `-lg` | Three elevation levels: card, raised, dialog                                               |
| `--ring`                      | Focus ring colour (accent at 35%)                                                          |
| `--ease`                      | `cubic-bezier(0.22, 1, 0.36, 1)`, the one easing curve used everywhere                     |

Dark mode redefines the same tokens under `prefers-color-scheme: dark`; shadows get stronger, not lighter.

## Motion

| Where                      | Effect                                                              | Timing         |
| -------------------------- | ------------------------------------------------------------------- | -------------- |
| Page change                | Fade and rise 10 px                                                 | 420 ms         |
| Table rows                 | Staggered rise, 30 ms apart, first seven rows                       | 400 ms         |
| Dialogs and the setup card | Pop from 97% with a blurred backdrop                                | 280 to 400 ms  |
| Invoice paper              | Rise, then the accent bar grows from the left                       | 550 ms, 800 ms |
| Buttons                    | 1 px lift on hover, 1 px press on click, soft glow on primary       | 160 ms         |
| Sidebar links              | 2 px nudge on hover, gradient on the active page                    | 180 ms         |
| Loading lists              | Shimmering skeleton rows instead of a spinner                       | 1.4 s loop     |
| Sign-in page               | Two blurred colour orbs drift behind the pitch, content staggers in | 14 s loop      |
| Setup finished             | Check mark pops in                                                  | 550 ms         |

Only `transform` and `opacity` are animated, so nothing causes layout work. `prefers-reduced-motion: reduce` turns every animation and transition off, and `@media print` removes them from the invoice.

## Components

- **Sidebar:** three groups (Workspace, Records, System) with 18 px stroke icons from `components/Icon.tsx`. The _Update to x.y.z_ button appears under them only when a newer version exists.
- **Sign-up:** split layout, live password rules and a four-step strength meter. Rules mirror the server; the button stays disabled until they pass.
- **Setup wizard:** three skippable steps (business and logo, currency and bank, first customer), then a hand-off to the first invoice. Each step saves as you continue.
- **Invoice paper:** brand header (logo or monogram tile), meta strip with the amount due highlighted, From and Bill-to cards, tinted table header, totals box and a _Made with Mavri_ footer.
- **Invoice composer:** one page in seven sections (customer, items, tax, dates and terms, payment, brand and notes, review) with a progress list on the left and a live preview on the right; below 1280 px the preview becomes a button, and on a phone a bar with the total and Save sticks to the bottom. Sections fade in over 200 ms and nothing else moves. The review lists what is required, recommended and optional, each item linking to its section. Saving a draft in the browser is announced politely (`role="status"`), not with a toast. Line items are stacked cards inside the narrow column, so every field stays visible without sideways scrolling.
- **Templates:** fifteen presentation layouts defined in `web/src/templates.ts` and `web/src/templates.css`. A template only restyles `.paper`; the text, the amounts and the tax summary come from the document. Each template has a registry entry (title, registration-number label, tax label, whether it shows a tax summary or a signature line) and a class `tpl-<id>`. The stored style snapshot names the template, so an issued document keeps its look; a document without one prints in the original layout.
- **Payment QR:** drawn as SVG squares (`QrCode.tsx`) from a payload the server builds (`paymentqr`), always beside the same details as text. It never says "paid".
- **Tax guidance:** a panel that reads the facts, shows a trace, lists missing facts and decisions, and offers rates as buttons. It carries the pack's status and says when nobody has reviewed it.
- **Logo picker:** accepts PNG, JPG, WebP and SVG; raster images are scaled to at most 640 px in the browser.

## Accessibility

Focus is always visible (a 4 px ring on inputs, an outline on buttons and links). Status is never colour-only: badges carry text. Forms use real labels, the password toggle exposes `aria-pressed`, and rules are announced through `aria-live`. Colour contrast of text on `--accent` is kept at 4.5:1 or better for the default accent (now `#2459a6`). Arabic documents set `dir="rtl"` and keep numbers reading left to right.

## Screenshots

`e2e/screenshots.py` rebuilds every picture in `docs/screenshots` from a fresh server by walking the real first-run flow with fictional data. Run it against an empty container, never against real data:

```bash
docker build -t mavri-shots . && docker run -d --name mavri-shots -p 3923:3001 mavri-shots
python3 e2e/screenshots.py http://localhost:3923
docker rm -f mavri-shots
```

## Status against the master product brief

The invoicing brief (`docs`-level, kept by the maintainers) asks for far more than one release can honestly claim. This is what 2.3.0 does and does not do.

**Built.** One-page invoice composer with inline customer add, live preview, review checklist and browser draft; fifteen templates with a gallery; collections list, promises, disputes and pauses; UPI and SEPA payment QR with text fallback; manual payment recording from the invoice; client page questions (dispute, promise to pay); tax guidance packs for India, the UK, the EU, the UAE and the US with effective-dated rates and number checks; CGST/SGST/IGST split on the GST templates; document languages (eight draft translations, right to left for Arabic); invoice CSV import with a dry run; JSON export of all documents; order dry run; customer events; MCP tools to preview, read guidance and record follow-ups behind approval.

**Not built, on purpose or for lack of a source of truth.**

- A draft-versus-issued lifecycle with locked numbers. Mavri documents stay editable; snapshots only protect against later edits to linked records. Credit and debit notes as separate documents are not built.
- Anything that talks to a tax authority: e-invoice IRN and its signed QR, e-way bills, VIES or GST portal look-ups, MTD, filing.
- Payment providers other than Stripe Checkout, open banking, Aani, ACH, partial-payment links, refunds and chargebacks.
- Line fields such as SKU, HSN/SAC, service period, bundles and thumbnails; barcode scanning; drag-to-reorder (buttons move lines instead).
- Server-side PDFs with embedded fonts. PDF is the browser's print output, so Arabic, Indian and CJK scripts depend on the fonts on that device. Korean, Japanese, Bengali, Tamil, Telugu and the other languages in the brief are not included.
- The app interface in other languages (only the words printed on documents are translated).
- Dual-currency invoices with an exchange rate: the International template prints the currency code and nothing more.
- Organisation-level template defaults and sharing (favourites live in the browser); a template marketplace.
- AI-written reminders, per-customer quiet hours and time zones, escalation owners, and "delivered" or "opened" tracking beyond the first view of the secure link.
- Amazon and other marketplace adapters, accounting exports, and multiple users with roles.
- An accessibility audit against WCAG 2.2 AA. Keyboard use, labels, status announcements, reduced motion and contrast were designed in, but no one has audited the result.
- Professional review of the tax packs and the translations. Both are labelled as unreviewed in the app.
