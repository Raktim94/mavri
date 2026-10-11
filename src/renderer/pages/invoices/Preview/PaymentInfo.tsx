import { Text, View } from '@react-pdf/renderer';
import { memo, type FC } from 'react';
import type { InvoiceFromData } from '../../../shared/types/invoice';
import type { PaymentSource } from '../../../shared/types/layouts';
import { paymentInfoLines } from './models/infoLinesModel';
import { QRCodeInfo } from './QRCodeInfo';
import { PDF_STYLES, fontScaleFor } from './pdfTheme';

interface Props {
  qrCodeUrl?: string;
  invoiceForm?: InvoiceFromData;
  paymentInfoLabel: string;
  source?: PaymentSource;
}

const PaymentInfoComponent: FC<Props> = ({ invoiceForm, qrCodeUrl, paymentInfoLabel, source = 'bank' }) => {
  const lines = paymentInfoLines(invoiceForm, source);
  if (!lines) return null;

  const scale = fontScaleFor(invoiceForm?.invoiceCustomization);

  if (source === 'legacyBusiness') {
    return (
      <View style={[PDF_STYLES.alignStart, PDF_STYLES.gap4]}>
        <Text style={[PDF_STYLES.regularBold, { fontSize: scale.regularBold }]}>{paymentInfoLabel}:</Text>
        <Text style={[PDF_STYLES.businessText, { fontSize: scale.businessText }]}>{lines[0]}</Text>
      </View>
    );
  }

  return (
    <View style={[PDF_STYLES.alignStart, PDF_STYLES.gap4]}>
      <Text style={[PDF_STYLES.regularBold, { fontSize: scale.regularBold }]}>{paymentInfoLabel}:</Text>
      <View style={[PDF_STYLES.alignStart, PDF_STYLES.gap4, PDF_STYLES.row]}>
        <View style={[PDF_STYLES.alignStart, PDF_STYLES.gap4]}>
          {lines.map((line, index) => (
            <Text key={index} style={[PDF_STYLES.businessText, { fontSize: scale.businessText }]}>
              {line}
            </Text>
          ))}
        </View>
        <QRCodeInfo qrCodeUrl={qrCodeUrl} invoiceForm={invoiceForm} />
      </View>
    </View>
  );
};

export const PaymentInfo = memo(PaymentInfoComponent);
