import { describe, expect, it } from 'vitest';
import { AmountFormat } from '../shared/enums/amountFormat';
import { DiscountType } from '../shared/enums/discountType';
import { InvoiceStatus } from '../shared/enums/invoiceStatus';
import { InvoiceType } from '../shared/enums/invoiceType';
import { ReportDateType } from '../shared/enums/reportDateType';
import { InvoiceItemTaxType, InvoiceTaxType } from '../shared/enums/taxType';
import type { Invoice, InvoiceItem, InvoicePayment } from '../shared/types/invoice';
import type { Settings } from '../shared/types/settings';
import {
  aggregateInvoicesByCurrency,
  calcDiscount,
  calcSurcharge,
  calcTax,
  calcUnitPrice,
  createCurrencyFormatter,
  getBalanceDue,
  getDaysLeft,
  getFinancialData,
  getInvoiceItemLevelTaxDiscount,
  getInvoiceItemTotal,
  getInvoiceTotal,
  getItemFinancialData,
  getPaidAmount,
  getPaidData,
  supportsCurrencySubunit
} from '../shared/utils/invoiceFunctions';

const settings = { amountFormat: AmountFormat.enUS } as Settings;

const usd = { currencyCode: 'USD', currencySymbol: '$', currencySubunit: 100 };

const lineItem = (unitPriceCents: string, quantity: string, taxRate = 10, taxType?: InvoiceItemTaxType): InvoiceItem =>
  ({
    itemId: 1,
    quantity,
    taxRate,
    taxType,
    invoiceItemSnapshot: { parentInvoiceItemId: 1, itemName: 'Widget', unitPriceCents }
  }) as InvoiceItem;

const payments = (...amountsCents: string[]): InvoicePayment[] =>
  amountsCents.map((amountCents, index) => ({
    amountCents,
    paidAt: `2026-02-0${index + 1}`,
    paymentMethod: 'cash'
  })) as unknown as InvoicePayment[];

const sampleInvoice = (overrides: Partial<Invoice> = {}): Invoice =>
  ({
    id: 1,
    invoiceType: InvoiceType.invoice,
    invoiceFullNumber: 'INV-0001',
    businessId: 1,
    clientId: 1,
    currencyId: 7,
    issuedAt: '2026-01-15T12:00:00.000Z',
    createdAt: '2026-01-15T12:00:00.000Z',
    updatedAt: '2026-01-15T12:00:00.000Z',
    invoiceNumber: '0001',
    isArchived: false,
    status: InvoiceStatus.unpaid,
    discountAmountCents: '0',
    discountPercent: 0,
    surchargeAmountCents: '0',
    surchargePercent: 0,
    shippingFeeCents: '0',
    taxRate: 0,
    currencyFormat: '{symbol}{amount}',
    invoicePayments: [],
    invoiceItems: [],
    invoiceAttachments: [],
    invoiceCurrencySnapshot: usd,
    ...overrides
  }) as Invoice;

describe('getDaysLeft', () => {
  it('returns zero when no due date is provided', () => {
    expect(getDaysLeft()).toBe(0);
  });

  it('counts calendar days between the due date and today', () => {
    const today = new Date();
    const due = new Date(today.getFullYear(), today.getMonth(), today.getDate() + 10);
    const iso = due.toISOString();

    expect(getDaysLeft(iso)).toBe(10);
  });
});

describe('calcUnitPrice', () => {
  it('divides by the subunit when subunits are supported', () => {
    expect(calcUnitPrice({ supportsSubunit: true, amountCents: 1050, subunit: 100 })).toBe(10.5);
  });

  it('collapses to zero when the subunit is zero', () => {
    expect(calcUnitPrice({ supportsSubunit: true, amountCents: 1050, subunit: 0 })).toBe(0);
  });

  it('passes the raw amount through without subunit support', () => {
    expect(calcUnitPrice({ supportsSubunit: false, amountCents: 1050, subunit: 100 })).toBe(1050);
    expect(calcUnitPrice({ amountCents: 42 })).toBe(42);
  });
});

describe('calcTax', () => {
  it('returns zero without a tax type', () => {
    expect(calcTax(1000, 10)).toBe(0);
  });

  it('applies exclusive tax on top of the amount', () => {
    expect(calcTax(1000, 10, InvoiceTaxType.exclusive)).toBe(100);
    expect(calcTax(1000, 10, InvoiceItemTaxType.exclusive)).toBe(100);
  });

  it('extracts inclusive tax from the amount', () => {
    expect(calcTax(1100, 10, InvoiceTaxType.inclusive)).toBe(100);
    expect(calcTax(1100, 10, InvoiceItemTaxType.inclusive)).toBe(100);
  });

  it('negates deducted tax', () => {
    expect(calcTax(1000, 10, InvoiceTaxType.deducted)).toBe(-100);
  });

  it('falls back to zero for unknown tax types', () => {
    expect(calcTax(1000, 10, 'bogus' as InvoiceTaxType)).toBe(0);
  });
});

describe('calcDiscount and calcSurcharge', () => {
  it('supports fixed amounts', () => {
    expect(calcDiscount({ subTotal: 1000, discountType: DiscountType.fixed, discountAmount: 120 })).toBe(120);
    expect(calcSurcharge({ subTotal: 1000, surchargeType: DiscountType.fixed, surchargeAmount: 50 })).toBe(50);
  });

  it('supports percentages', () => {
    expect(calcDiscount({ subTotal: 1000, discountType: DiscountType.percentage, discountPercent: 15 })).toBe(150);
    expect(calcSurcharge({ subTotal: 1000, surchargeType: DiscountType.percentage, surchargePercent: 7.5 })).toBe(75);
  });

  it('returns zero without a type or amount', () => {
    expect(calcDiscount({ subTotal: 1000 })).toBe(0);
    expect(calcDiscount({ subTotal: 1000, discountType: DiscountType.fixed })).toBe(0);
    expect(calcSurcharge({ subTotal: 1000, surchargeType: DiscountType.percentage })).toBe(0);
  });
});

describe('getInvoiceItemTotal', () => {
  const items = [lineItem('10000', '2', 10, InvoiceItemTaxType.exclusive), lineItem('5000', '3', 5)];

  it('prorates the invoice discount and adds exclusive tax', () => {
    const total = getInvoiceItemTotal({
      taxRate: 10,
      unitPrice: 10000,
      quantity: 2,
      taxType: InvoiceItemTaxType.exclusive,
      invoiceItems: items,
      discountType: DiscountType.percentage,
      discountPercent: 10
    });

    expect(total).toBe(19800);
  });

  it('keeps inclusive lines at their discounted value', () => {
    const total = getInvoiceItemTotal({
      taxRate: 10,
      unitPrice: 10000,
      quantity: 2,
      taxType: InvoiceItemTaxType.inclusive,
      invoiceItems: items,
      includeTax: false
    });

    expect(total).toBe(20000);
  });

  it('skips tax when includeTax is false', () => {
    const total = getInvoiceItemTotal({
      taxRate: 10,
      unitPrice: 10000,
      quantity: 2,
      taxType: InvoiceItemTaxType.exclusive,
      invoiceItems: items,
      includeTax: false
    });

    expect(total).toBe(20000);
  });
});

describe('getInvoiceItemLevelTaxDiscount', () => {
  it('splits the prorated discount and tax for the line', () => {
    const result = getInvoiceItemLevelTaxDiscount({
      taxRate: 10,
      unitPrice: 10000,
      quantity: 2,
      taxType: InvoiceItemTaxType.exclusive,
      invoiceItems: [lineItem('10000', '2'), lineItem('5000', '3')],
      discountType: DiscountType.percentage,
      discountPercent: 10
    });

    expect(result.discount).toBe(2000);
    expect(result.tax).toBe(1800);
  });

  it('returns zeros for an empty invoice', () => {
    expect(getInvoiceItemLevelTaxDiscount({ taxRate: 0, unitPrice: 0, quantity: 0, invoiceItems: [] })).toEqual({
      tax: 0,
      discount: 0
    });
  });
});

describe('getInvoiceTotal and getBalanceDue', () => {
  const items = [lineItem('10000', '2', 10, InvoiceItemTaxType.exclusive), lineItem('5000', '3', 5)];

  it('adds exclusive invoice tax on the discounted subtotal', () => {
    expect(getInvoiceTotal({ taxRate: 10, taxType: InvoiceTaxType.exclusive, invoiceItems: items })).toBe(40500);
  });

  it('never adds tax again for inclusive totals', () => {
    expect(getInvoiceTotal({ taxRate: 10, taxType: InvoiceTaxType.inclusive, invoiceItems: items })).toBe(35000);
  });

  it('includes shipping and surcharge after the discount', () => {
    const total = getInvoiceTotal({
      taxRate: 10,
      taxType: InvoiceTaxType.deducted,
      invoiceItems: items,
      shippingFee: 500,
      surchargeType: DiscountType.percentage,
      surchargePercent: 5
    });

    expect(total).toBe(35750);
  });

  it('subtracts payments from the total', () => {
    const balance = getBalanceDue({
      taxRate: 10,
      taxType: InvoiceTaxType.exclusive,
      invoiceItems: items,
      shippingFee: 300,
      invoicePayments: payments('1000')
    });

    expect(balance).toBe(39800);
  });
});

describe('getPaidAmount', () => {
  it('sums payment amounts including fractional cents strings', () => {
    expect(getPaidAmount([])).toBe(0);
    expect(getPaidAmount(payments('100', '250.5'))).toBe(350.5);
  });
});

describe('currency helpers', () => {
  it('detects subunit support only with full currency metadata', () => {
    expect(supportsCurrencySubunit({ storeSettings: settings, ...usd, currencyFormat: '{symbol}{amount}' })).toBe(true);
    expect(supportsCurrencySubunit({ storeSettings: undefined, ...usd, currencyFormat: '{symbol}{amount}' })).toBe(
      false
    );
    expect(supportsCurrencySubunit({ storeSettings: settings, currencySymbol: undefined })).toBe(false);
  });

  it('formats amounts with and without subunit support', () => {
    const withSubunit = createCurrencyFormatter({
      storeSettings: settings,
      ...usd,
      currencyFormat: '{symbol}{amount}'
    });
    const withoutSubunit = createCurrencyFormatter({ storeSettings: { amountFormat: AmountFormat.ltLT } as Settings });

    expect(withSubunit(1234.5)).toBe('$1,234.50');
    expect(withoutSubunit(999.99)).toBe('999,99');
  });

  it('derives the paid amount from a payment record', () => {
    const paid = getPaidData({
      storeSettings: settings,
      ...usd,
      currencyFormat: '{symbol}{amount}',
      invoicePayment: payments('12345')[0]
    });

    expect(paid.amountPaid).toBe(123.45);
    expect(paid.amountPaidFormatted).toBe('$123.45');
  });
});

describe('getFinancialData', () => {
  const items = [lineItem('10000', '2', 10, InvoiceItemTaxType.exclusive), lineItem('5000', '3', 5)];

  it('aggregates subtotal, item tax, invoice tax, fees and payments', () => {
    const financial = getFinancialData({
      storeSettings: settings,
      ...usd,
      currencyFormat: '{symbol}{amount}',
      invoiceItems: items,
      taxRate: 10,
      taxType: InvoiceTaxType.exclusive,
      discountType: DiscountType.percentage,
      discountPercent: 10,
      shippingAmount: 500,
      surchargeType: DiscountType.fixed,
      surchargeAmount: 250,
      invoicePayments: payments('1000')
    });

    expect(financial.subTotalAmount).toBe(350);
    expect(financial.totalTax).toBe(49.5);
    expect(financial.discountAmount).toBe(35);
    expect(financial.shippingAmount).toBe(5);
    expect(financial.surchargeAmount).toBe(2.5);
    expect(financial.totalAmount).toBe(372);
    expect(financial.totalAmountPaid).toBe(10);
    expect(financial.balanceDue).toBe(362);
    expect(financial.formattedSubTotalAmount).toBe('$350.00');
    expect(financial.totalAmountFormatted).toBe('$372.00');
    expect(financial.balanceDueFormatted).toBe('$362.00');
  });

  it('folds inclusive tax into the totals', () => {
    const financial = getFinancialData({
      storeSettings: settings,
      ...usd,
      currencyFormat: '{symbol}{amount}',
      invoiceItems: [lineItem('1999', '1', 20, InvoiceItemTaxType.inclusive)],
      taxRate: 20,
      taxType: InvoiceTaxType.inclusive,
      invoicePayments: []
    });

    expect(financial.subTotalAmount).toBe(19.99);
    expect(financial.totalAmount).toBe(19.99);
    expect(financial.totalAmountPaid).toBe(0);
    expect(financial.balanceDue).toBe(19.99);
  });
});

describe('getItemFinancialData', () => {
  it('reports unit price, line total, tax and discount', () => {
    const itemFinancial = getItemFinancialData({
      storeSettings: settings,
      ...usd,
      currencyFormat: '{symbol}{amount}',
      unitPrice: 10000,
      quantity: 2,
      taxRate: 10,
      taxType: InvoiceItemTaxType.exclusive,
      invoiceItems: [lineItem('10000', '2'), lineItem('5000', '3')],
      discountType: DiscountType.percentage,
      discountPercent: 10
    });

    expect(itemFinancial.unitPrice).toBe(100);
    expect(itemFinancial.totalUnitPrice).toBe(200);
    expect(itemFinancial.itemDiscountAmount).toBe(20);
    expect(itemFinancial.invoiceTaxAmount).toBe(18);
    expect(itemFinancial.formattedTotal).toBe('$200.00');
  });
});

describe('aggregateInvoicesByCurrency', () => {
  const rangeFrom = '2026-01-01T00:00:00.000Z';
  const rangeTo = '2026-12-31T00:00:00.000Z';

  it('groups issued invoices by currency and computes collection metrics', () => {
    const grouped = aggregateInvoicesByCurrency(
      [
        sampleInvoice(),
        sampleInvoice({
          id: 2,
          status: InvoiceStatus.paid,
          paidAt: '2026-01-20T00:00:00.000Z',
          invoiceItems: [lineItem('10000', '2', 10, InvoiceItemTaxType.exclusive), lineItem('5000', '3', 5)],
          invoicePayments: payments('40000')
        }),
        sampleInvoice({ id: 99, issuedAt: '2019-05-05T00:00:00.000Z' })
      ],
      rangeFrom,
      rangeTo,
      ReportDateType.issuedAt
    );

    expect(Object.keys(grouped)).toEqual(['USD']);
    expect(grouped.USD.invoiceCount).toBe(2);
    expect(grouped.USD.totalAmount).toBe(370);
    expect(grouped.USD.totalAmountPaid).toBe(400);
    expect(grouped.USD.balanceDue).toBe(-30);
    expect(grouped.USD.collectionRate).toBeCloseTo(108.10810810810811);
    expect(grouped.USD.avgPerInvoice).toBe(200);
  });

  it('counts overdue invoices and honours the paid date filter', () => {
    const grouped = aggregateInvoicesByCurrency(
      [
        sampleInvoice({
          invoiceItems: [lineItem('1999', '1', 20)],
          invoiceCurrencySnapshot: { currencyCode: 'EUR', currencySymbol: '€', currencySubunit: 100 },
          dueDate: '2020-01-01'
        }),
        sampleInvoice({ id: 2, paidAt: '2026-01-20T00:00:00.000Z', invoicePayments: payments('1999') })
      ],
      rangeFrom,
      rangeTo,
      ReportDateType.paidAt
    );

    expect(grouped.USD.invoiceCount).toBe(1);
    expect(grouped.EUR).toBeUndefined();

    const issued = aggregateInvoicesByCurrency(
      [
        sampleInvoice({
          invoiceItems: [lineItem('1999', '1', 20)],
          invoiceCurrencySnapshot: { currencyCode: 'EUR', currencySymbol: '€', currencySubunit: 100 },
          dueDate: '2020-01-01'
        })
      ],
      rangeFrom,
      rangeTo,
      ReportDateType.issuedAt
    );

    expect(issued.EUR.overdueCount).toBe(1);
    expect(issued.EUR.totalAmount).toBe(19.99);
  });
});
