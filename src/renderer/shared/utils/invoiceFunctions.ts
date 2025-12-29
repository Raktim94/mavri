import { differenceInCalendarDays, parseISO } from 'date-fns';
import { DiscountType } from '../enums/discountType';
import { InvoiceItemTaxType, InvoiceTaxType } from '../enums/taxType';
import type { Invoice, InvoiceFromData, InvoiceItem, InvoicePayment, InvoicesByCurrency } from '../types/invoice';
import type { Settings } from '../types/settings';
import { createCurrencyFormatter, supportsCurrencySubunit } from './formatFunctions';

export const aggregateInvoicesByCurrency = (invoices: Invoice[], from: string, to: string): InvoicesByCurrency => {
  const result: InvoicesByCurrency = {};

  const fromDate = parseISO(from);
  const toDate = parseISO(to);

  const filtered = invoices.filter(inv => {
    const issueAt = parseISO(inv.issuedAt);
    return issueAt >= fromDate && issueAt <= toDate;
  });

  for (const invoice of filtered) {
    const code = invoice.currencyCodeSnapshot;

    if (!result[code]) {
      result[code] = {
        currencyCode: invoice.currencyCodeSnapshot,
        currencySymbol: invoice.currencySymbolSnapshot,
        totalAmount: 0,
        totalAmountPaid: 0,
        balanceDue: 0,
        invoiceCount: 0,
        overdueCount: 0,
        collectionRate: 0,
        avgPerInvoice: 0,
        issuedAt: invoice.issuedAt,
        currencyId: invoice.currencyId
      };
    }

    const daysLeft = getDaysLeft(invoice.dueDate);
    const amountPaidCents = getTotalAmountPaidCents(invoice.invoicePayments);
    const totalAmountPaid = amountPaidCents / invoice.currencySubunitSnapshot;

    const totalAmountCents = getTotalAmountCents(invoice);
    const totalAmount = totalAmountCents / invoice.currencySubunitSnapshot;
    const remaining = totalAmount - totalAmountPaid;

    result[code].totalAmount += totalAmount;
    result[code].totalAmountPaid += totalAmountPaid;
    result[code].balanceDue += remaining;
    result[code].invoiceCount += 1;
    result[code].overdueCount += daysLeft < 0 ? 1 : 0;
  }

  for (const code of Object.keys(result)) {
    const group = result[code];
    group.collectionRate = group.totalAmount > 0 ? (group.totalAmountPaid / group.totalAmount) * 100 : 0;
    group.avgPerInvoice = group.invoiceCount > 0 ? group.totalAmountPaid / group.invoiceCount : 0;
  }

  return result;
};

export const getDaysLeft = (dueDate?: string) => {
  if (!dueDate) return 0;

  const d = typeof dueDate === 'string' ? parseISO(dueDate) : dueDate;

  const due = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const today = new Date();
  const todayDateOnly = new Date(today.getFullYear(), today.getMonth(), today.getDate());

  return differenceInCalendarDays(due, todayDateOnly);
};

export const getTotalAmountPaidCents = (invoicePayments: InvoicePayment[]): number => {
  if (!invoicePayments || invoicePayments.length === 0) {
    return 0;
  }

  const totalCents = invoicePayments.reduce((sum, p) => sum + p.amountCents, 0);
  return totalCents;
};

export const getItemTotalAmountCents = (invoiceItem: InvoiceItem, includeTax: boolean = true): number => {
  const amountCents = getInvoiceItemAmountCents(invoiceItem);

  if (includeTax) {
    const taxAmountCents = getInvoiceItemTaxCents(invoiceItem);
    if (invoiceItem.taxType !== InvoiceItemTaxType.inclusive) return amountCents + taxAmountCents;

    return amountCents;
  }

  return amountCents;
};

export const getSubTotalAmountCents = (invoiceItems: InvoiceItem[], includeTax: boolean = true): number => {
  if (!invoiceItems || invoiceItems.length === 0) return 0;

  return invoiceItems.reduce((sum, item) => sum + getItemTotalAmountCents(item, includeTax), 0);
};

export const getInvoiceItemAmountCents = (invoiceItem: InvoiceItem): number => {
  return getTotalUnitPrice({ unitPrice: invoiceItem.unitPriceCentsSnapshot, quantity: invoiceItem.quantity });
};

export const getTotalUnitPrice = (data: { unitPrice: number; quantity: number }): number => {
  const { unitPrice, quantity } = data;

  return unitPrice * quantity;
};

export const getDiscountAmountCents = (invoice: Invoice): number => {
  if (!invoice.discountType) {
    return 0;
  }

  if (invoice.discountType === DiscountType.fixed) return invoice.discountAmountCents;

  const subTotalCents = getSubTotalAmountCents(invoice.invoiceItems, false);
  return (subTotalCents * invoice.discountPercent) / 100;
};

export const getTotalAmountAfterDiscountCents = (invoice: Invoice): number => {
  const discountCents = getDiscountAmountCents(invoice);
  const subTotalCents = getSubTotalAmountCents(invoice.invoiceItems);

  return subTotalCents - discountCents;
};

export const getTotalAmountCents = (invoice: Invoice): number => {
  const amountCents = getTotalAmountAfterDiscountCents(invoice);
  const taxAmountCents = getInvoiceTaxCents(invoice);

  if (invoice.taxType !== InvoiceTaxType.inclusive) return amountCents + taxAmountCents + invoice.shippingFeeCents;

  return amountCents + invoice.shippingFeeCents;
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

export const getUnitPrice = (data: { supportsSubunit?: boolean; amountCents: number; subunit?: number }): number => {
  const { supportsSubunit, amountCents, subunit } = data;
  const unitPrice = supportsSubunit ? amountCents / subunit! : amountCents;

  return unitPrice;
};

export const getUnitTax = (data: { unitPrice: number; taxType?: InvoiceItemTaxType; taxRate: number }): number => {
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

export const getInvoiceTax = (data: { unitPrice: number; taxType?: InvoiceTaxType; taxRate: number }): number => {
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

export const getItemFinancialData = (data: {
  storeSettings?: Settings;
  invoiceForm: InvoiceFromData;
  unitPriceCents: number;
  quantity: number;
  taxType?: InvoiceItemTaxType;
  taxRate: number;
  format?: (amount: number) => string;
}) => {
  const { storeSettings, invoiceForm, unitPriceCents, quantity, taxType, taxRate, format } = data;

  const supportsSubunit = supportsCurrencySubunit(storeSettings, invoiceForm);
  const localFormat = format ?? createCurrencyFormatter(storeSettings!, invoiceForm);

  const unitPrice = getUnitPrice({
    supportsSubunit: supportsSubunit,
    amountCents: unitPriceCents,
    subunit: invoiceForm.currencySubunitSnapshot
  });
  const totalUnitPrice = getTotalUnitPrice({ unitPrice, quantity });
  const invoiceTaxAmount = getUnitTax({
    unitPrice: totalUnitPrice,
    taxType,
    taxRate
  });

  return {
    unitPrice,
    formattedUnitPrice: localFormat(unitPrice),
    totalUnitPrice,
    formattedTotal: localFormat(totalUnitPrice),
    invoiceTaxAmount,
    formattedTax: localFormat(invoiceTaxAmount)
  };
};

export const getPaidData = (data: {
  storeSettings?: Settings;
  invoiceForm?: InvoiceFromData;
  invoicePayment?: InvoicePayment;
  format?: (amount: number) => string;
}) => {
  const { storeSettings, invoiceForm, invoicePayment, format } = data;

  const supportsSubunit = supportsCurrencySubunit(storeSettings, invoiceForm);
  const localFormat = format ?? createCurrencyFormatter(storeSettings!, invoiceForm!);

  const amountPaid = getUnitPrice({
    supportsSubunit,
    amountCents: invoicePayment?.amountCents ?? 0,
    subunit: invoiceForm?.currencySubunitSnapshot
  });

  return {
    amountPaid,
    amountPaidFormatted: localFormat(amountPaid)
  };
};

export const getTotalPaidData = (data: {
  storeSettings?: Settings;
  invoiceForm?: InvoiceFromData;
  format?: (amount: number) => string;
}) => {
  const { storeSettings, invoiceForm, format } = data;

  const supportsSubunit = supportsCurrencySubunit(storeSettings, invoiceForm);
  const localFormat = format ?? createCurrencyFormatter(storeSettings!, invoiceForm!);

  const totalAmountPaid = getUnitPrice({
    supportsSubunit,
    amountCents: getTotalAmountPaidCents(invoiceForm?.invoicePayments ?? []),
    subunit: invoiceForm?.currencySubunitSnapshot
  });

  return {
    totalAmountPaid,
    totalAmountPaidFormatted: localFormat(totalAmountPaid)
  };
};

export const getFinancialData = (data: { storeSettings?: Settings; invoiceForm?: InvoiceFromData }) => {
  const { storeSettings, invoiceForm } = data;

  const supportsSubunit = supportsCurrencySubunit(storeSettings, invoiceForm);
  const format = createCurrencyFormatter(storeSettings!, invoiceForm!);

  let subTotalAmount = 0;
  let totalItemTaxAmount = 0;
  let isInclusive = false;

  invoiceForm?.invoiceItems?.forEach(item => {
    const { totalUnitPrice, invoiceTaxAmount } = getItemFinancialData({
      storeSettings,
      invoiceForm,
      unitPriceCents: item.unitPriceCentsSnapshot,
      quantity: item.quantity,
      taxType: item.taxType,
      taxRate: item.taxRate,
      format
    });

    subTotalAmount += totalUnitPrice;
    totalItemTaxAmount += invoiceTaxAmount;

    if (item.taxType === InvoiceItemTaxType.inclusive) {
      isInclusive = true;
    }
  });
  if (!isInclusive && invoiceForm?.taxType === InvoiceTaxType.inclusive) {
    isInclusive = true;
  }

  let discountBaseCents = 0;
  let discountAmount = 0;
  if (invoiceForm?.discountType === DiscountType.fixed) {
    discountBaseCents = invoiceForm.discountAmountCents ?? 0;
    discountAmount = getUnitPrice({
      supportsSubunit,
      amountCents: discountBaseCents,
      subunit: invoiceForm?.currencySubunitSnapshot
    });
  } else if (invoiceForm?.discountType === DiscountType.percentage) {
    discountBaseCents = (subTotalAmount * (invoiceForm?.discountPercent ?? 0)) / 100;
    discountAmount = discountBaseCents;
  }

  const shippingAmount = getUnitPrice({
    supportsSubunit,
    amountCents: invoiceForm?.shippingFeeCents ?? 0,
    subunit: invoiceForm?.currencySubunitSnapshot
  });

  const totalAmountAfterDiscount = subTotalAmount - discountAmount;

  const invoiceLevelTax = getInvoiceTax({
    unitPrice: totalAmountAfterDiscount,
    taxType: invoiceForm?.taxType,
    taxRate: invoiceForm?.taxRate ?? 0
  });

  const taxTotalAmount = totalItemTaxAmount + invoiceLevelTax;
  let totalAmount = totalAmountAfterDiscount + shippingAmount;

  if (!isInclusive) {
    totalAmount += taxTotalAmount;
  }
  const { totalAmountPaid, totalAmountPaidFormatted } = getTotalPaidData({ storeSettings, invoiceForm, format });

  const balanceDue = totalAmount - totalAmountPaid;

  return {
    formattedSubTotalAmount: format(subTotalAmount),
    formattedTotalTaxAmount: format(taxTotalAmount),
    subTotalAmount,
    totalTax: taxTotalAmount,
    discountAmount,
    discountAmountFormatted: format(discountAmount),
    shippingAmount,
    shippingAmountFormatted: format(shippingAmount),
    totalAmount,
    totalAmountFormatted: format(totalAmount),
    totalAmountPaid,
    totalAmountPaidFormatted,
    balanceDue,
    balanceDueFormatted: format(balanceDue)
  };
};
