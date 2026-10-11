// Generates differential-test cases for internal/money by running the REAL
// renderer functions (src/renderer/shared/utils/invoiceFunctions.ts).
//
// Usage (from a scratch directory, NOT inside the repo):
//   npm i esbuild date-fns
//   npx esbuild <repo>/src/renderer/shared/utils/invoiceFunctions.ts --bundle \
//       --platform=node --format=cjs --external:date-fns --outfile=invoiceFunctions.cjs
//   node <repo>/rewrite/tools/difftest/gen.mjs invoiceFunctions.cjs 3000 <repo>/rewrite/internal/money/testdata/cases.json
// Inputs are synthetic; no real invoice data is used.
import { createRequire } from 'node:module';
import { writeFileSync } from 'node:fs';
const require = createRequire(import.meta.url);
const [, , bundle, countArg, outPath] = process.argv;
const js = require(process.cwd() + '/' + bundle);

// Small deterministic PRNG (mulberry32) so the file is reproducible.
let seed = 20261011;
const rnd = () => { seed |= 0; seed = (seed + 0x6d2b79f5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
const pick = a => a[Math.floor(rnd() * a.length)];
const int = (lo, hi) => lo + Math.floor(rnd() * (hi - lo + 1));

const rates = ['0', '5', '12', '18', '28', '7.5', '8.25', '19', '21', '0.5', '6.25', '10', '20', '15'];
const qtys = ['1', '2', '3', '1.5', '0.5', '2.25', '10', '0.333', '7', '12.5', '4', '0.1', '100'];
const itemTax = [undefined, 'exclusive', 'inclusive'];
const invTax = [undefined, 'exclusive', 'inclusive', 'deducted'];
const dtype = [undefined, 'fixed', 'percentage'];
const prices = () => pick([int(1, 999), int(100, 100000), int(1000, 9999999), pick([5, 25, 35, 45, 75, 95, 105, 125, 250, 995, 1005, 2495])]);

const n = Number(countArg);
const cases = [];
for (let i = 0; i < n; i++) {
  const items = Array.from({ length: int(1, 6) }, () => ({
    unitPriceCents: String(prices()), quantity: pick(qtys), taxRate: pick(rates), taxType: pick(itemTax),
  }));
  const c = {
    taxRate: pick(rates), taxType: pick(invTax), items,
    discountType: pick(dtype), discountAmount: String(int(0, 50000)), discountPercent: pick(['0', '5', '10', '12.5', '15', '20', '2.5', '33.33']),
    shippingFee: pick([0, 0, 500, 1250, 99]),
    surchargeType: pick(dtype), surchargeAmount: String(int(0, 2000)), surchargePercent: pick(['0', '1', '2.5', '3']),
    includeTax: rnd() > 0.1,
  };
  const args = {
    taxRate: Number(c.taxRate), taxType: c.taxType,
    invoiceItems: items.map(it => ({ invoiceItemSnapshot: { unitPriceCents: it.unitPriceCents }, quantity: it.quantity, taxRate: Number(it.taxRate), taxType: it.taxType })),
    discountType: c.discountType, discountAmount: Number(c.discountAmount), discountPercent: Number(c.discountPercent),
    shippingFee: c.shippingFee, surchargeType: c.surchargeType, surchargeAmount: Number(c.surchargeAmount),
    surchargePercent: Number(c.surchargePercent), includeTax: c.includeTax,
  };
  const total = js.getInvoiceTotal(args);
  const perItem = args.invoiceItems.map(it => {
    const base = {
      taxRate: it.taxRate, unitPrice: Number(it.invoiceItemSnapshot.unitPriceCents), quantity: Number(it.quantity), taxType: it.taxType,
      invoiceItems: args.invoiceItems, discountType: args.discountType, discountAmount: args.discountAmount, discountPercent: args.discountPercent,
    };
    const td = js.getInvoiceItemLevelTaxDiscount(base);
    return { tax: td.tax, discount: td.discount, total: js.getInvoiceItemTotal({ ...base, includeTax: true }) };
  });
  cases.push({ in: c, js: { total, items: perItem } });
}
writeFileSync(outPath, JSON.stringify(cases));
console.log('wrote', cases.length, 'cases to', outPath);
