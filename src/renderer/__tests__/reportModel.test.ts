import { describe, expect, it } from 'vitest';
import { ReportDateType } from '../shared/enums/reportDateType';
import { InvoiceStatus } from '../shared/enums/invoiceStatus';
import type { Invoice } from '../shared/types/invoice';
import { buildReportGroupedMeta, createReportDateRange } from '../pages/reports/reportModel';

const invoice = (issuedAt: string): Invoice =>
  ({
    id: 1,
    issuedAt,
    status: InvoiceStatus.unpaid,
    invoicePayments: [],
    invoiceItems: [],
    invoiceCurrencySnapshot: {
      currencyId: 1,
      currencyCode: 'USD',
      currencySymbol: '$',
      currencySubunit: 100,
      currencyText: 'Dollar',
      currencyFormat: '{symbol}{amount}'
    },
    totalAmountCents: '0'
  }) as unknown as Invoice;

describe('createReportDateRange', () => {
  it('returns the same instant for both bounds', () => {
    const range = createReportDateRange();

    expect(range.from).toBe(range.to);
    expect(Number.isNaN(Date.parse(range.from))).toBe(false);
  });
});

describe('buildReportGroupedMeta', () => {
  it('falls back to an empty grouping without invoices', () => {
    expect(
      buildReportGroupedMeta(undefined, { from: '2025-01-01', to: '2025-12-31' }, ReportDateType.issuedAt)
    ).toEqual({
      groups: {},
      invoices: []
    });
  });

  it('keeps the invoice list alongside empty groups', () => {
    const meta = buildReportGroupedMeta([], { from: '2025-01-01', to: '2025-12-31' }, ReportDateType.issuedAt);

    expect(meta.groups).toEqual({});
    expect(meta.invoices).toEqual([]);
  });

  it('drops invoices issued outside the range', () => {
    const invoices = [invoice('2020-05-05T00:00:00.000Z')];
    const meta = buildReportGroupedMeta(invoices, { from: '2025-01-01', to: '2025-12-31' }, ReportDateType.issuedAt);

    expect(meta.groups).toEqual({});
    expect(meta.invoices).toBe(invoices);
  });
});
