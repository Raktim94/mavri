import { Text, View } from '@react-pdf/renderer';
import { memo, type FC } from 'react';
import type { InvoiceFromData } from '../../../shared/types/invoice';
import { clientInfoLines } from './models/infoLinesModel';
import { PDF_STYLES, fontScaleFor } from './pdfTheme';

interface Props {
  invoiceForm?: InvoiceFromData;
  billToLabel: string;
}

const ClientInfoComponent: FC<Props> = ({ invoiceForm, billToLabel }) => {
  const scale = fontScaleFor(invoiceForm?.invoiceCustomization);
  const lines = clientInfoLines(invoiceForm);

  return (
    <View style={[PDF_STYLES.alignStart, PDF_STYLES.gap4]}>
      <Text style={[PDF_STYLES.regularBold, { fontSize: scale.regularBold }]}>{billToLabel}:</Text>
      {lines.map((line, index) => (
        <Text key={index} style={[PDF_STYLES.businessText, { fontSize: scale.businessText }]}>
          {line}
        </Text>
      ))}
    </View>
  );
};

export const ClientInfo = memo(ClientInfoComponent);
