import { useMemo } from 'react';
import type { InvoiceFromData, PdfTexts } from '../types/invoice';
import { useUppercaseTranslation } from './useUppercaseTranslation';

export const usePdfTexts = (invoiceForm?: InvoiceFromData): PdfTexts => {
  const { tt } = useUppercaseTranslation(invoiceForm?.customizationLabelUpperCase);

  return useMemo(() => {
    return {
      billTo: tt('invoices.billTo'),
      invoiceNo: tt('common.invoiceNo'),
      quoteNo: tt('common.quoteNo'),
      date: tt('common.date'),
      dueDate: tt('common.dueDate'),
      customerNote: tt('invoices.customerNote'),
      termsConditions: tt('invoices.termsConditions'),
      of: tt('common.of'),
      page: tt('common.page'),
      paymentInfo: tt('common.paymentInfo'),
      pdfINVOICE: tt('invoices.pdfINVOICE'),
      pdfQUOTE: tt('invoices.pdfQUOTE'),
      subTotalLabel: tt('invoices.subTotal'),
      discountPrctLabel: tt('invoices.discountPrct', {
        prct: invoiceForm?.discountPercent
      }),
      discountLabel: tt('invoices.discount'),
      taxExclusiveLabel: tt('invoices.taxExclusive', {
        name: invoiceForm?.taxName,
        prct: invoiceForm?.taxRate
      }),
      taxInclusiveLabel: tt('invoices.taxInclusive', {
        name: invoiceForm?.taxName,
        prct: invoiceForm?.taxRate
      }),
      taxRateLabel: tt('invoices.taxInclusivePlaceholder', {
        prct: invoiceForm?.taxRate
      }),
      taxExclusivePerItemLabel: tt('invoices.taxExclusivePerItem'),
      taxInclusivePerItemLabel: tt('invoices.taxInclusivePerItem'),
      shippingFeeLabel: tt('invoices.shippingFee'),
      totalLabel1: tt('invoices.total'),
      paidLabel: tt('invoices.paid'),
      balanceDueLabel: tt('invoices.balanceDue'),
      taxLabel: tt('invoices.tax', {
        prct: invoiceForm?.taxRate ?? 0
      }),
      itemLabel: tt('common.item'),
      unitLabel: tt('common.unit'),
      qtyLabel: tt('common.qty'),
      unitCostLabel: tt('common.unitCost'),
      totalLabel2: tt('common.total'),
      itemTaxLabel: ({ rate, amount }) =>
        tt('invoices.itemTax', {
          rate,
          amount
        })
    };
  }, [invoiceForm?.discountPercent, invoiceForm?.taxName, invoiceForm?.taxRate, tt]);
};
