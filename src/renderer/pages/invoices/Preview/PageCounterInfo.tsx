import { Text } from '@react-pdf/renderer';
import { memo, type FC } from 'react';
import { useUppercaseTranslation } from '../../../shared/hooks/useUppercaseTranslation';
import type { InvoiceFromData } from '../../../shared/types/invoice';
import { DEFAULT_FONT_SIZES, FONT_SIZES, PDF_STYLES } from './constant';

interface Props {
  invoiceForm?: InvoiceFromData;
}
const PageCounterInfoComponent: FC<Props> = ({ invoiceForm }) => {
  const { tt } = useUppercaseTranslation(invoiceForm?.customizationLabelUpperCase);

  return (
    <Text
      fixed
      style={[
        PDF_STYLES.pageCounter,
        { fontSize: FONT_SIZES[invoiceForm?.customizationFontSizeSize ?? DEFAULT_FONT_SIZES].pageCounter }
      ]}
      render={({ pageNumber, totalPages }) =>
        totalPages > 1 ? `${tt('common.page')} ${pageNumber} ${tt('common.of')} ${totalPages}` : ''
      }
    />
  );
};
export const PageCounterInfo = memo(PageCounterInfoComponent);
