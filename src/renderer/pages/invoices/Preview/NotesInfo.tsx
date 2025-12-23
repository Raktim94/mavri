import { Text, View } from '@react-pdf/renderer';
import { memo, type FC } from 'react';
import { useUppercaseTranslation } from '../../../shared/hooks/useUppercaseTranslation';
import type { InvoiceFromData } from '../../../shared/types/invoice';
import { DEFAULT_FONT_SIZES, FONT_SIZES, PDF_STYLES } from './constant';

interface Props {
  invoiceForm?: InvoiceFromData;
}
const NotesInfoComponent: FC<Props> = ({ invoiceForm }) => {
  const { tt } = useUppercaseTranslation(invoiceForm?.customizationLabelUpperCase);

  return (
    <View style={[PDF_STYLES.mt20]}>
      {invoiceForm?.thanksNotes && (
        <View
          style={[
            PDF_STYLES.regular,
            PDF_STYLES.italic,
            { fontSize: FONT_SIZES[invoiceForm?.customizationFontSizeSize ?? DEFAULT_FONT_SIZES].regular }
          ]}
        >
          <Text>{invoiceForm?.thanksNotes}</Text>
        </View>
      )}
      {invoiceForm?.customerNotes && (
        <View style={[PDF_STYLES.mt10]}>
          <View
            style={[
              PDF_STYLES.regularBold,
              { fontSize: FONT_SIZES[invoiceForm?.customizationFontSizeSize ?? DEFAULT_FONT_SIZES].regularBold }
            ]}
          >
            <Text>{tt('invoices.customerNote')}</Text>
          </View>
          <View
            style={[
              PDF_STYLES.regular,
              { fontSize: FONT_SIZES[invoiceForm?.customizationFontSizeSize ?? DEFAULT_FONT_SIZES].regular }
            ]}
          >
            <Text>{invoiceForm?.customerNotes}</Text>
          </View>
        </View>
      )}
      {invoiceForm?.termsConditionNotes && (
        <View style={[PDF_STYLES.mt10]}>
          <View
            style={[
              PDF_STYLES.regularBold,
              { fontSize: FONT_SIZES[invoiceForm?.customizationFontSizeSize ?? DEFAULT_FONT_SIZES].regularBold }
            ]}
          >
            <Text>{tt('invoices.termsConditions')}</Text>
          </View>
          <View
            style={[
              PDF_STYLES.regular,
              { fontSize: FONT_SIZES[invoiceForm?.customizationFontSizeSize ?? DEFAULT_FONT_SIZES].regular }
            ]}
          >
            <Text>{invoiceForm?.termsConditionNotes}</Text>
          </View>
        </View>
      )}
    </View>
  );
};
export const NotesInfo = memo(NotesInfoComponent);
