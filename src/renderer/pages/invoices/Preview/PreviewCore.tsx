import { PDFViewer } from '@react-pdf/renderer';
import { memo, useEffect, useMemo, useState, type FC } from 'react';
import { useTranslation } from 'react-i18next';
import {
  getAttachmentsUrl,
  getLogoUrl,
  getQRCodeUrls,
  getSignatureUrls,
  getWatermarkPaidUrl,
  getWatermarkUrl
} from '../../../shared/hooks/fileExport/useExportPdf';
import { usePdfTexts } from '../../../shared/hooks/pdf/usePdfTexts';
import type { AttachmentURL, InvoiceFromData } from '../../../shared/types/invoice';
import { useAppSelector } from '../../../state/configureStore';
import { selectSettings } from '../../../state/pageSlice';
import { PDFDocument } from './PDFDocument';

interface Props {
  invoiceForm?: InvoiceFromData;
}

interface AssetUrls {
  logo?: string;
  watermark?: string;
  watermarkPaid?: string;
  attachments: AttachmentURL[];
  signature?: string;
  qrCode?: string;
}

const EMPTY_ASSETS: AssetUrls = { attachments: [] };

const PreviewCoreComponent: FC<Props> = ({ invoiceForm }) => {
  const { t } = useTranslation();
  const storeSettings = useAppSelector(selectSettings);
  const [assets, setAssets] = useState<AssetUrls>(EMPTY_ASSETS);
  const [loading, setLoading] = useState(true);

  const pdfTextsDefaults = usePdfTexts({
    labelUpperCase: invoiceForm?.invoiceCustomization?.labelUpperCase,
    language: invoiceForm?.language
  });

  const pdfTexts = useMemo(
    () => ({ ...pdfTextsDefaults, ...(invoiceForm?.invoiceCustomization?.pdfTexts || {}) }),
    [invoiceForm, pdfTextsDefaults]
  );

  useEffect(() => {
    let cancelled = false;
    setAssets(EMPTY_ASSETS);
    setLoading(true);

    const loadAssets = async () => {
      const [logo, watermark, watermarkPaid, attachments, signature, qrCode] = await Promise.all([
        getLogoUrl(invoiceForm),
        getWatermarkUrl(invoiceForm),
        getWatermarkPaidUrl(invoiceForm),
        getAttachmentsUrl(invoiceForm),
        getSignatureUrls(invoiceForm),
        getQRCodeUrls(invoiceForm)
      ]);

      if (!cancelled) {
        setAssets({ logo, watermark, watermarkPaid, attachments, signature, qrCode });
        setLoading(false);
      }
    };

    void loadAssets();

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
        logoUrl={assets.logo}
        qrCodeUrl={assets.qrCode}
        attachmentUrls={assets.attachments}
        pdfTexts={pdfTexts}
        layoutRequired={t('common.layoutRequired')}
        watermarkUrl={assets.watermark}
        watermarkPaidUrl={assets.watermarkPaid}
        signatureUrl={assets.signature}
      />
    </PDFViewer>
  );
};

export const PreviewCore = memo(PreviewCoreComponent);
