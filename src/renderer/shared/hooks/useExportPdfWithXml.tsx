import { PDFDocument as PdfLibDocument } from 'pdf-lib';
import { useCallback, useMemo } from 'react';
import type { EInvoice } from '../enums/einvoice';
import type { InvoiceFromData } from '../types/invoice';
import type { Settings } from '../types/settings';
import { createPdfBlob, getPDFFilename } from './useExportPdf';
import { getXMLFilename } from './useExportXML';
import { usePdfTexts } from './usePdfTexts';

export const useExportPdfWithXml = (data: { invoiceForm?: InvoiceFromData; storeSettings?: Settings }) => {
  const { invoiceForm, storeSettings } = data;

  const pdfTextsDefaults = usePdfTexts({
    labelUpperCase: invoiceForm?.invoiceCustomization?.labelUpperCase,
    language: invoiceForm?.language
  });

  const pdfTexts = useMemo(() => {
    const customLabels = invoiceForm?.invoiceCustomization?.pdfTexts || {};

    return {
      ...pdfTextsDefaults,
      ...customLabels
    };
  }, [invoiceForm, pdfTextsDefaults]);

  const exportPdfWithXml = useCallback(
    async (xml: Uint8Array, einvoice: EInvoice) => {
      if (!invoiceForm || !storeSettings) return;

      const blob = await createPdfBlob(invoiceForm, storeSettings, pdfTexts);

      const pdfBytes = new Uint8Array(await blob.arrayBuffer());

      const pdfDoc = await PdfLibDocument.load(pdfBytes);
      pdfDoc.attach(xml, getXMLFilename(invoiceForm, einvoice, storeSettings), { mimeType: 'application/xml' });
      const modifiedPdfBytes = await pdfDoc.save();

      const newBlob = new Blob([new Uint8Array(modifiedPdfBytes)], { type: 'application/pdf' });

      const url = URL.createObjectURL(newBlob);
      const a = document.createElement('a');

      a.href = url;
      a.download = getPDFFilename(invoiceForm, storeSettings);
      a.click();
      URL.revokeObjectURL(url);
    },
    [invoiceForm, storeSettings, pdfTexts]
  );

  return { exportPdfWithXml };
};
