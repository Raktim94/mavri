import type { Adjustment, Currency, Doc, Line, Totals } from './types';

// The same rules as server/internal/money, used for the live totals in the
// editor. The server computes the authoritative figures when a document is saved.
// Half cents round away from zero.

const round = (n: number) => (n < 0 ? -Math.round(-n) : Math.round(n));
const percentOf = (base: number, pct: number) => round((base * pct) / 100);

const adjust = (a: Adjustment, base: number) =>
  a.mode === 'percent' ? percentOf(base, a.percent) : a.mode === 'fixed' ? a.cents : 0;

export const gross = (l: Pick<Line, 'quantity' | 'unitCents'>) => round(l.quantity * l.unitCents);

export function lineTax(l: Line): { net: number; tax: number } {
  const g = gross(l);
  if (l.taxMode === 'included' && l.taxRate > 0) {
    const t = round(g - g / (1 + l.taxRate / 100));
    return { net: g - t, tax: t };
  }
  if (l.taxMode === 'add' && l.taxRate > 0) return { net: g, tax: percentOf(g, l.taxRate) };
  return { net: g, tax: 0 };
}

export function computeTotals(
  d: Pick<Doc, 'lines' | 'discount' | 'surcharge' | 'shippingCents' | 'taxRate' | 'taxMode'>
): Totals {
  let subtotal = 0;
  let lineTaxSum = 0;
  for (const l of d.lines) {
    const { net, tax } = lineTax(l);
    subtotal += net;
    lineTaxSum += tax;
  }
  const discount = adjust(d.discount, subtotal);
  const surcharge = adjust(d.surcharge, subtotal);
  const base = subtotal - discount + surcharge;
  let docTax = 0;
  if (d.taxRate > 0 && d.taxMode === 'add') docTax = percentOf(base, d.taxRate);
  if (d.taxRate > 0 && d.taxMode === 'withheld') docTax = -percentOf(base, d.taxRate);
  let tax = lineTaxSum + docTax;
  if (d.taxRate > 0 && d.taxMode === 'included') tax = lineTaxSum + round(base - base / (1 + d.taxRate / 100));
  return {
    subtotalCents: subtotal,
    discountCents: discount,
    surchargeCents: surcharge,
    shippingCents: d.shippingCents,
    taxCents: tax,
    totalCents: base + lineTaxSum + docTax + d.shippingCents
  };
}

const group = (digits: string) => digits.replace(/\B(?=(\d{3})+(?!\d))/g, ',');

export function formatMoney(cents: number, c: Pick<Currency, 'symbol' | 'pattern' | 'decimals' | 'code'>): string {
  const neg = cents < 0;
  const abs = Math.abs(cents);
  const scale = 10 ** c.decimals;
  const whole = Math.floor(abs / scale);
  const frac = String(abs % scale).padStart(c.decimals, '0');
  const amount = group(String(whole)) + (c.decimals > 0 ? `.${frac}` : '');
  const out = (c.pattern || '{symbol}{amount}')
    .replace('{symbol}', c.symbol)
    .replace('{amount}', amount)
    .replace('{code}', c.code);
  return neg ? `-${out}` : out;
}

/** "12.5" -> 1250 for a currency with 2 decimals. */
export const toMinor = (text: string, decimals: number) => round((parseFloat(text) || 0) * 10 ** decimals);
/** 1250 -> "12.5" */
export const toMajor = (cents: number, decimals: number) => String(cents / 10 ** decimals);
