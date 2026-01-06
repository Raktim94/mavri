import { pdf } from '@react-pdf/renderer';
import { parseISO } from 'date-fns';
import { useCallback } from 'react';
import { PDFDocument } from '../../pages/invoices/Preview/PDFDocument';
import { MONTH_NAMES } from '../../state/constant';
import { InvoiceType } from '../enums/invoiceType';
import type { AttachmentURL, InvoiceFromData } from '../types/invoice';
import type { Settings } from '../types/settings';
import { uint8ArrayToDataUrl } from '../utils/dataUrlFunctions';
import { usePdfTexts } from './usePdfTexts';

export const getAttachmentsUrl = async (invoiceForm?: InvoiceFromData): Promise<AttachmentURL[]> => {
  const attachments = invoiceForm?.invoiceAttachments ?? [];

  if (attachments.length === 0) {
    return [];
  }

  const list = await Promise.all(
    attachments.map(async attachment => {
      const url = attachment.data ? await uint8ArrayToDataUrl(attachment.data, attachment.fileType) : undefined;

      return { id: attachment.id as number, url };
    })
  );

  return list;
};

export const getLogoUrl = async (invoiceForm?: InvoiceFromData) => {
  if (!invoiceForm) return;

  let logoUrl: string | undefined;

  if (invoiceForm.businessLogoSnapshot) {
    logoUrl = await uint8ArrayToDataUrl(invoiceForm.businessLogoSnapshot, invoiceForm.businessFileTypeSnapshot);
  }

  return logoUrl;
};

export const getWatermarkUrl = async (invoiceForm?: InvoiceFromData) => {
  if (!invoiceForm) return;

  let watermarkUrl: string | undefined;

  if (invoiceForm.customizationWatermarkFileData) {
    watermarkUrl = await uint8ArrayToDataUrl(
      invoiceForm.customizationWatermarkFileData,
      invoiceForm.customizationWatermarkFileType
    );
  }

  return watermarkUrl;
};

export const getWatermarkPaidUrl = async (invoiceForm?: InvoiceFromData) => {
  if (!invoiceForm) return;

  let watermarkPaidUrl: string | undefined;

  if (invoiceForm.customizationPaidWatermarkFileData) {
    watermarkPaidUrl = await uint8ArrayToDataUrl(
      invoiceForm.customizationPaidWatermarkFileData,
      invoiceForm.customizationPaidWatermarkFileType
    );
  }

  return watermarkPaidUrl;
};

export const useExportPdf = (data: { invoiceForm?: InvoiceFromData; storeSettings?: Settings }) => {
  const { invoiceForm, storeSettings } = data;
  const pdfTexts = usePdfTexts(invoiceForm);

  const exportPdf = useCallback(async () => {
    if (!invoiceForm) return;

    const logoUrl = await getLogoUrl(invoiceForm);
    const attachmentUrls = await getAttachmentsUrl(invoiceForm);
    const watermarkUrl = await getWatermarkUrl(invoiceForm);
    const watermarkPaidUrl = await getWatermarkPaidUrl(invoiceForm);

    const blob = await pdf(
      <PDFDocument
        invoiceForm={invoiceForm}
        storeSettings={storeSettings}
        logoUrl={logoUrl}
        attachmentUrls={attachmentUrls}
        pdfTexts={pdfTexts}
        watermarkUrl={watermarkUrl}
        watermarkPaidUrl={watermarkPaidUrl}
      />
    ).toBlob();

    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');

    const hasInvoicePart =
      invoiceForm.invoicePrefixSnapshot || invoiceForm.invoiceNumber || invoiceForm.invoiceSuffixSnapshot;
    const subTypeName = invoiceForm.invoiceType === InvoiceType.invoice ? 'Invoice' : 'Quote';
    const invoiceNumber = `${hasInvoicePart ? '_' : ''}${invoiceForm.invoicePrefixSnapshot ?? ''}${invoiceForm.invoiceNumber ?? ''}${invoiceForm.invoiceSuffixSnapshot ?? ''}`;
    const issuedAtDate = invoiceForm?.issuedAt ? parseISO(invoiceForm.issuedAt) : undefined;
    const year = issuedAtDate && storeSettings?.shouldIncludeYear ? `_${issuedAtDate.getFullYear()}` : '';
    const month = issuedAtDate && storeSettings?.shouldIncludeMonth ? `_${MONTH_NAMES[issuedAtDate.getMonth()]}` : '';
    const businessName = storeSettings?.shouldIncludeBusinessName
      ? `${invoiceForm.businessNameSnapshot ? invoiceForm.businessNameSnapshot?.trim().replaceAll(' ', '_') + '_' : ''}`
      : '';
    a.href = url;
    a.download = `${businessName}${subTypeName}${invoiceNumber}${year}${month}.pdf`;
    a.click();

    URL.revokeObjectURL(url);
  }, [invoiceForm, storeSettings, pdfTexts]);

  return { exportPdf };
};
