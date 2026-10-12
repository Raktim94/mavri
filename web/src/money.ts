// Money is handled as whole minor units (cents); only the final display divides.
export type Currency = { code: string; symbol: string; subunit: number; format?: string };

export type Line = {
  quantity: number;
  unitPriceCents: number;
  taxRate: number;
  taxType: 'exclusive' | 'inclusive' | null;
};
export type Adjust = { type: 'fixed' | 'percentage' | null; cents: number; percent: number };
export type Totals = {
  subtotal: number;
  discount: number;
  surcharge: number;
  shipping: number;
  tax: number;
  total: number;
};

const adjustment = (a: Adjust, base: number) =>
  a.type === 'percentage' ? Math.round((base * a.percent) / 100) : a.type === 'fixed' ? a.cents : 0;

export function computeTotals(
  lines: Line[],
  discount: Adjust,
  surcharge: Adjust,
  shippingCents: number,
  docTax: { rate: number; type: string | null }
): Totals {
  let subtotal = 0;
  let lineTax = 0;
  for (const l of lines) {
    const gross = Math.round(l.quantity * l.unitPriceCents);
    const rate = l.taxRate || 0;
    if (l.taxType === 'inclusive' && rate) {
      const t = Math.round(gross - gross / (1 + rate / 100));
      subtotal += gross - t;
      lineTax += t;
    } else {
      subtotal += gross;
      if (l.taxType === 'exclusive' && rate) lineTax += Math.round((gross * rate) / 100);
    }
  }
  const disc = adjustment(discount, subtotal);
  const sur = adjustment(surcharge, subtotal);
  const base = subtotal - disc + sur;
  let docTaxAmount = 0;
  if (docTax.rate && docTax.type === 'exclusive') docTaxAmount = Math.round((base * docTax.rate) / 100);
  else if (docTax.rate && docTax.type === 'deducted') docTaxAmount = -Math.round((base * docTax.rate) / 100);
  return {
    subtotal,
    discount: disc,
    surcharge: sur,
    shipping: shippingCents,
    tax: lineTax + docTaxAmount,
    total: base + lineTax + docTaxAmount + shippingCents
  };
}

export function formatMoney(cents: number, c: Currency): string {
  const digits = Math.max(0, Math.round(Math.log10(c.subunit || 1)));
  const amount = (cents / (c.subunit || 1)).toLocaleString(undefined, {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits
  });
  return (c.format ?? '{symbol}{amount}').replace('{symbol}', c.symbol).replace('{amount}', amount);
}

export const toCents = (text: string, subunit: number) => Math.round((parseFloat(text) || 0) * subunit);
export const fromCents = (cents: number, subunit: number) => String(cents / (subunit || 1));
