import { Text, View } from '@react-pdf/renderer';
import { memo, type FC } from 'react';
import { LayoutType } from '../../../shared/enums/layoutType';
import type { InvoiceFromData } from '../../../shared/types/invoice';
import { DEFAULT_FONT_SIZES, FONT_SIZES, PDF_STYLES } from './constant';
import { LogoInfo } from './LogoInfo';

interface Props {
  invoiceForm?: InvoiceFromData;
  logoUrl?: string;
}
const BusinessInfoComponent: FC<Props> = ({ invoiceForm, logoUrl }) => {
  return (
    <View style={[PDF_STYLES.row, PDF_STYLES.alignStart, PDF_STYLES.gap5]}>
      {invoiceForm?.customizationLayout === LayoutType.classic && (
        <LogoInfo invoiceForm={invoiceForm} logoUrl={logoUrl} />
      )}

      <View
        style={[
          PDF_STYLES.gap4,
          PDF_STYLES.alignStart,
          invoiceForm?.customizationLayout === LayoutType.compact ? PDF_STYLES.w100 : PDF_STYLES.w50
        ]}
      >
        <Text
          style={[
            PDF_STYLES.business,
            { fontSize: FONT_SIZES[invoiceForm?.customizationFontSizeSize ?? DEFAULT_FONT_SIZES].business }
          ]}
        >
          {invoiceForm?.businessNameSnapshot}
        </Text>
        {invoiceForm?.businessRoleSnapshot && (
          <Text
            style={[
              PDF_STYLES.businessText,
              { fontSize: FONT_SIZES[invoiceForm?.customizationFontSizeSize ?? DEFAULT_FONT_SIZES].businessText }
            ]}
          >
            {invoiceForm?.businessRoleSnapshot}
          </Text>
        )}
        {invoiceForm?.businessAddressSnapshot && (
          <Text
            style={[
              PDF_STYLES.businessText,
              { fontSize: FONT_SIZES[invoiceForm?.customizationFontSizeSize ?? DEFAULT_FONT_SIZES].businessText }
            ]}
          >
            {invoiceForm?.businessAddressSnapshot}
          </Text>
        )}
        {invoiceForm?.businessEmailSnapshot && (
          <Text
            style={[
              PDF_STYLES.businessText,
              { fontSize: FONT_SIZES[invoiceForm?.customizationFontSizeSize ?? DEFAULT_FONT_SIZES].businessText }
            ]}
          >
            {invoiceForm?.businessEmailSnapshot}
          </Text>
        )}
        {invoiceForm?.businessPhoneSnapshot && (
          <Text
            style={[
              PDF_STYLES.businessText,
              { fontSize: FONT_SIZES[invoiceForm?.customizationFontSizeSize ?? DEFAULT_FONT_SIZES].businessText }
            ]}
          >
            {invoiceForm?.businessPhoneSnapshot}
          </Text>
        )}
        {invoiceForm?.businessAdditionalSnapshot && (
          <Text
            style={[
              PDF_STYLES.businessText,
              { fontSize: FONT_SIZES[invoiceForm?.customizationFontSizeSize ?? DEFAULT_FONT_SIZES].businessText }
            ]}
          >
            {invoiceForm?.businessAdditionalSnapshot}
          </Text>
        )}
      </View>
    </View>
  );
};
export const BusinessInfo = memo(BusinessInfoComponent);
