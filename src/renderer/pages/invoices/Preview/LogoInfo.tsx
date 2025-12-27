import { Image } from '@react-pdf/renderer';
import { memo, useEffect, useState, type FC } from 'react';
import type { InvoiceFromData } from '../../../shared/types/invoice';
import { uint8ArrayToDataUrl } from '../../../shared/utils/dataUrlFunctions';
import { DEFAULT_LOGO_SIZES, LOGO_SIZES } from './constant';

interface Props {
  invoiceForm?: InvoiceFromData;
}
const LogoInfoComponent: FC<Props> = ({ invoiceForm }) => {
  const [logoUrl, setLogoUrl] = useState<string | null>(null);

  useEffect(() => {
    if (!invoiceForm?.businessLogoSnapshot) return;

    uint8ArrayToDataUrl(invoiceForm.businessLogoSnapshot, invoiceForm.businessFileTypeSnapshot).then(setLogoUrl);
  }, [invoiceForm]);

  if (!logoUrl) return null;

  if (!invoiceForm?.businessLogoSnapshot) return null;

  return <Image style={[{ ...LOGO_SIZES[invoiceForm.customizationLogoSize ?? DEFAULT_LOGO_SIZES] }]} src={logoUrl} />;
};
export const LogoInfo = memo(LogoInfoComponent);
