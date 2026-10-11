import { describe, expect, it, vi } from 'vitest';
import { DiscountType } from '../shared/enums/discountType';
import { InvoiceStatus } from '../shared/enums/invoiceStatus';
import { InvoiceType } from '../shared/enums/invoiceType';
import { InvoiceItemTaxType, InvoiceTaxType } from '../shared/enums/taxType';
import type { InvoiceFromData, InvoiceItem } from '../shared/types/invoice';
import { buildPdfTotalsRows, type PdfTotalsLabels } from '../pages/invoices/Preview/models/pdfTotalsModel';

const holder = vi.hoisted(() => ({
  financial: {
    formattedSubTotalAmount: 'SUB',
    discountAmountFormatted: 'DISC',
    formattedTotalTaxAmount: 'TAX',
    shippingAmountFormatted: 'SHIP',
    surchargeAmountFormatted: 'SUR',
    totalAmountFormatted: 'TOTAL',
    totalAmountPaidFormatted: 'PAID',
    balanceDueFormatted: 'BAL',
    shippingAmount: 0,
    surchargeAmount: 0,
    discountAmount: 0,
    totalTax: 0,
    totalAmountPaid: 0
  }
}));

vi.mock('../shared/utils/invoiceFunctions', () => ({
  getFinancialData: () => holder.financial
}));

const labels: PdfTotalsLabels = {
  subTotalLabel: 'Subtotal',
  discountLabel: 'Discount',
  surchargeLabel: 'Surcharge',
  incLabel: 'inc',
  taxLabel: 'Tax',
  taxExclusivePerItemLabel: '[excl.]',
  taxInclusivePerItemLabel: '[incl.]',
  shippingFeeLabel: 'Shipping',
  totalLabel: 'Total',
  paidLabel: 'Paid',
  balanceDueLabel: 'Balance due'
};

const invoice = (overrides: Partial<InvoiceFromData> = {}): InvoiceFromData =>
  ({
    invoiceType: InvoiceType.invoice,
    ...overrides
  }) as InvoiceFromData;

const item = (taxType?: InvoiceItemTaxType, taxRate = 10): InvoiceItem =>
  ({
    itemId: 1,
    quantity: '1',
    taxRate,
    taxType,
    invoiceItemSnapshot: { parentInvoiceItemId: 1, itemName: 'Widget', unitPriceCents: '1000' }
  }) as InvoiceItem;

const resetFinancial = () => {
  holder.financial = {
    formattedSubTotalAmount: 'SUB',
    discountAmountFormatted: 'DISC',
    formattedTotalTaxAmount: 'TAX',
    shippingAmountFormatted: 'SHIP',
    surchargeAmountFormatted: 'SUR',
    totalAmountFormatted: 'TOTAL',
    totalAmountPaidFormatted: 'PAID',
    balanceDueFormatted: 'BAL',
    shippingAmount: 0,
    surchargeAmount: 0,
    discountAmount: 0,
    totalTax: 0,
    totalAmountPaid: 0
  };
};

describe('buildPdfTotalsRows', () => {
  it('returns only the balance due row for a plain unpaid invoice', () => {
    resetFinancial();
    const rows = buildPdfTotalsRows(invoice(), undefined, labels);

    expect(rows.map(row => row.kind)).toEqual(['balanceDue']);
    expect(rows[0].label).toBe('Balance due');
    expect(rows[0].value).toBe('BAL');
    expect(rows[0].bold).toBe(true);
    expect(rows[0].accent).toBe(true);
  });

  it('returns only the total row for a quotation', () => {
    resetFinancial();
    const rows = buildPdfTotalsRows(invoice({ invoiceType: InvoiceType.quotation }), undefined, labels);

    expect(rows.map(row => row.kind)).toEqual(['total']);
    expect(rows[0].value).toBe('TOTAL');
    expect(rows[0].bold).toBe(true);
    expect(rows[0].accent).toBe(false);
  });

  it('omits every row without a form', () => {
    resetFinancial();
    expect(buildPdfTotalsRows(undefined, undefined, labels)).toEqual([]);
  });

  it('renders subtotal, discount, divider and balance when a discount applies', () => {
    resetFinancial();
    holder.financial.discountAmount = 500;

    const rows = buildPdfTotalsRows(invoice(), undefined, labels);

    expect(rows.map(row => row.kind)).toEqual(['subtotal', 'discount', 'divider', 'balanceDue']);
    expect(rows[0].value).toBe('SUB');
    expect(rows[1].label).toBe('Discount');
    expect(rows[1].value).toBe('DISC');
  });

  it('labels percentage discounts with the rate', () => {
    resetFinancial();
    holder.financial.discountAmount = 500;

    const rows = buildPdfTotalsRows(
      invoice({ discountType: DiscountType.percentage, discountPercent: 15 }),
      undefined,
      labels
    );

    expect(rows.find(row => row.kind === 'discount')?.label).toBe('Discount (15%)');
  });

  it('labels invoice level exclusive tax with the tax name and rate', () => {
    resetFinancial();
    holder.financial.totalTax = 100;

    const rows = buildPdfTotalsRows(
      invoice({ taxType: InvoiceTaxType.exclusive, taxRate: 10, taxName: 'VAT' }),
      undefined,
      labels
    );

    expect(rows.find(row => row.kind === 'tax')?.label).toBe('VAT (10%)');
    expect(rows.find(row => row.kind === 'tax')?.value).toBe('TAX');
  });

  it('falls back to the tax label without a tax name', () => {
    resetFinancial();
    holder.financial.totalTax = 100;

    const rows = buildPdfTotalsRows(invoice({ taxType: InvoiceTaxType.exclusive, taxRate: 20 }), undefined, labels);

    expect(rows.find(row => row.kind === 'tax')?.label).toBe('Tax (20%)');
  });

  it('marks inclusive invoice level tax', () => {
    resetFinancial();
    holder.financial.totalTax = 100;

    const rows = buildPdfTotalsRows(invoice({ taxType: InvoiceTaxType.inclusive, taxRate: 10 }), undefined, labels);

    expect(rows.find(row => row.kind === 'tax')?.label).toBe('Tax (inc 10%)');
  });

  it('uses per item tax markers without invoice level tax', () => {
    resetFinancial();
    holder.financial.totalTax = 100;

    const rows = buildPdfTotalsRows(invoice({ invoiceItems: [item(InvoiceItemTaxType.exclusive)] }), undefined, labels);

    expect(rows.find(row => row.kind === 'tax')?.label).toBe('[excl.]');
  });

  it('shows subtotal group, paid and balance rows when a payment exists', () => {
    resetFinancial();
    holder.financial.discountAmount = 100;
    holder.financial.totalAmountPaid = 900;

    const rows = buildPdfTotalsRows(invoice(), undefined, labels);

    expect(rows.map(row => row.kind)).toEqual(['subtotal', 'discount', 'divider', 'total', 'paid', 'balanceDue']);
    expect(rows.find(row => row.kind === 'paid')?.value).toBe('PAID');
    expect(rows.find(row => row.kind === 'paid')?.bold).toBe(false);
  });

  it('hides paid and balance rows once the invoice is paid', () => {
    resetFinancial();
    holder.financial.totalAmountPaid = 900;

    const rows = buildPdfTotalsRows(invoice({ status: InvoiceStatus.paid }), undefined, labels);

    expect(rows.map(row => row.kind)).toEqual(['total']);
  });

  it('keeps shipping and surcharge rows in the adjustment group', () => {
    resetFinancial();
    holder.financial.shippingAmount = 100;
    holder.financial.surchargeAmount = 50;

    const rows = buildPdfTotalsRows(
      invoice({ surchargeType: DiscountType.percentage, surchargePercent: 5 }),
      undefined,
      labels
    );

    expect(rows.map(row => row.kind)).toEqual(['subtotal', 'shipping', 'surcharge', 'divider', 'balanceDue']);
    expect(rows.find(row => row.kind === 'surcharge')?.label).toBe('Surcharge (5%)');
    expect(rows.find(row => row.kind === 'shipping')?.label).toBe('Shipping');
  });
});
