import { describe, expect, it } from 'vitest';
import { DiscountType } from '../shared/enums/discountType';
import { InvoiceType } from '../shared/enums/invoiceType';
import { InvoiceItemTaxType, InvoiceTaxType } from '../shared/enums/taxType';
import type { InvoiceFromData, InvoiceItem } from '../shared/types/invoice';
import {
  buildSummaryRows,
  discountRowLabel,
  paidDropdownTarget,
  perItemTaxFlags,
  surchargeRowLabel,
  taxRowLabel,
  type SummaryAmounts
} from '../pages/invoices/Form/financial/financialPanel';

const t = (key: string, options?: Record<string, unknown>) =>
  options
    ? `${key}(${Object.entries(options)
        .map(([k, v]) => `${k}=${String(v)}`)
        .join(',')})`
    : key;

const item = (overrides: Partial<InvoiceItem> = {}): InvoiceItem =>
  ({
    itemId: 1,
    quantity: '1',
    taxRate: 0,
    invoiceItemSnapshot: { parentInvoiceItemId: 1, itemName: 'Widget', unitPriceCents: '1000' },
    ...overrides
  }) as InvoiceItem;

const form = (overrides: Partial<InvoiceFromData> = {}): InvoiceFromData => ({ ...overrides });

const amounts: SummaryAmounts = {
  formattedSubTotalAmount: 'SUB',
  discountAmountFormatted: 'DISC',
  formattedTotalTaxAmount: 'TAX',
  shippingAmountFormatted: 'SHIP',
  surchargeAmountFormatted: 'SUR',
  totalAmountFormatted: 'TOTAL',
  totalAmountPaidFormatted: 'PAID',
  balanceDueFormatted: 'BAL'
};

describe('discountRowLabel', () => {
  it('uses the percentage label for percentage discounts', () => {
    expect(discountRowLabel(t, form({ discountType: DiscountType.percentage, discountPercent: 10 }))).toBe(
      'invoices.discountPrct(prct=10)'
    );
  });

  it('uses the plain label otherwise', () => {
    expect(discountRowLabel(t, form())).toBe('invoices.discount');
    expect(discountRowLabel(t, form({ discountType: DiscountType.fixed }))).toBe('invoices.discount');
  });
});

describe('surchargeRowLabel', () => {
  it('uses the percentage label for percentage surcharges', () => {
    expect(surchargeRowLabel(t, form({ surchargeType: DiscountType.percentage, surchargePercent: 5 }))).toBe(
      'invoices.surchargePrct(prct=5)'
    );
  });

  it('uses the plain label otherwise', () => {
    expect(surchargeRowLabel(t, form())).toBe('invoices.surcharge');
  });
});

describe('taxRowLabel', () => {
  it('falls back to a generic tax label when nothing is configured', () => {
    expect(taxRowLabel(t, form())).toBe('invoices.tax(prct=0)');
    expect(taxRowLabel(t, form({ taxRate: 21 }))).toBe('invoices.tax(prct=21)');
  });

  it('uses the exclusive label with a tax name', () => {
    expect(taxRowLabel(t, form({ taxType: InvoiceTaxType.exclusive, taxName: 'VAT', taxRate: 21 }))).toBe(
      'invoices.taxExclusive(name=VAT,prct=21)'
    );
    expect(taxRowLabel(t, form({ taxType: InvoiceTaxType.deducted, taxRate: 10 }))).toBe('invoices.tax(prct=10)');
  });

  it('uses the inclusive labels', () => {
    expect(taxRowLabel(t, form({ taxType: InvoiceTaxType.inclusive, taxName: 'GST', taxRate: 10 }))).toBe(
      'invoices.taxInclusive(name=GST,prct=10)'
    );
    expect(taxRowLabel(t, form({ taxType: InvoiceTaxType.inclusive, taxRate: 10 }))).toBe(
      'invoices.taxInclusivePlaceholder(prct=10)'
    );
  });

  it('adds per-item markers and skips the generic label then', () => {
    expect(taxRowLabel(t, form({ invoiceItems: [item({ taxType: InvoiceItemTaxType.exclusive, taxRate: 5 })] }))).toBe(
      'invoices.taxExclusivePerItem'
    );
    expect(taxRowLabel(t, form({ invoiceItems: [item({ taxType: InvoiceItemTaxType.inclusive, taxRate: 5 })] }))).toBe(
      'invoices.taxInclusivePerItem'
    );
    expect(
      taxRowLabel(
        t,
        form({
          taxRate: 21,
          invoiceItems: [
            item({ itemId: 1, taxType: InvoiceItemTaxType.exclusive, taxRate: 5 }),
            item({ itemId: 2, taxType: InvoiceItemTaxType.inclusive, taxRate: 5 })
          ]
        })
      )
    ).toBe('invoices.taxExclusivePerIteminvoices.taxInclusivePerItem');
  });
});

describe('perItemTaxFlags', () => {
  it('detects item level tax modes', () => {
    expect(perItemTaxFlags([])).toEqual({ exclusive: false, inclusive: false });
    expect(perItemTaxFlags([item({ taxType: InvoiceItemTaxType.exclusive })])).toEqual({
      exclusive: true,
      inclusive: false
    });
    expect(perItemTaxFlags([item({ itemId: 1, taxType: InvoiceItemTaxType.exclusive }), item({ itemId: 2 })])).toEqual({
      exclusive: true,
      inclusive: false
    });
  });
});

describe('paidDropdownTarget', () => {
  it('opens the add drawer for an empty payment list', () => {
    expect(paidDropdownTarget(undefined)).toBe('list');
    expect(paidDropdownTarget([])).toBe('add');
    expect(paidDropdownTarget([{ amountCents: '1', paidAt: '', paymentMethod: 'cash' } as never])).toBe('list');
  });
});

describe('buildSummaryRows', () => {
  it('builds the full invoice row set in order', () => {
    const rows = buildSummaryRows({ t, form: form({ invoiceType: InvoiceType.invoice }), amounts });

    expect(rows.map(row => row.id)).toEqual([
      'subtotal',
      'discount',
      'tax',
      'shipping',
      'surcharge',
      'total',
      'paid',
      'balance'
    ]);
    expect(rows.find(row => row.id === 'subtotal')).toMatchObject({ value: 'SUB', emphasized: true });
    expect(rows.find(row => row.id === 'tax')).toMatchObject({ editable: 'tax' });
    expect(rows.find(row => row.id === 'balance')).toMatchObject({ value: 'BAL', emphasized: true });
    expect(rows.find(row => row.id === 'total')).toMatchObject({ emphasized: true });
    expect(rows.find(row => row.id === 'discount')?.editable).toBe('discount');
    expect(rows.find(row => row.id === 'paid')?.editable).toBe('paid');
  });

  it('drops paid and balance rows for quotations', () => {
    const rows = buildSummaryRows({ t, form: form(), amounts });
    expect(rows.map(row => row.id)).toEqual(['subtotal', 'discount', 'tax', 'shipping', 'surcharge', 'total']);
  });
});
