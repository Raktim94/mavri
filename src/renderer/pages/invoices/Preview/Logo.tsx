import { Image } from '@react-pdf/renderer';
import { memo, type FC } from 'react';
import type { InvoiceFromData } from '../../../shared/types/invoice';
import { uint8ArrayToDataUrl } from '../../../shared/utils/dataUrlFunctions';
import { DEFAULT_LOGO_SIZES, LOGO_SIZES } from './constant';

interface Props {
  invoiceForm?: InvoiceFromData;
}
const LogoComponent: FC<Props> = ({ invoiceForm }) => {
  if (!invoiceForm?.businessLogoSnapshot) return null;

  return (
    <Image
      style={[{ ...LOGO_SIZES[invoiceForm.customizationLogoSize ?? DEFAULT_LOGO_SIZES] }]}
      src={uint8ArrayToDataUrl(invoiceForm.businessLogoSnapshot, invoiceForm.businessFileTypeSnapshot)}
    />
  );
};
export const Logo = memo(LogoComponent);
