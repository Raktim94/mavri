import type { Row } from './api';
import type { Currency } from './money';

export type Kind = 'invoice' | 'quotation';
export const statuses: Record<Kind, string[]> = {
  invoice: ['unpaid', 'partially', 'paid', 'closed'],
  quotation: ['open', 'closed']
};
export const statusLabel: Record<string, string> = {
  unpaid: 'Unpaid',
  partially: 'Partly paid',
  paid: 'Paid',
  closed: 'Closed',
  open: 'Open'
};

export const asNumber = (v: unknown) => Number(v ?? 0) || 0;
export const text = (v: unknown) => (v == null ? '' : String(v));
export const day = (v: unknown) => text(v).slice(0, 10);

export const currencyOf = (inv: Row): Currency => {
  const s = (inv.invoiceCurrencySnapshot ?? {}) as Row;
  return {
    code: text(s.currencyCode),
    symbol: text(s.currencySymbol),
    subunit: asNumber(s.currencySubunit) || 100,
    format: text(inv.currencyFormat) || undefined
  };
};

export const itemsOf = (inv: Row) => (inv.invoiceItems ?? []) as Row[];
export const paymentsOf = (inv: Row) => (inv.invoicePayments ?? []) as Row[];
export const paidCents = (inv: Row) => paymentsOf(inv).reduce((s, p) => s + asNumber(p.amountCents), 0);

import { computeTotals, type Line } from './money';

export const linesOf = (inv: Row): Line[] =>
  itemsOf(inv).map(l => ({
    quantity: asNumber(l.quantity),
    unitPriceCents: asNumber(((l.invoiceItemSnapshot ?? {}) as Row).unitPriceCents),
    taxRate: asNumber(l.taxRate),
    taxType: (l.taxType as Line['taxType']) ?? null
  }));

export const totalsOf = (inv: Row) =>
  computeTotals(
    linesOf(inv),
    {
      type: (inv.discountType as 'fixed' | 'percentage' | null) ?? null,
      cents: asNumber(inv.discountAmountCents),
      percent: asNumber(inv.discountPercent)
    },
    {
      type: (inv.surchargeType as 'fixed' | 'percentage' | null) ?? null,
      cents: asNumber(inv.surchargeAmountCents),
      percent: asNumber(inv.surchargePercent)
    },
    asNumber(inv.shippingFeeCents),
    { rate: asNumber(inv.taxRate), type: (inv.taxType as string | null) ?? null }
  );
