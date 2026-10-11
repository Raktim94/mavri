import { Text, View } from '@react-pdf/renderer';
import { memo, type FC } from 'react';
import type { InvoiceFromData } from '../../../shared/types/invoice';
import { businessInfoLines } from './models/infoLinesModel';
import { PDF_STYLES, fontScaleFor } from './pdfTheme';

interface Props {
  invoiceForm?: InvoiceFromData;
}

const BusinessInfoComponent: FC<Props> = ({ invoiceForm }) => {
  const scale = fontScaleFor(invoiceForm?.invoiceCustomization);
  const lines = businessInfoLines(invoiceForm);

  return (
    <View style={[PDF_STYLES.gap4, PDF_STYLES.alignStart]}>
      <Text style={[PDF_STYLES.business, { fontSize: scale.business }]}>{lines[0]}</Text>
      {lines.slice(1).map((line, index) => (
        <Text key={index} style={[PDF_STYLES.businessText, { fontSize: scale.businessText }]}>
          {line}
        </Text>
      ))}
    </View>
  );
};

export const BusinessInfo = memo(BusinessInfoComponent);
