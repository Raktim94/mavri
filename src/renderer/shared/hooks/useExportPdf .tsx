import { pdf } from '@react-pdf/renderer';
import { parseISO } from 'date-fns';
import { useCallback } from 'react';
import { PDFDocument } from '../../pages/invoices/Preview/PDFDocument';
import { MONTH_NAMES } from '../../state/constant';
import { InvoiceType } from '../enums/invoiceType';
import type { InvoiceFromData } from '../types/invoice';
import type { Settings } from '../types/settings';
import { uint8ArrayToDataUrl } from '../utils/dataUrlFunctions';

export const getLogoUrl = async (invoiceForm?: InvoiceFromData) => {
  if (!invoiceForm) return;

  let logoUrl: string | undefined;

  if (invoiceForm.businessLogoSnapshot) {
    logoUrl = await uint8ArrayToDataUrl(invoiceForm.businessLogoSnapshot, invoiceForm.businessFileTypeSnapshot);
  }

  return logoUrl;
};

export const useExportPdf = (data: { invoiceForm?: InvoiceFromData; storeSettings?: Settings }) => {
  const { invoiceForm, storeSettings } = data;

  const exportPdf = useCallback(async () => {
    if (!invoiceForm) return;

    const logoUrl = await getLogoUrl(invoiceForm);

    const blob = await pdf(
      <PDFDocument invoiceForm={invoiceForm} storeSettings={storeSettings} logoUrl={logoUrl} />
    ).toBlob();

    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');

    const subTypeName = invoiceForm.invoiceType === InvoiceType.invoice ? 'Invoice' : 'Quote';
    const invoiceNumber = `${invoiceForm.invoicePrefixSnapshot}${invoiceForm.invoiceNumber}${invoiceForm.invoiceSuffixSnapshot}`;
    const issuedAtDate = invoiceForm?.issuedAt ? parseISO(invoiceForm.issuedAt) : undefined;
    const year = issuedAtDate && storeSettings?.shouldIncludeYear ? `_${issuedAtDate.getFullYear()}` : '';
    const month = issuedAtDate && storeSettings?.shouldIncludeMonth ? `_${MONTH_NAMES[issuedAtDate.getMonth()]}` : '';
    const businessName = storeSettings?.shouldIncludeBusinessName
      ? `${invoiceForm.businessNameSnapshot?.trim().replaceAll(' ', '_')}_`
      : '';

    a.href = url;
    a.download = `${businessName}${subTypeName}_${invoiceNumber}${year}${month}.pdf`;
    a.click();

    URL.revokeObjectURL(url);
  }, [invoiceForm, storeSettings]);

  return { exportPdf };
};
