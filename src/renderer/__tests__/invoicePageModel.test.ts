import { describe, expect, it } from 'vitest';
import type { TFunction } from 'i18next';
import { FilterType } from '../shared/enums/filterType';
import { InvoiceStatus } from '../shared/enums/invoiceStatus';
import { InvoiceType } from '../shared/enums/invoiceType';
import type { Invoice, InvoiceItem } from '../shared/types/invoice';
import {
  buildExportSheets,
  buildInvoiceFilterSet,
  invoicePageCopy,
  invoiceSortOptions
} from '../pages/invoices/invoicePageModel';

const t = ((key: string) => key) as unknown as TFunction;

const options = {
  clients: [{ label: 'Acme', value: 1 }],
  businesses: [{ label: 'Shop', value: 2 }]
};

describe('buildInvoiceFilterSet', () => {
  it('offers the shared filters first and marks the active one as initial', () => {
    const filters = buildInvoiceFilterSet({ t, invoiceType: InvoiceType.invoice, options });

    expect(filters.map(f => f.type)).toEqual([
      FilterType.all,
      FilterType.active,
      FilterType.archived,
      FilterType.client,
      FilterType.business,
      FilterType.date,
      FilterType.status
    ]);
    expect(filters.filter(f => f.initial).map(f => f.type)).toEqual([FilterType.active]);
    expect(filters.find(f => f.type === FilterType.client)?.options).toEqual(options.clients);
    expect(filters.find(f => f.type === FilterType.business)?.options).toEqual(options.businesses);
  });

  it('lists every payment status for invoices', () => {
    const filters = buildInvoiceFilterSet({ t, invoiceType: InvoiceType.invoice, options });
    const status = filters.find(f => f.type === FilterType.status);

    expect(status?.options?.map(o => o.value)).toEqual([
      InvoiceStatus.unpaid,
      InvoiceStatus.partiallyPaid,
      InvoiceStatus.paid,
      InvoiceStatus.closed
    ]);
  });

  it('only lists open and closed statuses for quotations', () => {
    const filters = buildInvoiceFilterSet({ t, invoiceType: InvoiceType.quotation, options });
    const status = filters.find(f => f.type === FilterType.status);

    expect(status?.options?.map(o => o.value)).toEqual([InvoiceStatus.open, InvoiceStatus.closed]);
  });

  it('names the shared filter group after the document type', () => {
    const invoiceFilters = buildInvoiceFilterSet({ t, invoiceType: InvoiceType.invoice, options });
    const quoteFilters = buildInvoiceFilterSet({ t, invoiceType: InvoiceType.quotation, options });

    expect(invoiceFilters[0].label).toBe('invoices.filter.allText');
    expect(quoteFilters[0].label).toBe('quotes.filter.allText');
  });
});

describe('invoiceSortOptions and page copy', () => {
  it('sorts by status, issued date, number and last update', () => {
    expect(invoiceSortOptions(t, InvoiceType.invoice).map(o => o.value)).toEqual([
      'status',
      'issuedAt',
      'invoiceNumber',
      'updatedAt'
    ]);
    expect(invoiceSortOptions(t, InvoiceType.quotation)[2].label).toBe('common.quoteNumber');
  });

  it('switches titles and export names with the document type', () => {
    expect(invoicePageCopy(t, InvoiceType.invoice)).toEqual({
      title: 'common.invoice',
      leftTitle: 'menuItems.invoices',
      noItemText: 'invoices.noItemInvoice',
      noItemButtonText: 'invoices.addInvoice',
      exportFileName: 'invoices.xlsx',
      exportSheetName: 'Invoices'
    });
    expect(invoicePageCopy(t, InvoiceType.quotation).exportFileName).toBe('quotations.xlsx');
    expect(invoicePageCopy(t, InvoiceType.quotation).exportSheetName).toBe('Quotes');
  });
});

describe('buildExportSheets', () => {
  const invoice = {
    id: 7,
    invoiceFullNumber: 'INV-0007',
    currencyFormat: '{symbol}{amount}',
    signatureData: new Uint8Array([1]),
    invoicePayments: [{ amountCents: '500', paidAt: '2026-01-01', paymentMethod: 'cash' }],
    invoiceAttachments: [{ id: 9 }],
    invoiceCustomization: { watermarkFileData: 'W', paidWatermarkFileData: 'P', layoutName: 'A4' },
    invoiceBusinessSnapshot: { businessLogo: 'LOGO', businessName: 'Shop' },
    invoiceClientSnapshot: { clientName: 'Acme' },
    invoiceCurrencySnapshot: { currencyCode: 'EUR', currencySymbol: '€', currencySubunit: 100 },
    invoiceStyleProfileSnapshot: { styleProfileName: 'Blue' },
    invoiceItems: [
      { itemId: 1, quantity: '2', invoiceItemSnapshot: { name: 'Widget', unitPriceCents: '1000' } }
    ] as unknown as InvoiceItem[]
  } as unknown as Invoice;

  const sheets = buildExportSheets([invoice], 'Invoices');

  it('keeps the nine sheets in a stable order', () => {
    expect(sheets.map(s => s.name)).toEqual([
      'Invoices',
      'Business Snapshots',
      'Client Snapshots',
      'Currency Snapshots',
      'Style Profile Snapshots',
      'Customizations',
      'Payments',
      'Items',
      'Item Snapshots'
    ]);
  });

  it('strips nested documents, binaries and the display-only number from the invoice sheet', () => {
    const row = sheets[0].rows[0];

    expect(row.invoiceFullNumber).toBeUndefined();
    expect(row.invoiceItems).toBeUndefined();
    expect(row.invoicePayments).toBeUndefined();
    expect(row.invoiceAttachments).toBeUndefined();
    expect(row.currencyFormat).toBeUndefined();
    expect(row.signatureData).toBeUndefined();
    expect(row.invoiceCustomization).toBeUndefined();
    expect(row.invoiceBusinessSnapshot).toBeUndefined();
    expect(row.invoiceClientSnapshot).toBeUndefined();
    expect(row.invoiceCurrencySnapshot).toBeUndefined();
    expect(row.invoiceStyleProfileSnapshot).toBeUndefined();
    expect(row.id).toBe(7);
  });

  it('drops binary fields from snapshots and separates items from item snapshots', () => {
    expect(sheets[1].rows[0]).toEqual({ businessName: 'Shop' });
    expect(sheets[2].rows[0]).toEqual({ clientName: 'Acme' });
    expect(sheets[5].rows[0]).toEqual({ layoutName: 'A4' });
    expect(sheets[6].rows[0]).toMatchObject({ amountCents: '500' });
    expect(sheets[7].rows[0]).toEqual({ itemId: 1, quantity: '2' });
    expect(sheets[8].rows[0]).toEqual({ name: 'Widget', unitPriceCents: '1000' });
  });

  it('skips invoices that carry no snapshot of a kind', () => {
    const bare = { id: 1, invoicePayments: [], invoiceItems: [] } as unknown as Invoice;

    const bareSheets = buildExportSheets([bare], 'Invoices');

    expect(bareSheets[1].rows).toEqual([]);
    expect(bareSheets[2].rows).toEqual([]);
    expect(bareSheets[3].rows).toEqual([]);
    expect(bareSheets[4].rows).toEqual([]);
    expect(bareSheets[5].rows).toEqual([]);
  });
});
