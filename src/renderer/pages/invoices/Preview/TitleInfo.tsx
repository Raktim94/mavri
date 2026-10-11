import { Text } from '@react-pdf/renderer';
import { memo, type FC } from 'react';
import { InvoiceType } from '../../../shared/enums/invoiceType';
import type { InvoiceFromData } from '../../../shared/types/invoice';
import { PDF_STYLES, fontScaleFor } from './pdfTheme';

interface Props {
  invoiceForm?: InvoiceFromData;
  labels: { pdfINVOICELabel: string; pdfQUOTELabel: string };
}

const TitleInfoComponent: FC<Props> = ({ invoiceForm, labels }) => {
  const scale = fontScaleFor(invoiceForm?.invoiceCustomization);
  const title = invoiceForm?.invoiceType === InvoiceType.invoice ? labels.pdfINVOICELabel : labels.pdfQUOTELabel;

  return (
    <Text style={[PDF_STYLES.title, { color: invoiceForm?.invoiceCustomization?.color, fontSize: scale.title }]}>
      {title}
    </Text>
  );
};

export const TitleInfo = memo(TitleInfoComponent);
