import { Image, Text, View } from '@react-pdf/renderer';
import { memo, type FC } from 'react';
import type { InvoiceFromData } from '../../../shared/types/invoice';
import { PDF_STYLES, fontScaleFor } from './pdfTheme';

interface Props {
  invoiceForm?: InvoiceFromData;
  signatureUrl?: string;
  authorisedSignatoryLabel: string;
}

const SignatureInfoComponent: FC<Props> = ({ invoiceForm, signatureUrl, authorisedSignatoryLabel }) => {
  if (!signatureUrl) return null;
  if (!invoiceForm?.signatureData) return null;

  const scale = fontScaleFor(invoiceForm?.invoiceCustomization);

  return (
    <View
      wrap={false}
      style={[PDF_STYLES.textEnd, PDF_STYLES.alignEnd, PDF_STYLES.pb20, PDF_STYLES.w100]}
      minPresenceAhead={40}
    >
      <Image src={signatureUrl} style={PDF_STYLES.signature} />
      <Text style={[PDF_STYLES.businessText, { fontSize: scale.businessText }]}>{authorisedSignatoryLabel}</Text>
    </View>
  );
};

export const SignatureInfo = memo(SignatureInfoComponent);
