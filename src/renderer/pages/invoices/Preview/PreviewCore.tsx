import { PDFViewer } from '@react-pdf/renderer';
import { memo, useEffect, useState, type FC } from 'react';
import {
  getAttachmentsUrl,
  getLogoUrl,
  getWatermarkPaidUrl,
  getWatermarkUrl
} from '../../../shared/hooks/useExportPdf ';
import { useUppercaseTranslation } from '../../../shared/hooks/useUppercaseTranslation';
import type { AttachmentURL, InvoiceFromData, PdfTexts } from '../../../shared/types/invoice';
import { useAppSelector } from '../../../state/configureStore';
import { selectSettings } from '../../../state/pageSlice';
import { PDFDocument } from './PDFDocument';

interface Props {
  invoiceForm?: InvoiceFromData;
}
const PreviewCoreComponent: FC<Props> = ({ invoiceForm }) => {
  const storeSettings = useAppSelector(selectSettings);
  const [logoUrl, setLogoUrl] = useState<string | undefined>();
  const [watermarkUrl, setWatermarkUrl] = useState<string | undefined>();
  const [watermarkPaidUrl, setWatermarkPaidUrl] = useState<string | undefined>();
  const [attachmentUrls, setAttachmentUrls] = useState<AttachmentURL[]>([]);
  const { tt } = useUppercaseTranslation(invoiceForm?.customizationLabelUpperCase);

  const pdfTexts: PdfTexts = {
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
    pdfQUOTE: tt('invoices.pdfQUOTE')
  };

  useEffect(() => {
    let cancelled = false;

    const loadWatermak = async () => {
      const url = await getWatermarkUrl(invoiceForm);
      if (!cancelled) {
        setWatermarkUrl(url);
      }
    };

    const loadWatermakPaid = async () => {
      const url = await getWatermarkPaidUrl(invoiceForm);
      if (!cancelled) {
        setWatermarkPaidUrl(url);
      }
    };

    const loadLogo = async () => {
      const url = await getLogoUrl(invoiceForm);
      if (!cancelled) {
        setLogoUrl(url);
      }
    };

    const loadAttacmentUrls = async () => {
      const urls = await getAttachmentsUrl(invoiceForm);
      if (!cancelled) {
        setAttachmentUrls(urls);
      }
    };

    loadWatermak();
    loadWatermakPaid();
    loadLogo();
    loadAttacmentUrls();

    return () => {
      cancelled = true;
    };
  }, [invoiceForm]);

  return (
    <PDFViewer
      key={JSON.stringify(invoiceForm)}
      style={{ width: '100%', height: '100%', border: 'none' }}
      showToolbar={false}
    >
      <PDFDocument
        invoiceForm={invoiceForm}
        storeSettings={storeSettings}
        logoUrl={logoUrl}
        attachmentUrls={attachmentUrls}
        pdfTexts={pdfTexts}
        watermarkUrl={watermarkUrl}
        watermarkPaidUrl={watermarkPaidUrl}
      />
    </PDFViewer>
  );
};
export const PreviewCore = memo(PreviewCoreComponent);
