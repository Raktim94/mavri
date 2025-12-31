import { PDFViewer } from '@react-pdf/renderer';
import { memo, useEffect, useState, type FC } from 'react';
import { getAttachmentsUrl, getLogoUrl } from '../../../shared/hooks/useExportPdf ';
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
  const [attachmentUrls, setAttachmentUrls] = useState<AttachmentURL[]>([]);

  useEffect(() => {
    let cancelled = false;

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
      />
    </PDFViewer>
  );
};
export const PreviewCore = memo(PreviewCoreComponent);
