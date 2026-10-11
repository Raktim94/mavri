import { Text, View } from '@react-pdf/renderer';
import { memo, useMemo, type FC } from 'react';
import type { InvoiceFromData } from '../../../shared/types/invoice';
import type { Settings } from '../../../shared/types/settings';
import { buildPdfTotalsRows, type PdfTotalsLabels, type PdfTotalsRow } from './models/pdfTotalsModel';
import { PDF_STYLES, fontScaleFor } from './pdfTheme';

interface Props {
  invoiceForm?: InvoiceFromData;
  storeSettings?: Settings;
  labels: PdfTotalsLabels;
}

const TotalsRowView: FC<{
  row: PdfTotalsRow;
  fontSize: number;
  accentColor?: string;
}> = ({ row, fontSize, accentColor }) => {
  if (row.kind === 'divider') {
    return (
      <View style={[PDF_STYLES.row, PDF_STYLES.pt5, PDF_STYLES.pb5]}>
        <View style={PDF_STYLES.flexGrow} />
        <View style={[PDF_STYLES.border, PDF_STYLES.w100, PDF_STYLES.textEnd]} />
      </View>
    );
  }

  const textStyle = row.bold ? PDF_STYLES.regularBold : PDF_STYLES.regular;

  return (
    <View style={[PDF_STYLES.row, PDF_STYLES.pb5]}>
      <View style={PDF_STYLES.flexGrow} />
      <View style={[PDF_STYLES.row, PDF_STYLES.w100, PDF_STYLES.textEnd]}>
        <View style={[textStyle, PDF_STYLES.w50, { fontSize }]}>
          <Text>{row.label}</Text>
        </View>
        <View
          style={[
            textStyle,
            PDF_STYLES.w50,
            PDF_STYLES.alignEnd,
            { fontSize, color: row.accent ? accentColor : undefined }
          ]}
        >
          <Text>{row.value}</Text>
        </View>
      </View>
    </View>
  );
};

const FinancialInfoComponent: FC<Props> = ({ invoiceForm, storeSettings, labels }) => {
  const scale = fontScaleFor(invoiceForm?.invoiceCustomization);
  const accentColor = invoiceForm?.invoiceCustomization?.color;
  const rows = useMemo(
    () => buildPdfTotalsRows(invoiceForm, storeSettings, labels),
    [invoiceForm, storeSettings, labels]
  );

  return (
    <View style={PDF_STYLES.w50}>
      {rows.map(row => (
        <TotalsRowView
          key={row.kind}
          row={row}
          fontSize={row.bold ? scale.regularBold : scale.regular}
          accentColor={accentColor}
        />
      ))}
    </View>
  );
};

export const FinancialInfo = memo(FinancialInfoComponent);
