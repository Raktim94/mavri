import { Image } from '@react-pdf/renderer';
import { memo, useEffect, useState, type FC } from 'react';
import type { InvoiceFromData } from '../../../shared/types/invoice';
import { uint8ArrayToDataUrl } from '../../../shared/utils/dataUrlFunctions';
import { PDF_STYLES } from './constant';

interface Props {
  invoiceForm?: InvoiceFromData;
}
const WatermarkPaidInfoComponent: FC<Props> = ({ invoiceForm }) => {
  const [watermarkPaidUrl, setWatermarkPaidUrl] = useState<string | null>(null);

  useEffect(() => {
    if (!invoiceForm?.customizationPaidWatermarkFileData) return;

    uint8ArrayToDataUrl(
      invoiceForm.customizationPaidWatermarkFileData,
      invoiceForm.customizationPaidWatermarkFileType
    ).then(setWatermarkPaidUrl);
  }, [invoiceForm]);

  if (!watermarkPaidUrl) return null;
  return <Image src={watermarkPaidUrl} fixed style={PDF_STYLES.watermarkPaid} />;
};
export const WatermarkPaidInfo = memo(WatermarkPaidInfoComponent);
