import { Text } from '@react-pdf/renderer';
import { memo, type FC } from 'react';
import type { InvoiceFromData } from '../../../shared/types/invoice';
import { PDF_STYLES, fontScaleFor } from './pdfTheme';

interface Props {
  invoiceForm?: InvoiceFromData;
  labels: { ofLabel: string; pageLabel: string };
}

const PageCounterInfoComponent: FC<Props> = ({ invoiceForm, labels }) => {
  const scale = fontScaleFor(invoiceForm?.invoiceCustomization);

  return (
    <Text
      fixed
      style={[PDF_STYLES.pageCounter, { fontSize: scale.pageCounter }]}
      render={({ pageNumber, totalPages }) =>
        totalPages > 1 ? `${labels.pageLabel} ${pageNumber} ${labels.ofLabel} ${totalPages}` : ''
      }
    />
  );
};

export const PageCounterInfo = memo(PageCounterInfoComponent);
