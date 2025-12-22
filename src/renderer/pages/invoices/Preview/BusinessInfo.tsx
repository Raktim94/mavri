import { Image, Text, View } from '@react-pdf/renderer';
import { memo, type FC } from 'react';
import type { InvoiceFromData } from '../../../shared/types/invoice';
import { uint8ArrayToDataUrl } from '../../../shared/utils/dataUrlFunctions';
import { DEFAULT_FONT_SIZES, DEFAULT_LOGO_SIZES, FONT_SIZES, LOGO_SIZES, PDF_STYLES } from './constant';

interface Props {
  invoiceForm?: InvoiceFromData;
}
const BusinessInfoComponent: FC<Props> = ({ invoiceForm }) => {
  return (
    <View style={[PDF_STYLES.row, PDF_STYLES.alignStart, PDF_STYLES.gap5]}>
      {invoiceForm?.businessLogoSnapshot && (
        <Image
          style={[{ ...LOGO_SIZES[invoiceForm?.customizationLogoSize ?? DEFAULT_LOGO_SIZES] }]}
          src={uint8ArrayToDataUrl(invoiceForm.businessLogoSnapshot, invoiceForm.businessFileTypeSnapshot)}
        />
      )}
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
