import { DiscountType } from '../enums/discountType';
import { InvoiceItemTaxType, InvoiceTaxType } from '../enums/taxType';
import type { InvoiceItem } from '../types/invoice';

export interface ItemSplitInput {
  taxRate: number;
  unitPrice: number;
  quantity: number;
  taxType?: InvoiceItemTaxType;
  invoiceItems: InvoiceItem[];
  discountType?: DiscountType;
  discountAmount?: number;
  discountPercent?: number;
}

export interface InvoiceTotalsInput {
  taxRate: number;
  taxType?: InvoiceTaxType;
  invoiceItems: InvoiceItem[];
  discountType?: DiscountType;
  discountAmount?: number;
  discountPercent?: number;
  shippingFee?: number;
  surchargeType?: DiscountType;
  surchargeAmount?: number;
  surchargePercent?: number;
  includeTax?: boolean;
}

export const sumItemsValueCents = (invoiceItems: InvoiceItem[]) =>
  invoiceItems.reduce((sum, item) => {
    return sum + Number(item.invoiceItemSnapshot.unitPriceCents) * Number(item.quantity);
  }, 0) ?? 0;

export const applyTax = (amount: number, taxRate: number, taxType?: InvoiceItemTaxType | InvoiceTaxType) => {
  if (!taxType) return 0;
  switch (taxType) {
    case InvoiceItemTaxType.exclusive:
    case InvoiceTaxType.exclusive:
      return (amount * taxRate) / 100;
    case InvoiceItemTaxType.inclusive:
    case InvoiceTaxType.inclusive:
      return (amount * taxRate) / (100 + taxRate);
    case InvoiceTaxType.deducted:
      return -(amount * taxRate) / 100;
    default:
      return 0;
  }
};

export const applyAdjustment = (
  subTotal: number,
  adjustmentType?: DiscountType,
  fixedAmount?: number,
  percent?: number
) => {
  if (!adjustmentType) return 0;
  return adjustmentType === DiscountType.fixed ? (fixedAmount ?? 0) : (subTotal * (percent ?? 0)) / 100;
};

export const proratedAmount = (part: number, whole: number, total: number) => {
  if (whole > 0 && total > 0) {
    return Math.round((part / whole) * total);
  }
  return 0;
};

export const toMajorUnits = (data: { supportsSubunit?: boolean; amountCents: number; subunit?: number }) => {
  const { supportsSubunit, amountCents, subunit } = data;

  if (supportsSubunit && subunit === 0) return 0;

  return supportsSubunit ? amountCents / subunit! : amountCents;
};

export const splitItemLevel = (data: ItemSplitInput) => {
  const {
    unitPrice,
    quantity,
    taxRate,
    taxType,
    invoiceItems,
    discountType,
    discountAmount = 0,
    discountPercent = 0
  } = data;

  const unitTotal = unitPrice * quantity;
  const subTotal = sumItemsValueCents(invoiceItems);
  const discount = proratedAmount(
    unitTotal,
    subTotal,
    applyAdjustment(subTotal, discountType, discountAmount, discountPercent)
  );
  const taxableAmount = unitTotal - discount;

  return {
    tax: applyTax(taxableAmount, taxRate, taxType),
    discount,
    taxableAmount,
    unitTotal,
    subTotal
  };
};

export const computeInvoiceTotals = (data: InvoiceTotalsInput) => {
  const {
    taxRate,
    taxType,
    invoiceItems,
    discountType,
    discountAmount = 0,
    discountPercent = 0,
    shippingFee = 0,
    surchargeAmount = 0,
    surchargeType,
    surchargePercent,
    includeTax = true
  } = data;

  const subTotal = sumItemsValueCents(invoiceItems);
  const totalDiscount = applyAdjustment(subTotal, discountType, discountAmount, discountPercent);
  const afterDiscount = subTotal - totalDiscount;
  const totalSurcharge = applyAdjustment(afterDiscount, surchargeType, surchargeAmount, surchargePercent);

  const invoiceLevelTax = applyTax(afterDiscount, taxRate, taxType);
  let itemLevelTax = 0;
  invoiceItems.forEach(item => {
    const unitTotal = Number(item.invoiceItemSnapshot.unitPriceCents) * Number(item.quantity);
    const allocatedDiscount = proratedAmount(unitTotal, subTotal, totalDiscount);
    const taxableAmount = unitTotal - allocatedDiscount;
    if (item.taxType !== InvoiceItemTaxType.inclusive) {
      itemLevelTax += applyTax(taxableAmount, item.taxRate, item.taxType);
    }
  });

  const tax = includeTax ? invoiceLevelTax + itemLevelTax : 0;
  const total =
    taxType === InvoiceTaxType.inclusive
      ? afterDiscount + shippingFee + totalSurcharge
      : afterDiscount + tax + shippingFee + totalSurcharge;

  return { subTotal, totalDiscount, afterDiscount, totalSurcharge, tax, total };
};
