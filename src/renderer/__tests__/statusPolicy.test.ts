import { describe, expect, it } from 'vitest';
import { InvoiceStatus } from '../shared/enums/invoiceStatus';
import { InvoiceType } from '../shared/enums/invoiceType';
import { PaymentType } from '../shared/enums/paymentType';
import type { InvoiceFromData, InvoicePayment } from '../shared/types/invoice';
import { statusAfterClosedOff } from '../pages/invoices/Form/financial/statusPolicy';

const lineItem = {
  itemId: 1,
  quantity: '1',
  taxRate: 0,
  invoiceItemSnapshot: { parentInvoiceItemId: 1, itemName: 'Widget', unitPriceCents: '1000' }
} as never;

const payment = (amountCents: string): InvoicePayment => ({
  amountCents,
  paidAt: '2026-01-01',
  paymentMethod: PaymentType.cash
});

const base = (overrides: Partial<InvoiceFromData> = {}): InvoiceFromData => ({
  invoiceType: InvoiceType.invoice,
  invoiceItems: [lineItem],
  invoicePayments: [],
  taxRate: 0,
  discountAmountCents: '0',
  discountPercent: 0,
  shippingFeeCents: '0',
  ...overrides
});

describe('statusAfterClosedOff', () => {
  it('returns open for quotations', () => {
    expect(statusAfterClosedOff(base({ invoiceType: InvoiceType.quotation }))).toBe(InvoiceStatus.open);
  });

  it('returns unpaid without payments', () => {
    expect(statusAfterClosedOff(base())).toBe(InvoiceStatus.unpaid);
  });

  it('returns partially paid when money is still due', () => {
    expect(statusAfterClosedOff(base({ invoicePayments: [payment('400')] }))).toBe(InvoiceStatus.partiallyPaid);
  });

  it('returns paid when the balance is settled', () => {
    expect(statusAfterClosedOff(base({ invoicePayments: [payment('1000')] }))).toBe(InvoiceStatus.paid);
  });

  it('returns unpaid for an empty draft', () => {
    expect(statusAfterClosedOff(undefined)).toBe(InvoiceStatus.unpaid);
  });
});
