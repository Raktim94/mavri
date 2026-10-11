import { InvoiceStatus } from '../../../shared/enums/invoiceStatus';
import { InvoiceType } from '../../../shared/enums/invoiceType';
import type { Invoice, InvoicePayment } from '../../../shared/types/invoice';
import type { Settings } from '../../../shared/types/settings';
import { formatDate, getFormattedCurrency } from '../../../shared/utils/formatFunctions';
import { getBalanceDue, getDaysLeft, getInvoiceTotal } from '../../../shared/utils/invoiceFunctions';

export type CaptionTone = 'warning' | 'error' | 'success' | 'info';

export interface CardCaption {
  tone: CaptionTone;
  i18nKey: string;
  values: Record<string, string | number>;
}

export interface AccentPalette {
  warning: string;
  success: string;
  error: string;
  primary: string;
  closed: string;
  divider: string;
}

export interface InvoiceCardFacts {
  chipLabelKey: string;
  accent: string;
  chipInverted: boolean;
  invoiceNumber: string;
  issuedText: string;
  statusText: string;
  clientName: string;
  totalText: string | null;
  captions: CardCaption[];
}

const amountPartsOf = (invoice: Invoice) => ({
  taxRate: invoice.taxRate,
  taxType: invoice.taxType,
  invoiceItems: invoice.invoiceItems,
  discountType: invoice.discountType,
  discountAmount: Number(invoice.discountAmountCents),
  discountPercent: invoice.discountPercent,
  shippingFee: Number(invoice.shippingFeeCents),
  surchargeType: invoice.surchargeType,
  surchargeAmount: Number(invoice.surchargeAmountCents),
  surchargePercent: invoice.surchargePercent
});

export const accentForStatus = (status: InvoiceStatus | undefined, palette: AccentPalette): string => {
  switch (status) {
    case InvoiceStatus.partiallyPaid:
      return palette.warning;
    case InvoiceStatus.paid:
      return palette.success;
    case InvoiceStatus.unpaid:
      return palette.error;
    case InvoiceStatus.open:
      return palette.primary;
    case InvoiceStatus.closed:
      return palette.closed;
    default:
      return palette.divider;
  }
};

export const latestPaymentAt = (payments?: InvoicePayment[]): string | null => {
  if (!payments || payments.length === 0) return null;

  return payments.reduce(
    (latest, payment) => (new Date(payment.paidAt).getTime() > new Date(latest).getTime() ? payment.paidAt : latest),
    payments[0].paidAt
  );
};

export const unitsFromCents = (cents: number, subunit?: number): number => (subunit === 0 ? 0 : cents / (subunit ?? 0));

const moneyText = (amount: number, invoice: Invoice, settings: Settings): string =>
  getFormattedCurrency({
    amount,
    amountFormat: settings.amountFormat,
    format: invoice.currencyFormat as never,
    symbol: invoice.invoiceCurrencySnapshot?.currencySymbol ?? '',
    code: invoice.invoiceCurrencySnapshot?.currencyCode ?? ''
  });

const dueDateCaption = (invoice: Invoice, settings: Settings | undefined): CardCaption | null => {
  if (!invoice.dueDate || !settings) return null;
  if (invoice.status === InvoiceStatus.paid || invoice.status === InvoiceStatus.closed) return null;

  const daysLeft = getDaysLeft(invoice.dueDate);
  const date = formatDate(invoice.dueDate, settings.dateFormat);

  if (daysLeft > 0) return { tone: 'warning', i18nKey: 'invoices.dueDate', values: { days: daysLeft, date } };
  if (daysLeft < 0) return { tone: 'error', i18nKey: 'invoices.overdue', values: { days: Math.abs(daysLeft) } };

  return { tone: 'warning', i18nKey: 'invoices.dueToday', values: { date } };
};

const paymentCaptions = (invoice: Invoice, settings: Settings | undefined, balanceUnits: number): CardCaption[] => {
  const paidAt = latestPaymentAt(invoice.invoicePayments);
  if (!paidAt || !settings) return [];

  const captions: CardCaption[] = [];

  if (invoice.status === InvoiceStatus.paid) {
    captions.push({
      tone: 'success',
      i18nKey: 'invoices.markedAsPaid',
      values: { date: formatDate(paidAt, settings.dateFormat) }
    });

    if (balanceUnits < 0 && invoice.invoiceCurrencySnapshot) {
      captions.push({
        tone: 'info',
        i18nKey: 'invoices.overpaid',
        values: { amount: moneyText(Math.abs(balanceUnits), invoice, settings) }
      });
    }
  }

  if (invoice.status === InvoiceStatus.partiallyPaid && invoice.invoiceCurrencySnapshot) {
    captions.push({
      tone: 'info',
      i18nKey: 'invoices.partiallyPaid',
      values: { amount: moneyText(balanceUnits, invoice, settings) }
    });
  }

  return captions;
};

export const invoiceTotalUnits = (invoice: Invoice): number =>
  unitsFromCents(getInvoiceTotal(amountPartsOf(invoice)), invoice.invoiceCurrencySnapshot?.currencySubunit);

export const invoiceBalanceUnits = (invoice: Invoice): number =>
  unitsFromCents(
    getBalanceDue({ ...amountPartsOf(invoice), invoicePayments: invoice.invoicePayments }),
    invoice.invoiceCurrencySnapshot?.currencySubunit
  );

export const buildInvoiceCardFacts = (
  invoice: Invoice,
  settings: Settings | undefined,
  palette: AccentPalette
): InvoiceCardFacts => {
  const totalUnits = invoiceTotalUnits(invoice);
  const balanceUnits = invoiceBalanceUnits(invoice);

  const captions: CardCaption[] = [];
  const due = dueDateCaption(invoice, settings);
  if (due) captions.push(due);
  captions.push(...paymentCaptions(invoice, settings, balanceUnits));

  return {
    chipLabelKey: invoice.invoiceType === InvoiceType.invoice ? 'common.invoice' : 'common.quote',
    accent: accentForStatus(invoice.status, palette),
    chipInverted: Boolean(invoice.isArchived),
    invoiceNumber: invoice.invoiceFullNumber,
    issuedText: settings ? formatDate(invoice.issuedAt, settings.dateFormat) : '',
    statusText: (invoice.status ?? '').toUpperCase(),
    clientName: invoice.invoiceClientSnapshot?.clientName ?? '',
    totalText: settings && invoice.invoiceCurrencySnapshot ? moneyText(totalUnits, invoice, settings) : null,
    captions
  };
};
