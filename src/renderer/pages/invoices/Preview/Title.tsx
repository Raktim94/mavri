import { Text } from '@react-pdf/renderer';
import { memo, type FC } from 'react';
import { InvoiceType } from '../../../shared/enums/invoiceType';
import { useUppercaseTranslation } from '../../../shared/hooks/useUppercaseTranslation';
import type { InvoiceFromData } from '../../../shared/types/invoice';
import { DEFAULT_FONT_SIZES, FONT_SIZES, PDF_STYLES } from './constant';

interface Props {
  invoiceForm?: InvoiceFromData;
}
const TitleComponent: FC<Props> = ({ invoiceForm }) => {
  const { tt } = useUppercaseTranslation(invoiceForm?.customizationLabelUpperCase);

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
      {invoiceForm?.invoiceType === InvoiceType.invoice ? tt('invoices.pdfINVOICE') : tt('invoices.pdfQUOTE')}
    </Text>
  );
};
export const Title = memo(TitleComponent);
