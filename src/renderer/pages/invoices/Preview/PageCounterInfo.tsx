import { Text } from '@react-pdf/renderer';
import { memo, type FC } from 'react';
import type { InvoiceFromData } from '../../../shared/types/invoice';
import { DEFAULT_FONT_SIZES, FONT_SIZES, PDF_STYLES } from './constant';

interface Props {
  invoiceForm?: InvoiceFromData;
  ofLabel: string;
  pageLabel: string;
}
const PageCounterInfoComponent: FC<Props> = ({ invoiceForm, ofLabel, pageLabel }) => {
  return (
    <Text
      fixed
      style={[
        PDF_STYLES.pageCounter,
        { fontSize: FONT_SIZES[invoiceForm?.customizationFontSizeSize ?? DEFAULT_FONT_SIZES].pageCounter }
      ]}
      render={({ pageNumber, totalPages }) =>
        totalPages > 1 ? `${pageLabel} ${pageNumber} ${ofLabel} ${totalPages}` : ''
      }
    />
  );
};
export const PageCounterInfo = memo(PageCounterInfoComponent);
