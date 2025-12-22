import { Text, View } from '@react-pdf/renderer';
import { memo, type FC } from 'react';
import { LayoutType } from '../../../shared/enums/layoutType';
import type { InvoiceFromData } from '../../../shared/types/invoice';
import { DEFAULT_FONT_SIZES, FONT_SIZES, PDF_STYLES } from './constant';
import { Logo } from './Logo';

interface Props {
  invoiceForm?: InvoiceFromData;
}
const BusinessInfoComponent: FC<Props> = ({ invoiceForm }) => {
  return (
    <View style={[PDF_STYLES.row, PDF_STYLES.alignStart, PDF_STYLES.gap5]}>
      {invoiceForm?.customizationLayout === LayoutType.classic && <Logo invoiceForm={invoiceForm} />}

      <View style={[PDF_STYLES.gap4, PDF_STYLES.alignStart, PDF_STYLES.w50]}>
        <Text
          style={[
            PDF_STYLES.business,
            { fontSize: FONT_SIZES[invoiceForm?.customizationFontSizeSize ?? DEFAULT_FONT_SIZES].business }
          ]}
        >
          {invoiceForm?.businessNameSnapshot}
        </Text>
        <Text
          style={[
            PDF_STYLES.businessText,
            { fontSize: FONT_SIZES[invoiceForm?.customizationFontSizeSize ?? DEFAULT_FONT_SIZES].businessText }
          ]}
        >
          {invoiceForm?.businessRoleSnapshot}
        </Text>
        <Text
          style={[
            PDF_STYLES.businessText,
            { fontSize: FONT_SIZES[invoiceForm?.customizationFontSizeSize ?? DEFAULT_FONT_SIZES].businessText }
          ]}
        >
          {invoiceForm?.businessAddressSnapshot}
        </Text>
        <Text
          style={[
            PDF_STYLES.businessText,
            { fontSize: FONT_SIZES[invoiceForm?.customizationFontSizeSize ?? DEFAULT_FONT_SIZES].businessText }
          ]}
        >
          {invoiceForm?.businessEmailSnapshot}
        </Text>
        <Text
          style={[
            PDF_STYLES.businessText,
            { fontSize: FONT_SIZES[invoiceForm?.customizationFontSizeSize ?? DEFAULT_FONT_SIZES].businessText }
          ]}
        >
          {invoiceForm?.businessPhoneSnapshot}
        </Text>
        <Text
          style={[
            PDF_STYLES.businessText,
            { fontSize: FONT_SIZES[invoiceForm?.customizationFontSizeSize ?? DEFAULT_FONT_SIZES].businessText }
          ]}
        >
          {invoiceForm?.businessAdditionalSnapshot}
        </Text>
      </View>
    </View>
  );
};
export const BusinessInfo = memo(BusinessInfoComponent);
