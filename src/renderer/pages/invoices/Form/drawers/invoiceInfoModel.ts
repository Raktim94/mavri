import type { InvoiceInfo } from '../../../../shared/types/invoice';

export const shouldAutoFillInvoiceNumber = (
  currentInvoiceNumber: string | undefined,
  nextSequence: string | undefined
): nextSequence is string => {
  return (
    nextSequence != undefined &&
    (currentInvoiceNumber == undefined || currentInvoiceNumber === '') &&
    currentInvoiceNumber !== nextSequence
  );
};

export const invoiceInfoFormValid = (
  form: Pick<InvoiceInfo, 'issuedAt' | 'invoiceNumber'>,
  errors: { issuedAt: boolean; invoiceNumber: boolean }
): boolean =>
  typeof form.issuedAt !== 'undefined' &&
  form.issuedAt?.trim() !== '' &&
  !errors.issuedAt &&
  form.invoiceNumber?.trim() !== '' &&
  !errors.invoiceNumber;
