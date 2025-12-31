import { Text, View } from '@react-pdf/renderer';
import { memo, type FC } from 'react';
import { LayoutType } from '../../../shared/enums/layoutType';
import type { InvoiceFromData } from '../../../shared/types/invoice';
import { DEFAULT_FONT_SIZES, FONT_SIZES, PDF_STYLES } from './constant';

interface Props {
  invoiceForm?: InvoiceFromData;
  billToLabel: string;
}
const ClientInfoComponent: FC<Props> = ({ invoiceForm, billToLabel }) => {
  return (
    <View
      style={[
        PDF_STYLES.alignStart,
        PDF_STYLES.gap4,
        invoiceForm?.customizationLayout === LayoutType.compact ? PDF_STYLES.w100 : PDF_STYLES.w50
      ]}
    >
      <Text
        style={[
          PDF_STYLES.regularBold,
          { fontSize: FONT_SIZES[invoiceForm?.customizationFontSizeSize ?? DEFAULT_FONT_SIZES].regularBold }
        ]}
      >
        {billToLabel}:
      </Text>
      <Text
        style={[
          PDF_STYLES.businessText,
          { fontSize: FONT_SIZES[invoiceForm?.customizationFontSizeSize ?? DEFAULT_FONT_SIZES].businessText }
        ]}
      >
        {invoiceForm?.clientNameSnapshot}
      </Text>
      {invoiceForm?.clientAddressSnapshot && (
        <Text
          style={[
            PDF_STYLES.businessText,
            { fontSize: FONT_SIZES[invoiceForm?.customizationFontSizeSize ?? DEFAULT_FONT_SIZES].businessText }
          ]}
        >
          {invoiceForm?.clientAddressSnapshot}
        </Text>
      )}
      {invoiceForm?.clientEmailSnapshot && (
        <Text
          style={[
            PDF_STYLES.businessText,
            { fontSize: FONT_SIZES[invoiceForm?.customizationFontSizeSize ?? DEFAULT_FONT_SIZES].businessText }
          ]}
        >
          {invoiceForm?.clientEmailSnapshot}
        </Text>
      )}
      {invoiceForm?.clientPhoneSnapshot && (
        <Text
          style={[
            PDF_STYLES.businessText,
            { fontSize: FONT_SIZES[invoiceForm?.customizationFontSizeSize ?? DEFAULT_FONT_SIZES].businessText }
          ]}
        >
          {invoiceForm?.clientPhoneSnapshot}
        </Text>
      )}
      {invoiceForm?.clientCodeSnapshot && (
        <Text
          style={[
            PDF_STYLES.businessText,
            { fontSize: FONT_SIZES[invoiceForm?.customizationFontSizeSize ?? DEFAULT_FONT_SIZES].businessText }
          ]}
        >
          {invoiceForm?.clientCodeSnapshot}
        </Text>
      )}
      {invoiceForm?.clientAdditionalSnapshot && (
        <Text
          style={[
            PDF_STYLES.businessText,
            { fontSize: FONT_SIZES[invoiceForm?.customizationFontSizeSize ?? DEFAULT_FONT_SIZES].businessText }
          ]}
        >
          {invoiceForm?.clientAdditionalSnapshot}
        </Text>
      )}
    </View>
  );
};
export const ClientInfo = memo(ClientInfoComponent);
