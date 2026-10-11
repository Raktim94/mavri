import { InvoiceStatus } from '../../../../shared/enums/invoiceStatus';
import { InvoiceType } from '../../../../shared/enums/invoiceType';
import type { InvoiceFromData } from '../../../../shared/types/invoice';
import { getBalanceDue, getPaidAmount } from '../../../../shared/utils/invoiceFunctions';

export const statusAfterClosedOff = (form?: InvoiceFromData): InvoiceStatus => {
  if (form?.invoiceType === InvoiceType.quotation) {
    return InvoiceStatus.open;
  }

  const totalAmountPaid = getPaidAmount(form?.invoicePayments ?? []);

  if (totalAmountPaid <= 0) return InvoiceStatus.unpaid;

  const balanceDue = getBalanceDue({
    taxRate: form?.taxRate ?? 0,
    taxType: form?.taxType,
    invoiceItems: form?.invoiceItems ?? [],
    discountType: form?.discountType,
    discountAmount: Number(form?.discountAmountCents ?? 0),
    discountPercent: form?.discountPercent,
    shippingFee: Number(form?.shippingFeeCents ?? 0),
    invoicePayments: form?.invoicePayments ?? []
  });

  if (balanceDue - totalAmountPaid > 0) return InvoiceStatus.partiallyPaid;

  return InvoiceStatus.paid;
};
