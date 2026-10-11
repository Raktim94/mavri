import { describe, expect, it } from 'vitest';
import { AmountFormat } from '../shared/enums/amountFormat';
import { DiscountType } from '../shared/enums/discountType';
import { InvoiceStatus } from '../shared/enums/invoiceStatus';
import { InvoiceType } from '../shared/enums/invoiceType';
import { InvoiceItemTaxType, InvoiceTaxType } from '../shared/enums/taxType';
import { buildReceiptHtml, type ReceiptTexts } from '../shared/utils/receiptFunctions';
import type { InvoiceFromData, InvoiceItem } from '../shared/types/invoice';
import type { Settings } from '../shared/types/settings';

const settings = { amountFormat: AmountFormat.enUS, dateFormat: 'MM/dd/yyyy' } as Settings;

const texts: ReceiptTexts = {
  invoiceLabel: 'Invoice',
  quoteLabel: 'Quote',
  issuedAtLabel: 'Issued',
  billToLabel: 'Bill to',
  itemLabel: 'Item',
  qtyLabel: 'Qty',
  unitCostLabel: 'Unit cost',
  subTotalLabel: 'Subtotal',
  discountLabel: 'Discount',
  surchargeLabel: 'Surcharge',
  incLabel: 'inc',
  taxLabel: 'Tax',
  taxExclusivePerItemLabel: 'Tax (excl.)',
  taxInclusivePerItemLabel: 'Tax (incl.)',
  shippingFeeLabel: 'Shipping',
  totalLabel: 'Total',
  paidLabel: 'Paid',
  balanceDueLabel: 'Balance due'
};

const itemsA: InvoiceItem[] = [
  {
    itemId: 1,
    quantity: '2',
    taxRate: 10,
    taxType: InvoiceItemTaxType.exclusive,
    invoiceItemSnapshot: { parentInvoiceItemId: 1, itemName: 'Widget', unitName: 'pcs', unitPriceCents: '10000' }
  },
  {
    itemId: 2,
    quantity: '3',
    taxRate: 5,
    invoiceItemSnapshot: { parentInvoiceItemId: 2, itemName: 'Widget', unitName: 'pcs', unitPriceCents: '5000' }
  }
] as unknown as InvoiceItem[];

const itemsB = [
  {
    itemId: 3,
    quantity: '1',
    taxRate: 20,
    taxType: InvoiceItemTaxType.inclusive,
    invoiceItemSnapshot: { parentInvoiceItemId: 3, itemName: 'Widget', unitName: 'pcs', unitPriceCents: '1999' }
  }
] as unknown as InvoiceItem[];

const form = {
  invoiceType: InvoiceType.invoice,
  status: InvoiceStatus.unpaid,
  invoicePrefix: 'INV-',
  invoiceNumber: '0007',
  invoiceSuffix: '',
  issuedAt: '2026-03-04T10:00:00.000Z',
  taxRate: 10,
  taxType: InvoiceTaxType.exclusive,
  taxName: 'VAT',
  discountType: DiscountType.percentage,
  discountPercent: 5,
  discountAmountCents: '0',
  shippingFeeCents: '700',
  surchargeType: DiscountType.fixed,
  surchargeAmountCents: '150',
  surchargePercent: 0,
  currencyFormat: '{symbol}{amount}',
  invoiceItems: itemsA,
  invoicePayments: [{ amountCents: '5000', paidAt: '2026-03-05', paymentMethod: 'cash' }],
  invoiceCurrencySnapshot: { currencyCode: 'USD', currencySymbol: '$', currencySubunit: 100 },
  invoiceBusinessSnapshot: {
    businessName: 'Acme & Co <b>',
    businessAddress: '1 Road',
    businessPhone: '123',
    businessEmail: 'a@b.co'
  },
  invoiceClientSnapshot: { clientName: 'Client "X"', clientAddress: '2 Road' }
} as unknown as InvoiceFromData;

const totals = (html: string) =>
  Array.from(html.matchAll(/<div class="totals-row(?:[^"]*)">\s*<span>([^<]*)<\/span>\s*<span>([^<]*)<\/span>/g)).map(
    match => [match[1], match[2]] as const
  );

describe('buildReceiptHtml', () => {
  const html = buildReceiptHtml({ invoiceForm: form, storeSettings: settings, texts });

  it('renders a printable 80mm document', () => {
    expect(html.startsWith('<!DOCTYPE html>')).toBe(true);
    expect(html).toContain('size: 80mm auto;');
    expect(html.trimEnd().endsWith('</html>')).toBe(true);
  });

  it('escapes business and client names', () => {
    expect(html).toContain('<title>Acme &amp; Co &lt;b&gt;</title>');
    expect(html).not.toContain('<b></b>');
    expect(html).toContain('Client &quot;X&quot;');
  });

  it('renders the invoice number and formatted issue date', () => {
    expect(html).toContain('Invoice #INV-0007');
    expect(html).toContain('Issued: 03/04/2026');
    expect(html).toContain('Bill to:');
  });

  it('renders item lines with quantity and formatted amounts', () => {
    expect(html).toContain('<span>2 x $100.00</span>');
    expect(html).toContain('<span>3 x $50.00</span>');
    expect(html).toContain('Widget');
  });

  it('renders subtotal, discount, invoice tax, fees and payments', () => {
    expect(totals(html)).toEqual([
      ['Subtotal', '$350.00'],
      ['Discount (5%)', '-$17.50'],
      ['VAT (10%)', '$52.25'],
      ['Shipping', '$7.00'],
      ['Surcharge', '-$1.50'],
      ['Total', '$393.25'],
      ['Paid', '$50.00'],
      ['Balance due', '$343.25']
    ]);
  });

  it('renders per-item inclusive tax labels when the invoice tax type is absent', () => {
    const perItemHtml = buildReceiptHtml({
      invoiceForm: {
        ...form,
        taxType: undefined,
        taxName: undefined,
        invoiceItems: itemsA.map(item => ({ ...item, taxType: InvoiceItemTaxType.inclusive }))
      } as InvoiceFromData,
      storeSettings: settings,
      texts
    });

    expect(totals(perItemHtml)).toEqual([
      ['Subtotal', '$350.00'],
      ['Discount (5%)', '-$17.50'],
      ['Tax (incl.)', '$24.06'],
      ['Shipping', '$7.00'],
      ['Surcharge', '-$1.50'],
      ['Total', '$341.00'],
      ['Paid', '$50.00'],
      ['Balance due', '$291.00']
    ]);
  });

  it('renders quotes with the quote label and no payment rows when nothing was paid', () => {
    const quoteHtml = buildReceiptHtml({
      invoiceForm: {
        ...form,
        invoiceType: InvoiceType.quotation,
        status: InvoiceStatus.paid,
        taxType: undefined,
        invoiceItems: itemsB,
        invoicePayments: []
      } as InvoiceFromData,
      storeSettings: settings,
      texts
    });

    expect(quoteHtml).toContain('Quote #INV-0007');
    expect(quoteHtml).not.toContain('Invoice #INV-0007');
    expect(quoteHtml).toContain('<span>1 x $19.99</span>');
    expect(quoteHtml).not.toContain('>Total<');
    expect(quoteHtml).not.toContain('>Paid<');
    expect(quoteHtml).not.toContain('>Balance due<');
    expect(totals(quoteHtml)).toEqual([
      ['Subtotal', '$19.99'],
      ['Discount (5%)', '-$1.00'],
      ['Tax (incl.)', '$3.17'],
      ['Shipping', '$7.00'],
      ['Surcharge', '-$1.50']
    ]);
  });
});
