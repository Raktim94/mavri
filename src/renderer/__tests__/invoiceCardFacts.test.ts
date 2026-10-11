import { addDays, format } from 'date-fns';
import { describe, expect, it } from 'vitest';
import { AmountFormat } from '../shared/enums/amountFormat';
import { DateFormat } from '../shared/enums/dateFormat';
import { InvoiceStatus } from '../shared/enums/invoiceStatus';
import { InvoiceType } from '../shared/enums/invoiceType';
import type { Invoice, InvoiceItem, InvoicePayment } from '../shared/types/invoice';
import type { Settings } from '../shared/types/settings';
import {
  accentForStatus,
  buildInvoiceCardFacts,
  latestPaymentAt,
  unitsFromCents,
  type AccentPalette
} from '../pages/invoices/list/invoiceCardFacts';

const palette: AccentPalette = {
  warning: 'W',
  success: 'S',
  error: 'E',
  primary: 'P',
  closed: 'C',
  divider: 'D'
};

const settings = { amountFormat: AmountFormat.enUS, dateFormat: DateFormat.MMddyyyy } as Settings;

const isoDay = (offsetDays: number) => format(addDays(new Date(), offsetDays), 'yyyy-MM-dd');

const makeInvoice = (overrides: Partial<Invoice> = {}): Invoice =>
  ({
    id: 1,
    invoiceType: InvoiceType.invoice,
    invoiceFullNumber: 'INV-0001',
    issuedAt: '2026-01-15T12:00:00.000Z',
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
    invoiceCurrencySnapshot: { currencyCode: 'USD', currencySymbol: '$', currencySubunit: 100 },
    invoiceClientSnapshot: { clientName: 'Acme Ltd' },
    ...overrides
  }) as Invoice;

const lineItems = (unitPriceCents: string, quantity: string): InvoiceItem[] => [
  { itemId: 1, quantity, taxRate: 0, invoiceItemSnapshot: { unitPriceCents } } as InvoiceItem
];

const payments = (...amountsCents: string[]): InvoicePayment[] =>
  amountsCents.map((amountCents, index) => ({
    amountCents,
    paidAt: `2026-02-0${index + 1}`,
    paymentMethod: 'cash'
  })) as unknown as InvoicePayment[];

describe('accentForStatus', () => {
  it('maps every invoice status to its palette colour', () => {
    expect(accentForStatus(InvoiceStatus.partiallyPaid, palette)).toBe('W');
    expect(accentForStatus(InvoiceStatus.paid, palette)).toBe('S');
    expect(accentForStatus(InvoiceStatus.unpaid, palette)).toBe('E');
    expect(accentForStatus(InvoiceStatus.open, palette)).toBe('P');
    expect(accentForStatus(InvoiceStatus.closed, palette)).toBe('C');
    expect(accentForStatus(undefined, palette)).toBe('D');
  });
});

describe('unitsFromCents', () => {
  it('divides by the currency subunit', () => {
    expect(unitsFromCents(2050, 100)).toBe(20.5);
  });

  it('collapses to zero when the currency has no subunit', () => {
    expect(unitsFromCents(2050, 0)).toBe(0);
  });

  it('treats a missing subunit as a division by zero', () => {
    expect(unitsFromCents(2050, undefined)).toBe(Infinity);
  });
});

describe('latestPaymentAt', () => {
  it('returns null when nothing was paid', () => {
    expect(latestPaymentAt([])).toBeNull();
    expect(latestPaymentAt(undefined)).toBeNull();
  });

  it('returns the most recent paidAt', () => {
    expect(latestPaymentAt(payments('100', '200'))).toBe('2026-02-02');
  });
});

describe('buildInvoiceCardFacts', () => {
  it('labels the card as an invoice and shows the formatted total', () => {
    const facts = buildInvoiceCardFacts(makeInvoice({ invoiceItems: lineItems('1000', '2') }), settings, palette);

    expect(facts.chipLabelKey).toBe('common.invoice');
    expect(facts.invoiceNumber).toBe('INV-0001');
    expect(facts.clientName).toBe('Acme Ltd');
    expect(facts.statusText).toBe('UNPAID');
    expect(facts.accent).toBe('E');
    expect(facts.totalText).toBe('$20.00');
    expect(facts.issuedText).toBe('01/15/2026');
  });

  it('labels a quotation differently and inverts the chip when archived', () => {
    const facts = buildInvoiceCardFacts(
      makeInvoice({ invoiceType: InvoiceType.quotation, isArchived: true }),
      settings,
      palette
    );

    expect(facts.chipLabelKey).toBe('common.quote');
    expect(facts.chipInverted).toBe(true);
  });

  it('shows a warning when the due date is in the future', () => {
    const facts = buildInvoiceCardFacts(makeInvoice({ dueDate: isoDay(5) }), settings, palette);

    expect(facts.captions).toContainEqual({
      tone: 'warning',
      i18nKey: 'invoices.dueDate',
      values: { days: 5, date: format(addDays(new Date(), 5), 'MM/dd/yyyy') }
    });
  });

  it('shows an overdue caption when the due date has passed', () => {
    const facts = buildInvoiceCardFacts(makeInvoice({ dueDate: isoDay(-3) }), settings, palette);

    expect(facts.captions).toContainEqual({ tone: 'error', i18nKey: 'invoices.overdue', values: { days: 3 } });
  });

  it('shows a due-today caption when the due date is today', () => {
    const facts = buildInvoiceCardFacts(makeInvoice({ dueDate: isoDay(0) }), settings, palette);

    expect(facts.captions).toContainEqual({
      tone: 'warning',
      i18nKey: 'invoices.dueToday',
      values: { date: format(new Date(), 'MM/dd/yyyy') }
    });
  });

  it('hides the due-date caption for paid and closed invoices', () => {
    const paid = buildInvoiceCardFacts(
      makeInvoice({ status: InvoiceStatus.paid, dueDate: isoDay(-3) }),
      settings,
      palette
    );
    const closed = buildInvoiceCardFacts(
      makeInvoice({ status: InvoiceStatus.closed, dueDate: isoDay(-3) }),
      settings,
      palette
    );

    expect(paid.captions.filter(c => c.i18nKey.startsWith('invoices.due') || c.i18nKey === 'invoices.overdue')).toEqual(
      []
    );
    expect(
      closed.captions.filter(c => c.i18nKey.startsWith('invoices.due') || c.i18nKey === 'invoices.overdue')
    ).toEqual([]);
  });

  it('marks a paid invoice with its latest payment date and flags overpayment', () => {
    const facts = buildInvoiceCardFacts(
      makeInvoice({
        status: InvoiceStatus.paid,
        invoiceItems: lineItems('1000', '1'),
        invoicePayments: payments('1500')
      }),
      settings,
      palette
    );

    expect(facts.captions).toEqual([
      {
        tone: 'success',
        i18nKey: 'invoices.markedAsPaid',
        values: { date: '02/01/2026' }
      },
      { tone: 'info', i18nKey: 'invoices.overpaid', values: { amount: '$5.00' } }
    ]);
  });

  it('shows the remaining amount on a partially paid invoice', () => {
    const facts = buildInvoiceCardFacts(
      makeInvoice({
        status: InvoiceStatus.partiallyPaid,
        invoiceItems: lineItems('1000', '1'),
        invoicePayments: payments('400')
      }),
      settings,
      palette
    );

    expect(facts.captions).toEqual([{ tone: 'info', i18nKey: 'invoices.partiallyPaid', values: { amount: '$6.00' } }]);
  });

  it('reports a zero total when the currency has no subunit', () => {
    const facts = buildInvoiceCardFacts(
      makeInvoice({
        invoiceItems: lineItems('1000', '1'),
        invoiceCurrencySnapshot: { currencyCode: 'JPY', currencySymbol: '¥', currencySubunit: 0 }
      }),
      settings,
      palette
    );

    expect(facts.totalText).toBe('¥0.00');
  });

  it('omits captions and totals when settings are missing', () => {
    const facts = buildInvoiceCardFacts(makeInvoice({ dueDate: isoDay(2) }), undefined, palette);

    expect(facts.totalText).toBeNull();
    expect(facts.issuedText).toBe('');
    expect(facts.captions).toEqual([]);
  });
});
