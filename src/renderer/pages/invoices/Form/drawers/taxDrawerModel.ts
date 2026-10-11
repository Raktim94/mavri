import { InvoiceTaxOptionType } from '../../../../shared/enums/invoiceTaxOptionType';
import { InvoiceItemTaxType, InvoiceTaxType } from '../../../../shared/enums/taxType';
import type { InvoiceItem, TaxForm } from '../../../../shared/types/invoice';

export type TFn = (key: string, options?: Record<string, unknown>) => string;

export interface TaxChoice {
  label: string;
  value: InvoiceTaxOptionType | undefined;
}

export const taxChoices = (t: TFn): TaxChoice[] => [
  { label: t('invoices.none'), value: undefined },
  { label: t('invoices.onTotal'), value: InvoiceTaxOptionType.onTotal },
  { label: t('invoices.deducted'), value: InvoiceTaxOptionType.deducted },
  { label: t('invoices.perItem'), value: InvoiceTaxOptionType.perItem }
];

export const taxOptionFrom = (data?: TaxForm): InvoiceTaxOptionType | undefined => {
  if (data?.taxType === InvoiceTaxType.exclusive || data?.taxType === InvoiceTaxType.inclusive) {
    return InvoiceTaxOptionType.onTotal;
  }
  if (data?.taxType === InvoiceTaxType.deducted) {
    return InvoiceTaxOptionType.deducted;
  }
  if (data?.invoiceItems?.some(item => item.taxType)) {
    return InvoiceTaxOptionType.perItem;
  }
  return undefined;
};

export const taxTypeForOption = (option?: InvoiceTaxOptionType): InvoiceTaxType | undefined => {
  if (option === InvoiceTaxOptionType.onTotal) return InvoiceTaxType.exclusive;
  if (option === InvoiceTaxOptionType.deducted) return InvoiceTaxType.deducted;
  return undefined;
};

export const taxFormValid = (form: TaxForm): boolean => typeof form.taxRate !== 'undefined' || !form.taxType;

export const clearedItemRates = (items: InvoiceItem[]): InvoiceItem[] =>
  items.map(item => ({ ...item, taxRate: 0, taxType: undefined }));

export const itemsInclusive = (items: InvoiceItem[]): boolean =>
  items.some(item => item.taxType === InvoiceItemTaxType.inclusive);

export const withItemRate = (
  items: InvoiceItem[],
  index: number,
  rate: number | undefined,
  inclusive: boolean
): InvoiceItem[] =>
  items.map((item, i) =>
    i === index
      ? {
          ...item,
          taxRate: rate ?? 0,
          taxType: inclusive ? InvoiceItemTaxType.inclusive : InvoiceItemTaxType.exclusive
        }
      : item
  );

export const withItemsInclusiveness = (items: InvoiceItem[], inclusive: boolean): InvoiceItem[] =>
  items.map(item => ({
    ...item,
    taxType: inclusive ? InvoiceItemTaxType.inclusive : InvoiceItemTaxType.exclusive
  }));
