import { Image } from '@react-pdf/renderer';
import { memo, type FC } from 'react';
import type { InvoiceFromData } from '../../../shared/types/invoice';
import { DEFAULT_LOGO_SIZE_KEY, LOGO_SIZES } from './pdfTheme';

interface Props {
  invoiceForm?: InvoiceFromData;
  logoUrl?: string;
}

const LogoInfoComponent: FC<Props> = ({ invoiceForm, logoUrl }) => {
  if (!logoUrl) return null;
  if (!invoiceForm?.invoiceBusinessSnapshot?.businessLogo) return null;

  const size = LOGO_SIZES[invoiceForm?.invoiceCustomization?.logoSize ?? DEFAULT_LOGO_SIZE_KEY];

  return <Image style={{ ...size }} src={logoUrl} />;
};

export const LogoInfo = memo(LogoInfoComponent);
