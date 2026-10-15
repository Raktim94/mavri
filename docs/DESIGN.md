# Design notes

How Mavri looks and moves, and the rules to keep it that way when you change it.

## Principles

1. **Calm and fast.** Paper-like surfaces, generous spacing, one accent colour. Nothing competes with the numbers.
2. **Motion explains, it does not decorate.** Things slide in from where they came from, buttons respond to a press, lists settle row by row. Nothing loops except two quiet attention cues (the *Update available* button and the *Unpaid* badge).
3. **The paper is the product.** The invoice view and print output are designed first; the app around it supports them. Printing is always black on white without animation.
4. **Private by default.** No web fonts, icon CDNs or analytics. The font stack is the system UI font and every icon is an inline SVG.

## Tokens

All design tokens are CSS variables at the top of [`web/src/styles.css`](../web/src/styles.css). Change them there, never per component.

| Token | Purpose |
| --- | --- |
| `--bg`, `--panel`, `--line` | Page, surface and hairline colours |
| `--text`, `--muted` | Primary and secondary text |
| `--accent`, `--accent-text` | Brand colour and the text on top of it. Invoices override `--accent` from the chosen style |
| `--danger` | Destructive actions and errors |
| `--shadow-sm` / `-md` / `-lg` | Three elevation levels: card, raised, dialog |
| `--ring` | Focus ring colour (accent at 35%) |
| `--ease` | `cubic-bezier(0.22, 1, 0.36, 1)`, the one easing curve used everywhere |

Dark mode redefines the same tokens under `prefers-color-scheme: dark`; shadows get stronger, not lighter.

## Motion

| Where | Effect | Timing |
| --- | --- | --- |
| Page change | Fade and rise 10 px | 420 ms |
| Table rows | Staggered rise, 30 ms apart, first seven rows | 400 ms |
| Dialogs and the setup card | Pop from 97% with a blurred backdrop | 280 to 400 ms |
| Invoice paper | Rise, then the accent bar grows from the left | 550 ms, 800 ms |
| Buttons | 1 px lift on hover, 1 px press on click, soft glow on primary | 160 ms |
| Sidebar links | 2 px nudge on hover, gradient on the active page | 180 ms |
| Loading lists | Shimmering skeleton rows instead of a spinner | 1.4 s loop |
| Sign-in page | Two blurred colour orbs drift behind the pitch, content staggers in | 14 s loop |
| Setup finished | Check mark pops in | 550 ms |

Only `transform` and `opacity` are animated, so nothing causes layout work. `prefers-reduced-motion: reduce` turns every animation and transition off, and `@media print` removes them from the invoice.

## Components

- **Sidebar:** three groups (Workspace, Records, System) with 18 px stroke icons from `components/Icon.tsx`. The *Update to x.y.z* button appears under them only when a newer version exists.
- **Sign-up:** split layout, live password rules and a four-step strength meter. Rules mirror the server; the button stays disabled until they pass.
- **Setup wizard:** three skippable steps (business and logo, currency and bank, first customer), then a hand-off to the first invoice. Each step saves as you continue.
- **Invoice paper:** brand header (logo or monogram tile), meta strip with the amount due highlighted, From and Bill-to cards, tinted table header, totals box and a *Made with Mavri* footer.
- **Logo picker:** accepts PNG, JPG, WebP and SVG; raster images are scaled to at most 640 px in the browser.

## Accessibility

Focus is always visible (a 4 px ring on inputs, an outline on buttons and links). Status is never colour-only: badges carry text. Forms use real labels, the password toggle exposes `aria-pressed`, and rules are announced through `aria-live`. Colour contrast of text on `--accent` is kept at 4.5:1 or better for the default accent.

## Screenshots

`e2e/screenshots.py` rebuilds every picture in `docs/screenshots` from a fresh server by walking the real first-run flow with fictional data. Run it against an empty container, never against real data:

```bash
docker build -t mavri-shots . && docker run -d --name mavri-shots -p 3923:3001 mavri-shots
python3 e2e/screenshots.py http://localhost:3923
docker rm -f mavri-shots
```
