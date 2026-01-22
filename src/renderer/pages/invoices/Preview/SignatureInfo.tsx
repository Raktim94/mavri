import { Image } from '@react-pdf/renderer';
import { memo, type FC } from 'react';
import type { InvoiceFromData } from '../../../shared/types/invoice';
import { PDF_STYLES } from './constant';

interface Props {
  invoiceForm?: InvoiceFromData;
  signatureUrl?: string;
}
const SignatureInfoComponent: FC<Props> = ({ invoiceForm, signatureUrl }) => {
  if (!signatureUrl) return null;
  if (!invoiceForm?.signatureData) return null;

  return <Image fixed src={signatureUrl} style={PDF_STYLES.signature} />;
};
export const SignatureInfo = memo(SignatureInfoComponent);
