import { Image } from '@react-pdf/renderer';
import { memo, useEffect, useState, type FC } from 'react';
import type { InvoiceFromData } from '../../../shared/types/invoice';
import { uint8ArrayToDataUrl } from '../../../shared/utils/dataUrlFunctions';
import { PDF_STYLES } from './constant';

interface Props {
  invoiceForm?: InvoiceFromData;
}
const WatermarkInfoComponent: FC<Props> = ({ invoiceForm }) => {
  const [watermarkUrl, setWatermarkUrl] = useState<string | null>(null);

  useEffect(() => {
    if (!invoiceForm?.customizationWatermarkFileData) return;

    uint8ArrayToDataUrl(invoiceForm.customizationWatermarkFileData, invoiceForm.customizationWatermarkFileType).then(
      setWatermarkUrl
    );
  }, [invoiceForm]);

  if (!watermarkUrl) return null;
  return <Image src={watermarkUrl} fixed style={PDF_STYLES.watermark} />;
};
export const WatermarkInfo = memo(WatermarkInfoComponent);
