import { Text } from '@react-pdf/renderer';
import { memo, type FC } from 'react';
import { InvoiceType } from '../../../shared/enums/invoiceType';
import type { InvoiceFromData } from '../../../shared/types/invoice';
import { DEFAULT_FONT_SIZES, FONT_SIZES, PDF_STYLES } from './constant';

interface Props {
  invoiceForm?: InvoiceFromData;
  pdfQUOTELabel: string;
  pdfINVOICELabel: string;
}
const TitleInfoComponent: FC<Props> = ({ invoiceForm, pdfINVOICELabel, pdfQUOTELabel }) => {
  return (
    <Text
      style={[
        PDF_STYLES.title,
        {
          color: invoiceForm?.customizationColor,
          fontSize: FONT_SIZES[invoiceForm?.customizationFontSizeSize ?? DEFAULT_FONT_SIZES].title
        }
      ]}
    >
      {invoiceForm?.invoiceType === InvoiceType.invoice ? pdfINVOICELabel : pdfQUOTELabel}
    </Text>
  );
};
export const TitleInfo = memo(TitleInfoComponent);
