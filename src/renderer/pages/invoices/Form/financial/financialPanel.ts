import { DiscountType } from '../../../../shared/enums/discountType';
import { InvoiceType } from '../../../../shared/enums/invoiceType';
import { InvoiceItemTaxType, InvoiceTaxType } from '../../../../shared/enums/taxType';
import type { InvoiceFromData, InvoiceItem, InvoicePayment } from '../../../../shared/types/invoice';

export type TFn = (key: string, options?: Record<string, unknown>) => string;

export type SummaryRowId = 'subtotal' | 'discount' | 'tax' | 'shipping' | 'surcharge' | 'total' | 'paid' | 'balance';

export type EditableRowId = 'discount' | 'tax' | 'shipping' | 'surcharge' | 'paid';

export interface SummaryRow {
  id: SummaryRowId;
  label: string;
  value: string;
  emphasized?: boolean;
  editable?: EditableRowId;
}

export interface SummaryAmounts {
  formattedSubTotalAmount: string;
  discountAmountFormatted: string;
  formattedTotalTaxAmount: string;
  shippingAmountFormatted: string;
  surchargeAmountFormatted: string;
  totalAmountFormatted: string;
  totalAmountPaidFormatted: string;
  balanceDueFormatted: string;
}

export const perItemTaxFlags = (items: InvoiceItem[]) => ({
  exclusive: items.some(item => item.taxType === InvoiceItemTaxType.exclusive),
  inclusive: items.some(item => item.taxType === InvoiceItemTaxType.inclusive)
});

export const discountRowLabel = (t: TFn, form?: InvoiceFromData): string =>
  form?.discountType === DiscountType.percentage
    ? t('invoices.discountPrct', { prct: form.discountPercent })
    : t('invoices.discount');

export const surchargeRowLabel = (t: TFn, form?: InvoiceFromData): string =>
  form?.surchargeType === DiscountType.percentage
    ? t('invoices.surchargePrct', { prct: form.surchargePercent })
    : t('invoices.surcharge');

export const taxRowLabel = (t: TFn, form?: InvoiceFromData): string => {
  const flags = perItemTaxFlags(form?.invoiceItems ?? []);
  const parts: string[] = [];

  if (form?.taxType === InvoiceTaxType.deducted || form?.taxType === InvoiceTaxType.exclusive) {
    parts.push(
      form.taxName
        ? t('invoices.taxExclusive', { name: form.taxName, prct: form.taxRate })
        : t('invoices.tax', { prct: form.taxRate })
    );
  }

  if (form?.taxType === InvoiceTaxType.inclusive) {
    parts.push(
      form.taxName
        ? t('invoices.taxInclusive', { name: form.taxName, prct: form.taxRate })
        : t('invoices.taxInclusivePlaceholder', { prct: form.taxRate })
    );
  }

  if (flags.exclusive) parts.push(t('invoices.taxExclusivePerItem'));
  if (flags.inclusive) parts.push(t('invoices.taxInclusivePerItem'));

  if (!flags.exclusive && !flags.inclusive && !form?.taxType) {
    parts.push(t('invoices.tax', { prct: form?.taxRate ?? 0 }));
  }

  return parts.join('');
};

export const paidDropdownTarget = (payments: InvoicePayment[] | undefined): 'add' | 'list' =>
  payments && payments.length <= 0 ? 'add' : 'list';

export const buildSummaryRows = (args: { t: TFn; form?: InvoiceFromData; amounts: SummaryAmounts }): SummaryRow[] => {
  const { t, form, amounts } = args;

  const rows: SummaryRow[] = [
    { id: 'subtotal', label: t('invoices.subTotal'), value: amounts.formattedSubTotalAmount, emphasized: true },
    { id: 'discount', label: discountRowLabel(t, form), value: amounts.discountAmountFormatted, editable: 'discount' },
    { id: 'tax', label: taxRowLabel(t, form), value: amounts.formattedTotalTaxAmount, editable: 'tax' },
    { id: 'shipping', label: t('invoices.shippingFee'), value: amounts.shippingAmountFormatted, editable: 'shipping' },
    {
      id: 'surcharge',
      label: surchargeRowLabel(t, form),
      value: amounts.surchargeAmountFormatted,
      editable: 'surcharge'
    },
    { id: 'total', label: t('common.total'), value: amounts.totalAmountFormatted, emphasized: true }
  ];

  if (form?.invoiceType === InvoiceType.invoice) {
    rows.push({ id: 'paid', label: t('invoices.paid'), value: amounts.totalAmountPaidFormatted, editable: 'paid' });
    rows.push({
      id: 'balance',
      label: t('invoices.balanceDue'),
      value: amounts.balanceDueFormatted,
      emphasized: true
    });
  }

  return rows;
};
