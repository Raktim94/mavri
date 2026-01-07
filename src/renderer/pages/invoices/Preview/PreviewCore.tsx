import { PDFViewer } from '@react-pdf/renderer';
import { memo, useEffect, useState, type FC } from 'react';
import {
  getAttachmentsUrl,
  getLogoUrl,
  getWatermarkPaidUrl,
  getWatermarkUrl
} from '../../../shared/hooks/useExportPdf ';
import { usePdfTexts } from '../../../shared/hooks/usePdfTexts';
import type { AttachmentURL, InvoiceFromData } from '../../../shared/types/invoice';
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
  const [loading, setLoading] = useState(true);
  const pdfTexts = usePdfTexts(invoiceForm);

  useEffect(() => {
    let cancelled = false;
    setAttachmentUrls([]);
    setLogoUrl(undefined);
    setWatermarkUrl(undefined);
    setWatermarkPaidUrl(undefined);
    setLoading(true);

    const loadData = async () => {
      const [logo, watermark, watermarkPaid, attachments] = await Promise.all([
        getLogoUrl(invoiceForm),
        getWatermarkUrl(invoiceForm),
        getWatermarkPaidUrl(invoiceForm),
        getAttachmentsUrl(invoiceForm)
      ]);

      if (!cancelled) {
        setLogoUrl(logo);
        setWatermarkUrl(watermark);
        setWatermarkPaidUrl(watermarkPaid);
        setAttachmentUrls(attachments);
        setLoading(false);
      }
    };

    loadData();

    return () => {
      cancelled = true;
    };
  }, [invoiceForm]);

  if (loading) return null;

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
