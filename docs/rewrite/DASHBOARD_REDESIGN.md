# Dashboard redesign

Scope: `src/renderer/pages/reports`. Baseline screenshots in `docs/screenshots/` are left untouched.

## Problems in the previous layout

| # | Problem | Evidence |
|---|---------|----------|
| 1 | First KPI is just "Total"; it is unclear whether it is invoiced, collected or outstanding. | `FinancialCards.tsx` used `common.total`. |
| 2 | No primary action. A user who lands here cannot start an invoice. | `Header.tsx` had only filters. |
| 3 | Nothing tells the user what to do next; overdue work is only a count under "Collected". | `reports.overdue` subtitle. |
| 4 | Two ranking charts take prime space above the recent invoices. | `Overview.tsx` grid order. |
| 5 | The trend chart has no text alternative. | `TrendChart.tsx`. |
| 6 | The empty state is a sentence with no way forward. | `NoItem` without a node. |
| 7 | No Indian grouping (12,34,567.10) in amount formats. | `AmountFormat` had en-US, lt-LT, de-DE only. |

## What changed

1. **Header**: title and subtitle, then a primary **Create invoice** button and a secondary **Create quote** button. Filters (date basis, currency, range) moved to their own row. Both buttons deep link to the list page with `state.create`, which opens the blank add form once (`CRUDPage.openAddOnMount`).
2. **KPI**: "Total" renamed **Invoiced this period**.
3. **Needs attention** (`AttentionQueue`, logic in `attention.ts`): overdue invoices, most overdue first, top 5 plus an exact count and total balance. It ignores the date filters (overdue is a current state) but is scoped to the selected currency, so balances are never mixed. Urgency uses an icon and "N days overdue" text, not colour alone. Invoices with no due date never appear.
4. **Order**: trend and collection, then Needs attention beside Recent invoices. Top clients and top items sit behind a **Show top clients and items** toggle (`aria-expanded`, `aria-controls`).
5. **Accessibility**: trend chart wrapped in `role="img"` with a description.
6. **Empty account**: the empty state now offers **Create invoice**.
7. **Indian formats**: `en-IN` and `en-IN-no-decimal` amount formats, formatted by `Intl.NumberFormat`; the amount input uses `thousandsGroupStyle="lakh"`.

## Not done yet

- Dark and light screenshots of the new layout.
- Translations: new strings exist in `en.json` only; other languages fall back to English.
- Loading and error states for the invoice query (the hook exposes no loading flag).
- A "Record payment" action, a business switcher, and a cash-flow/aging chart.
- Indian date format as a default, and an `en-IN` row in the language catalogs.
- The backend enum copy `src/backend/shared/enums/amountFormat.ts` was not changed (TypeScript backend is out of scope). Settings store the value as free text, so `en-IN` saves, but the backend type does not list it.

## Verification

- `npx vitest run src/renderer/__tests__/attention.test.ts`: 4 passing.
- `npx tsc -p tsconfig.app.json --noEmit`: two errors, both in files this change does not touch (`useExportPdf.tsx`, `usePresetUpdate.ts`).
- `npx eslint` on the changed files: clean.
- `npx vite build`: succeeds.
- `src/backend` tests: 20 failures that also occur on the untouched tree.
