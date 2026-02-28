import { DiscountType } from '../../enums/discountType';
import { InvoiceItemTaxType, InvoiceTaxType } from '../../enums/taxType';
import type { Invoice, InvoiceItem, InvoicePayment } from '../../types/invoice';

export const getDiscountAmountCents = (invoice: Invoice): number => {
  if (!invoice.discountType) {
    return 0;
  }

  if (invoice.discountType === DiscountType.fixed) return Number(invoice.discountAmountCents);

  const subTotalCents = getSubTotalAmountCents(invoice.invoiceItems, false);
  return (subTotalCents * invoice.discountPercent) / 100;
};

export const getTotalAmountPaidCents = (invoicePayments: InvoicePayment[]): number => {
  if (!invoicePayments || invoicePayments.length === 0) {
    return 0;
  }

  const totalCents = invoicePayments.reduce((sum, p) => sum + Number(p.amountCents), 0);
  return totalCents;
};

export const getItemTotalAmountCentsBeforeTaxCents = (
  invoiceItem: InvoiceItem,
  invoiceTaxInfo: { taxRate: number; taxType: InvoiceTaxType | undefined }
): number => {
  const amountCents = getInvoiceItemAmountCents(invoiceItem);

  const ratePercent = invoiceItem.taxType != null ? invoiceItem.taxRate : invoiceTaxInfo.taxRate;
  let taxType = invoiceItem.taxType;
  if (!taxType) {
    if (invoiceTaxInfo.taxType === InvoiceTaxType.inclusive) {
      taxType = InvoiceItemTaxType.inclusive;
    } else if (invoiceTaxInfo.taxType === InvoiceTaxType.exclusive) {
      taxType = InvoiceItemTaxType.exclusive;
    }
  }

  const taxAmountCents = getUnitTax({ unitPrice: amountCents, taxType: taxType, taxRate: ratePercent });
  if (taxType === InvoiceItemTaxType.inclusive) return amountCents - taxAmountCents;

  return amountCents;
};

export const getTotalAmountBeforeTaxCents = (
  invoice: Invoice,
  options?: { taxRate?: number; taxType?: InvoiceTaxType | undefined; reduceDiscount: boolean }
): number => {
  const { taxRate = 0, taxType, reduceDiscount = true } = options ?? {};
  const amountCents = getSubTotalAmountCentsBeforeTaxCents(invoice.invoiceItems, { taxRate, taxType });
  const discountCents = reduceDiscount ? getDiscountAmountCents(invoice) : 0;

  const taxAmountCents = getInvoiceTaxCents(invoice);
  if (invoice.taxType === InvoiceTaxType.inclusive) return amountCents - taxAmountCents - discountCents;

  return amountCents - discountCents;
};

export const getTotalAmountCents = (invoice: Invoice): number => {
  const amountCents = getTotalAmountAfterDiscountCents(invoice);
  const taxAmountCents = getInvoiceTaxCents(invoice);

  if (invoice.taxType !== InvoiceTaxType.inclusive)
    return amountCents + taxAmountCents + Number(invoice.shippingFeeCents);

  return amountCents + Number(invoice.shippingFeeCents);
};

export const getBalanceDueCents = (invoice: Invoice): number => {
  const amountPaidCents = getTotalAmountPaidCents(invoice.invoicePayments);
  const totalAmountCents = getTotalAmountCents(invoice);

  return totalAmountCents - amountPaidCents;
};

export const getInvoiceTaxCents = (invoice: Invoice): number => {
  const amountCents = getTotalAmountAfterDiscountCents(invoice);
  return getInvoiceTax({ unitPrice: amountCents, taxType: invoice.taxType, taxRate: invoice.taxRate });
};

export const getInvoiceItemTaxCents = (invoiceItem: InvoiceItem): number => {
  const amountCents = getInvoiceItemAmountCents(invoiceItem);
  return getUnitTax({ unitPrice: amountCents, taxType: invoiceItem.taxType, taxRate: invoiceItem.taxRate });
};

const getSubTotalAmountCentsBeforeTaxCents = (
  invoiceItems: InvoiceItem[],
  invoiceTaxInfo: { taxRate: number; taxType: InvoiceTaxType | undefined }
): number => {
  if (!invoiceItems || invoiceItems.length === 0) return 0;

  return invoiceItems.reduce((sum, item) => sum + getItemTotalAmountCentsBeforeTaxCents(item, invoiceTaxInfo), 0);
};

const getInvoiceItemAmountCents = (invoiceItem: InvoiceItem): number => {
  return getTotalUnitPrice({
    unitPrice: Number(invoiceItem.invoiceItemSnapshot!.unitPriceCents),
    quantity: invoiceItem.quantity
  });
};

const getTotalUnitPrice = (data: { unitPrice: number; quantity: string }): number => {
  const { unitPrice, quantity } = data;

  return unitPrice * Number(quantity);
};

const getTotalAmountAfterDiscountCents = (invoice: Invoice): number => {
  const discountCents = getDiscountAmountCents(invoice);
  const subTotalCents = getSubTotalAmountCents(invoice.invoiceItems);

  return subTotalCents - discountCents;
};

const getUnitTax = (data: { unitPrice: number; taxType?: InvoiceItemTaxType; taxRate: number }): number => {
  const { unitPrice, taxType, taxRate } = data;

  if (!taxType) {
    return 0;
  }

  if (taxType === InvoiceItemTaxType.exclusive) {
    return (unitPrice * taxRate) / 100;
  } else if (taxType === InvoiceItemTaxType.inclusive) {
    return (unitPrice * taxRate) / (100 + taxRate);
  }
  return 0;
};

const getInvoiceTax = (data: { unitPrice: number; taxType?: InvoiceTaxType; taxRate: number }): number => {
  const { unitPrice, taxType, taxRate } = data;

  if (!taxType) {
    return 0;
  }
  if (taxType === InvoiceTaxType.exclusive) {
    return (unitPrice * taxRate) / 100;
  } else if (taxType === InvoiceTaxType.inclusive) {
    return (unitPrice * taxRate) / (100 + taxRate);
  } else if (taxType === InvoiceTaxType.deducted) {
    return -(unitPrice * taxRate) / 100;
  }

  return 0;
};

const getSubTotalAmountCents = (invoiceItems: InvoiceItem[], includeTax: boolean = true): number => {
  if (!invoiceItems || invoiceItems.length === 0) return 0;

  return invoiceItems.reduce((sum, item) => sum + getItemTotalAmountCents(item, includeTax), 0);
};

const getItemTotalAmountCents = (invoiceItem: InvoiceItem, includeTax: boolean = true): number => {
  const amountCents = getInvoiceItemAmountCents(invoiceItem);

  if (includeTax) {
    const taxAmountCents = getInvoiceItemTaxCents(invoiceItem);
    if (invoiceItem.taxType !== InvoiceItemTaxType.inclusive) return amountCents + taxAmountCents;

    return amountCents;
  }

  return amountCents;
};
