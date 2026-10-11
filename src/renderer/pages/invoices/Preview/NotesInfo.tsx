import { Text, View } from '@react-pdf/renderer';
import { memo, type FC } from 'react';
import type { InvoiceFromData } from '../../../shared/types/invoice';
import { notesSections } from './models/infoLinesModel';
import { PDF_STYLES, fontScaleFor } from './pdfTheme';

interface Props {
  invoiceForm?: InvoiceFromData;
  labels: { customerNoteLabel: string; termsConditionsLabel: string };
}

const NotesInfoComponent: FC<Props> = ({ invoiceForm, labels }) => {
  const scale = fontScaleFor(invoiceForm?.invoiceCustomization);
  const sections = notesSections(invoiceForm, labels);

  return (
    <View style={[PDF_STYLES.pt20]}>
      {sections.map(section => {
        if (section.kind === 'thanks') {
          return (
            <View key="thanks" style={[PDF_STYLES.regular, PDF_STYLES.italic, { fontSize: scale.regular }]}>
              <Text>{section.text}</Text>
            </View>
          );
        }

        return (
          <View key={section.kind} style={[PDF_STYLES.pt10]}>
            <View style={[PDF_STYLES.regularBold, { fontSize: scale.regularBold }]}>
              <Text>{section.label}</Text>
            </View>
            <View style={[PDF_STYLES.regular, { fontSize: scale.regular }]}>
              <Text>{section.text}</Text>
            </View>
          </View>
        );
      })}
    </View>
  );
};

export const NotesInfo = memo(NotesInfoComponent);
