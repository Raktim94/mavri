import { DiscountType } from '../../../../shared/enums/discountType';
import { InvoiceStatus } from '../../../../shared/enums/invoiceStatus';
import { InvoiceType } from '../../../../shared/enums/invoiceType';
import { InvoiceItemTaxType, InvoiceTaxType } from '../../../../shared/enums/taxType';
import type { InvoiceFromData } from '../../../../shared/types/invoice';
import type { Settings } from '../../../../shared/types/settings';
import { getFinancialData } from '../../../../shared/utils/invoiceFunctions';

export interface PdfTotalsLabels {
  subTotalLabel: string;
  discountLabel: string;
  surchargeLabel: string;
  incLabel: string;
  taxLabel: string;
  taxExclusivePerItemLabel: string;
  taxInclusivePerItemLabel: string;
  shippingFeeLabel: string;
  totalLabel: string;
  paidLabel: string;
  balanceDueLabel: string;
}

export type PdfTotalsRowKind =
  'subtotal' | 'discount' | 'tax' | 'shipping' | 'surcharge' | 'divider' | 'total' | 'paid' | 'balanceDue';

export interface PdfTotalsRow {
  kind: PdfTotalsRowKind;
  label: string;
  value: string;
  bold: boolean;
  accent: boolean;
}

const percentageLabel = (label: string, type: DiscountType | undefined, percent: number | undefined): string =>
  type === DiscountType.percentage ? `${label} (${percent}%)` : label;

const taxRowLabel = (
  invoiceForm: InvoiceFromData,
  labels: PdfTotalsLabels,
  hasExclusiveItems: boolean,
  hasInclusiveItems: boolean
): string => {
  const { taxLabel, incLabel, taxExclusivePerItemLabel, taxInclusivePerItemLabel } = labels;
  const rate = invoiceForm.taxRate ?? 0;
  const taxName = invoiceForm.taxName;
  const parts: string[] = [];

  if (invoiceForm.taxType === InvoiceTaxType.deducted || invoiceForm.taxType === InvoiceTaxType.exclusive) {
    parts.push(taxName ? `${taxName} (${invoiceForm.taxRate}%)` : `${taxLabel} (${rate}%)`);
  }

  if (invoiceForm.taxType === InvoiceTaxType.inclusive) {
    parts.push(taxName ? `${taxName} (${incLabel} ${invoiceForm.taxRate}%)` : `${taxLabel} (${incLabel} ${rate}%)`);
  }

  if (hasExclusiveItems) parts.push(taxExclusivePerItemLabel);
  if (hasInclusiveItems) parts.push(taxInclusivePerItemLabel);

  if (!hasExclusiveItems && !hasInclusiveItems && !invoiceForm.taxType) parts.push(`${taxLabel} (${rate}%)`);

  return parts.join('');
};

export const buildPdfTotalsRows = (
  invoiceForm: InvoiceFromData | undefined,
  storeSettings: Settings | undefined,
  labels: PdfTotalsLabels
): PdfTotalsRow[] => {
  if (!invoiceForm) return [];

  const amounts = getFinancialData({
    storeSettings,
    currencySymbol: invoiceForm.invoiceCurrencySnapshot?.currencySymbol,
    currencyCode: invoiceForm.invoiceCurrencySnapshot?.currencyCode,
    currencySubunit: invoiceForm.invoiceCurrencySnapshot?.currencySubunit ?? 0,
    currencyFormat: invoiceForm.currencyFormat,
    invoiceItems: invoiceForm.invoiceItems ?? [],
    discountType: invoiceForm.discountType,
    discountAmount: Number(invoiceForm.discountAmountCents ?? 0),
    discountPercent: invoiceForm.discountPercent,
    taxRate: invoiceForm.taxRate ?? 0,
    shippingAmount: Number(invoiceForm.shippingFeeCents ?? 0),
    surchargeType: invoiceForm.surchargeType,
    surchargeAmount: Number(invoiceForm.surchargeAmountCents ?? 0),
    surchargePercent: invoiceForm.surchargePercent,
    taxType: invoiceForm.taxType,
    invoicePayments: invoiceForm.invoicePayments ?? []
  });

  const { discountAmount, shippingAmount, surchargeAmount, totalTax, totalAmountPaid } = amounts;
  const rows: PdfTotalsRow[] = [];

  const items = invoiceForm.invoiceItems ?? [];
  const hasExclusiveItems = items.some(item => item.taxType === InvoiceItemTaxType.exclusive);
  const hasInclusiveItems = items.some(item => item.taxType === InvoiceItemTaxType.inclusive);
  const hasAdjustments = discountAmount > 0 || Math.abs(totalTax) > 0 || shippingAmount > 0 || surchargeAmount > 0;

  if (hasAdjustments) {
    rows.push({
      kind: 'subtotal',
      label: labels.subTotalLabel,
      value: amounts.formattedSubTotalAmount,
      bold: true,
      accent: false
    });
  }

  if (discountAmount > 0) {
    rows.push({
      kind: 'discount',
      label: percentageLabel(labels.discountLabel, invoiceForm.discountType, invoiceForm.discountPercent),
      value: amounts.discountAmountFormatted,
      bold: false,
      accent: false
    });
  }

  if (Math.abs(totalTax) > 0) {
    rows.push({
      kind: 'tax',
      label: taxRowLabel(invoiceForm, labels, hasExclusiveItems, hasInclusiveItems),
      value: amounts.formattedTotalTaxAmount,
      bold: false,
      accent: false
    });
  }

  if (shippingAmount > 0) {
    rows.push({
      kind: 'shipping',
      label: labels.shippingFeeLabel,
      value: amounts.shippingAmountFormatted,
      bold: false,
      accent: false
    });
  }

  if (surchargeAmount > 0) {
    rows.push({
      kind: 'surcharge',
      label: percentageLabel(labels.surchargeLabel, invoiceForm.surchargeType, invoiceForm.surchargePercent),
      value: amounts.surchargeAmountFormatted,
      bold: false,
      accent: false
    });
  }

  if (hasAdjustments) rows.push({ kind: 'divider', label: '', value: '', bold: false, accent: false });

  const showTotal =
    totalAmountPaid > 0 ||
    invoiceForm.status === InvoiceStatus.paid ||
    invoiceForm.invoiceType === InvoiceType.quotation;
  if (showTotal) {
    rows.push({
      kind: 'total',
      label: labels.totalLabel,
      value: amounts.totalAmountFormatted,
      bold: true,
      accent: false
    });
  }

  const showPaid =
    totalAmountPaid > 0 && invoiceForm.invoiceType === InvoiceType.invoice && invoiceForm.status !== InvoiceStatus.paid;
  if (showPaid) {
    rows.push({
      kind: 'paid',
      label: labels.paidLabel,
      value: amounts.totalAmountPaidFormatted,
      bold: false,
      accent: false
    });
  }

  const showBalanceDue = invoiceForm.invoiceType === InvoiceType.invoice && invoiceForm.status !== InvoiceStatus.paid;
  if (showBalanceDue) {
    rows.push({
      kind: 'balanceDue',
      label: labels.balanceDueLabel,
      value: amounts.balanceDueFormatted,
      bold: true,
      accent: true
    });
  }

  return rows;
};
