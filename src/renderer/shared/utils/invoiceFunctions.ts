import { differenceInCalendarDays, parseISO } from 'date-fns';
import type { CurrencyFormat } from '../enums/currencyFormat';
import { DiscountType } from '../enums/discountType';
import { InvoiceStatus } from '../enums/invoiceStatus';
import { ReportDateType } from '../enums/reportDateType';
import { InvoiceItemTaxType, InvoiceTaxType } from '../enums/taxType';
import type { Invoice, InvoiceItem, InvoicePayment, InvoicesByCurrency } from '../types/invoice';
import type { Settings } from '../types/settings';
import { formatAmount, getFormattedCurrency } from './formatFunctions';
import { applyAdjustment, applyTax, computeInvoiceTotals, splitItemLevel, toMajorUnits } from './invoiceMathModel';

export const getDaysLeft = (dueDate?: string) => {
  if (!dueDate) return 0;

  const parsed = typeof dueDate === 'string' ? parseISO(dueDate) : dueDate;

  const due = new Date(parsed.getFullYear(), parsed.getMonth(), parsed.getDate());
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

  return differenceInCalendarDays(due, today);
};

export const calcUnitPrice = (data: { supportsSubunit?: boolean; amountCents: number; subunit?: number }) => {
  return toMajorUnits(data);
};

export const calcTax = (amount: number, taxRate: number, taxType?: InvoiceItemTaxType | InvoiceTaxType) => {
  return applyTax(amount, taxRate, taxType);
};

export const calcSurcharge = (data: {
  subTotal: number;
  surchargeType?: DiscountType;
  surchargeAmount?: number;
  surchargePercent?: number;
}) => {
  const { subTotal, surchargeType, surchargeAmount, surchargePercent } = data;

  return applyAdjustment(subTotal, surchargeType, surchargeAmount, surchargePercent);
};

export const calcDiscount = (data: {
  subTotal: number;
  discountType?: DiscountType;
  discountAmount?: number;
  discountPercent?: number;
}) => {
  const { subTotal, discountType, discountAmount, discountPercent } = data;

  return applyAdjustment(subTotal, discountType, discountAmount, discountPercent);
};

export const getInvoiceItemLevelTaxDiscount = (data: {
  taxRate: number;
  unitPrice: number;
  quantity: number;
  taxType?: InvoiceItemTaxType;
  invoiceItems: InvoiceItem[];
  discountType?: DiscountType;
  discountAmount?: number;
  discountPercent?: number;
}) => {
  const { tax, discount } = splitItemLevel(data);

  return { tax, discount };
};

export const getInvoiceItemTotal = (data: {
  taxRate: number;
  unitPrice: number;
  quantity: number;
  taxType?: InvoiceItemTaxType;
  includeTax?: boolean;
  invoiceItems: InvoiceItem[];
  discountType?: DiscountType;
  discountAmount?: number;
  discountPercent?: number;
}) => {
  const { taxType, includeTax = true } = data;
  const { tax: itemTax, taxableAmount } = splitItemLevel(data);
  const tax = includeTax ? itemTax : 0;

  return taxType === InvoiceItemTaxType.inclusive ? taxableAmount : taxableAmount + tax;
};

export const getInvoiceTotal = (data: {
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
}) => {
  return computeInvoiceTotals(data).total;
};

export const getPaidAmount = (invoicePayments: InvoicePayment[]) => {
  return invoicePayments.reduce((sum, payment) => sum + Number(payment.amountCents), 0) ?? 0;
};

export const getBalanceDue = (data: {
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
  invoicePayments: InvoicePayment[];
}) => {
  const { invoicePayments, ...totalsInput } = data;

  return getInvoiceTotal(totalsInput) - getPaidAmount(invoicePayments);
};

const invoiceInRange = (invoice: Invoice, from: Date, to: Date, reportDateType: ReportDateType) => {
  const issuedDate = parseISO(invoice.issuedAt);

  if (reportDateType === ReportDateType.issuedAt) {
    return issuedDate >= from && issuedDate <= to;
  }

  if (!invoice.paidAt) return false;

  const paidDate = parseISO(invoice.paidAt);
  return paidDate >= from && paidDate <= to;
};

const invoicePaidValue = (invoice: Invoice, totalAmountCents: number) => {
  const amountPaidCents = getPaidAmount(invoice.invoicePayments);

  if (invoice.status === InvoiceStatus.paid && amountPaidCents <= totalAmountCents) {
    return totalAmountCents;
  }

  return amountPaidCents;
};

export const aggregateInvoicesByCurrency = (
  invoices: Invoice[],
  from: string,
  to: string,
  reportDateType: ReportDateType
): InvoicesByCurrency => {
  const fromDate = parseISO(from);
  const toDate = parseISO(to);

  const grouped: InvoicesByCurrency = {};

  invoices
    .filter(invoice => invoiceInRange(invoice, fromDate, toDate, reportDateType))
    .forEach(invoice => {
      const currency = invoice.invoiceCurrencySnapshot!;
      const code = currency.currencyCode;

      if (!grouped[code]) {
        grouped[code] = {
          currencyCode: code,
          currencySymbol: currency.currencySymbol,
          totalAmount: 0,
          totalAmountPaid: 0,
          balanceDue: 0,
          invoiceCount: 0,
          overdueCount: 0,
          collectionRate: 0,
          avgPerInvoice: 0,
          issuedAt: invoice.issuedAt,
          currencyId: invoice.currencyId,
          paidAt: invoice.paidAt
        };
      }

      const subunit = currency.currencySubunit;
      const daysLeft = getDaysLeft(invoice.dueDate);
      const totalAmountCents = getInvoiceTotal({
        taxRate: invoice.taxRate,
        taxType: invoice.taxType,
        invoiceItems: invoice.invoiceItems,
        discountType: invoice.discountType,
        discountAmount: Number(invoice.discountAmountCents),
        discountPercent: invoice.discountPercent,
        surchargeType: invoice.surchargeType,
        surchargeAmount: Number(invoice.surchargeAmountCents),
        surchargePercent: invoice.surchargePercent,
        shippingFee: Number(invoice.shippingFeeCents)
      });

      const totalAmount = totalAmountCents / subunit;
      const totalAmountPaid = invoicePaidValue(invoice, totalAmountCents) / subunit;

      grouped[code].totalAmount += totalAmount;
      grouped[code].totalAmountPaid += totalAmountPaid;
      grouped[code].balanceDue += totalAmount - totalAmountPaid;
      grouped[code].invoiceCount += 1;
      grouped[code].overdueCount += daysLeft < 0 ? 1 : 0;
    });

  Object.values(grouped).forEach(group => {
    group.collectionRate = group.totalAmount ? (group.totalAmountPaid / group.totalAmount) * 100 : 0;
    group.avgPerInvoice = group.invoiceCount ? group.totalAmountPaid / group.invoiceCount : 0;
  });

  return grouped;
};

export const supportsCurrencySubunit = (data: {
  storeSettings?: Settings;
  currencySymbol?: string;
  currencyCode?: string;
  currencySubunit?: number;
  currencyFormat?: string;
}) => {
  const { storeSettings, currencySymbol, currencyCode, currencySubunit, currencyFormat } = data;

  return Boolean(
    storeSettings &&
    currencySymbol !== undefined &&
    currencyCode !== undefined &&
    currencySubunit !== undefined &&
    currencyFormat !== undefined
  );
};

export const createCurrencyFormatter = (data: {
  storeSettings?: Settings;
  currencySymbol?: string;
  currencyCode?: string;
  currencySubunit?: number;
  currencyFormat?: string;
}) => {
  const { storeSettings, currencySymbol, currencyCode, currencyFormat } = data;

  const supports = supportsCurrencySubunit(data);

  return (amount: number) =>
    supports
      ? getFormattedCurrency({
          amount,
          amountFormat: storeSettings!.amountFormat,
          format: currencyFormat as CurrencyFormat,
          symbol: currencySymbol!,
          code: currencyCode!
        })
      : formatAmount(amount, storeSettings!.amountFormat);
};

export const getPaidData = (data: {
  storeSettings?: Settings;
  currencySymbol?: string;
  currencyCode?: string;
  currencySubunit?: number;
  currencyFormat?: string;
  invoicePayment?: InvoicePayment;
}) => {
  const { storeSettings, currencySymbol, currencyCode, currencySubunit, currencyFormat, invoicePayment } = data;

  const supportsSubunit = supportsCurrencySubunit({
    storeSettings,
    currencySymbol,
    currencyCode,
    currencySubunit,
    currencyFormat
  });
  const format = createCurrencyFormatter({
    storeSettings,
    currencySymbol,
    currencyCode,
    currencySubunit,
    currencyFormat
  });

  const amountPaid = calcUnitPrice({
    supportsSubunit,
    amountCents: Number(invoicePayment?.amountCents ?? 0),
    subunit: currencySubunit
  });

  return {
    amountPaid,
    amountPaidFormatted: format(amountPaid)
  };
};

export const getFinancialData = (data: {
  storeSettings?: Settings;
  currencySymbol?: string;
  currencyCode?: string;
  currencySubunit?: number;
  currencyFormat?: string;
  invoiceItems: InvoiceItem[];
  discountType?: DiscountType;
  discountAmount?: number;
  discountPercent?: number;
  taxRate: number;
  shippingAmount?: number;
  surchargeAmount?: number;
  surchargeType?: DiscountType;
  surchargePercent?: number;
  taxType?: InvoiceTaxType;
  invoicePayments: InvoicePayment[];
}) => {
  const {
    storeSettings,
    currencySymbol,
    currencyCode,
    currencySubunit,
    currencyFormat,
    invoiceItems,
    discountType,
    discountAmount = 0,
    discountPercent = 0,
    shippingAmount = 0,
    surchargeAmount = 0,
    surchargeType,
    surchargePercent,
    taxRate,
    taxType,
    invoicePayments
  } = data;

  const supportsSubunit = supportsCurrencySubunit({
    storeSettings,
    currencySymbol,
    currencyCode,
    currencySubunit,
    currencyFormat
  });
  const format = createCurrencyFormatter({
    storeSettings,
    currencySymbol,
    currencyCode,
    currencySubunit,
    currencyFormat
  });

  let isInclusive = false;
  let subTotalAmount = 0;
  let totalItemTaxAmount = 0;
  invoiceItems?.forEach(item => {
    const subTotal = getInvoiceItemTotal({
      taxRate: item.taxRate,
      unitPrice: Number(item.invoiceItemSnapshot.unitPriceCents),
      quantity: Number(item.quantity),
      taxType: item.taxType,
      includeTax: false,
      invoiceItems
    });
    const { tax: itemLevelTax } = getInvoiceItemLevelTaxDiscount({
      taxRate: item.taxRate,
      unitPrice: Number(item.invoiceItemSnapshot.unitPriceCents),
      quantity: Number(item.quantity),
      taxType: item.taxType,
      invoiceItems,
      discountType,
      discountAmount,
      discountPercent
    });

    totalItemTaxAmount += itemLevelTax;
    subTotalAmount += subTotal;

    if (item.taxType === InvoiceItemTaxType.inclusive) {
      isInclusive = true;
    }
  });
  if (!isInclusive && taxType === InvoiceTaxType.inclusive) {
    isInclusive = true;
  }

  const calculatedDiscountAmount = calcDiscount({
    subTotal: subTotalAmount,
    discountAmount,
    discountPercent,
    discountType
  });
  const totalAmountAfterDiscount = subTotalAmount - calculatedDiscountAmount;

  const calculatedSurchargeAmount = calcSurcharge({
    subTotal: totalAmountAfterDiscount,
    surchargeAmount,
    surchargePercent,
    surchargeType
  });

  const invoiceLevelTax = calcTax(totalAmountAfterDiscount, taxRate, taxType);
  const taxTotalAmount = totalItemTaxAmount + invoiceLevelTax;
  let totalAmount = totalAmountAfterDiscount + shippingAmount + calculatedSurchargeAmount;

  if (!isInclusive) {
    totalAmount += taxTotalAmount;
  }
  const paidAmount = getPaidAmount(invoicePayments);
  const balanceDue = totalAmount - paidAmount;

  const finalShippingAmount = calcUnitPrice({
    supportsSubunit,
    amountCents: shippingAmount,
    subunit: currencySubunit
  });
  const finalSubTotalAmount = calcUnitPrice({
    supportsSubunit,
    amountCents: subTotalAmount,
    subunit: currencySubunit
  });
  const finalTaxTotalAmount = calcUnitPrice({
    supportsSubunit,
    amountCents: taxTotalAmount,
    subunit: currencySubunit
  });
  const finalDiscountAmount = calcUnitPrice({
    supportsSubunit,
    amountCents: calculatedDiscountAmount,
    subunit: currencySubunit
  });
  const finalSurchargeAmount = calcUnitPrice({
    supportsSubunit,
    amountCents: calculatedSurchargeAmount,
    subunit: currencySubunit
  });
  const finalTotalAmount = calcUnitPrice({
    supportsSubunit,
    amountCents: totalAmount,
    subunit: currencySubunit
  });
  const finalPaidAmount = calcUnitPrice({
    supportsSubunit,
    amountCents: paidAmount,
    subunit: currencySubunit
  });
  const finalBalanceDue = calcUnitPrice({
    supportsSubunit,
    amountCents: balanceDue,
    subunit: currencySubunit
  });

  return {
    formattedSubTotalAmount: format(finalSubTotalAmount),
    formattedTotalTaxAmount: format(finalTaxTotalAmount),
    discountAmountFormatted: format(finalDiscountAmount),
    shippingAmountFormatted: format(finalShippingAmount),
    surchargeAmountFormatted: format(finalSurchargeAmount),
    totalAmountFormatted: format(finalTotalAmount),
    totalAmountPaidFormatted: format(finalPaidAmount),
    balanceDueFormatted: format(finalBalanceDue),
    subTotalAmount: finalSubTotalAmount,
    totalTax: finalTaxTotalAmount,
    discountAmount: finalDiscountAmount,
    shippingAmount: finalShippingAmount,
    surchargeAmount: finalSurchargeAmount,
    totalAmount: finalTotalAmount,
    totalAmountPaid: finalPaidAmount,
    balanceDue: finalBalanceDue
  };
};

export const getItemFinancialData = (data: {
  storeSettings?: Settings;
  currencySymbol?: string;
  currencyCode?: string;
  currencySubunit?: number;
  currencyFormat?: string;
  unitPrice: number;
  quantity: number;
  taxType?: InvoiceItemTaxType;
  taxRate: number;
  invoiceItems: InvoiceItem[];
  discountType?: DiscountType;
  discountAmount?: number;
  discountPercent?: number;
}) => {
  const {
    storeSettings,
    currencySymbol,
    currencyCode,
    currencySubunit,
    currencyFormat,
    unitPrice,
    discountType,
    discountAmount = 0,
    discountPercent = 0,
    quantity,
    taxType,
    taxRate,
    invoiceItems
  } = data;

  const supportsSubunit = supportsCurrencySubunit({
    storeSettings,
    currencySymbol,
    currencyCode,
    currencySubunit,
    currencyFormat
  });
  const format = createCurrencyFormatter({
    storeSettings,
    currencySymbol,
    currencyCode,
    currencySubunit,
    currencyFormat
  });
  const totalUnitPrice = unitPrice * quantity;
  const { tax: itemLevelTax, discount: itemLevelDiscount } = getInvoiceItemLevelTaxDiscount({
    taxRate: taxRate,
    unitPrice: unitPrice,
    quantity: quantity,
    taxType: taxType,
    invoiceItems,
    discountType,
    discountAmount,
    discountPercent
  });
  const finalUnitPriceTotal = calcUnitPrice({
    supportsSubunit: supportsSubunit,
    amountCents: totalUnitPrice,
    subunit: currencySubunit
  });
  const finalUnitPrice = calcUnitPrice({
    supportsSubunit: supportsSubunit,
    amountCents: unitPrice,
    subunit: currencySubunit
  });
  const finalItemTax = calcUnitPrice({
    supportsSubunit: supportsSubunit,
    amountCents: itemLevelTax,
    subunit: currencySubunit
  });
  const finalItemDiscount = calcUnitPrice({
    supportsSubunit: supportsSubunit,
    amountCents: itemLevelDiscount,
    subunit: currencySubunit
  });

  return {
    formattedUnitPrice: format(finalUnitPrice),
    formattedTotal: format(finalUnitPriceTotal),
    formattedTax: format(finalItemTax),
    formattedItemDiscountAmount: format(finalItemDiscount),
    unitPrice: finalUnitPrice,
    totalUnitPrice: finalUnitPriceTotal,
    invoiceTaxAmount: finalItemTax,
    itemDiscountAmount: finalItemDiscount
  };
};
