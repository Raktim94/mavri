import { View } from '@react-pdf/renderer';
import { memo, type FC } from 'react';
import { LayoutType } from '../../../shared/enums/layoutType';
import type { InvoiceFromData } from '../../../shared/types/invoice';
import type { Settings } from '../../../shared/types/settings';
import { BusinessInfo } from './BusinessInfo';
import { ClientInfo } from './ClientInfo';
import { PDF_STYLES } from './constant';
import { InvoiceInformationInfo } from './InvoiceInformationInfo';
import { LogoInfo } from './LogoInfo';
import { PaymentInfo } from './PaymentInfo';
import { TitleInfo } from './TitleInfo';

interface Props {
  invoiceForm?: InvoiceFromData;
  storeSettings?: Settings;
}
const HeaderInfoComponent: FC<Props> = ({ invoiceForm, storeSettings }) => {
  return (
    <View style={PDF_STYLES.header}>
      {invoiceForm?.customizationLayout === LayoutType.modern && (
        <View style={[PDF_STYLES.row, PDF_STYLES.spaceBetween, PDF_STYLES.alignStart, PDF_STYLES.mb20]}>
          <TitleInfo invoiceForm={invoiceForm} />
          <LogoInfo invoiceForm={invoiceForm} />
        </View>
      )}
      {invoiceForm?.customizationLayout === LayoutType.compact && (
        <>
          <View style={[PDF_STYLES.alignCenter, PDF_STYLES.mb20]}>
            <TitleInfo invoiceForm={invoiceForm} />
          </View>
          <View style={[PDF_STYLES.row, PDF_STYLES.spaceBetween, PDF_STYLES.alignStart]}>
            <BusinessInfo invoiceForm={invoiceForm} />
            <ClientInfo invoiceForm={invoiceForm} />
            <InvoiceInformationInfo storeSettings={storeSettings} invoiceForm={invoiceForm} />
          </View>
        </>
      )}
      {invoiceForm?.customizationLayout !== LayoutType.compact && (
        <>
          <View style={[PDF_STYLES.row, PDF_STYLES.spaceBetween, PDF_STYLES.alignStart]}>
            <BusinessInfo invoiceForm={invoiceForm} />
            <InvoiceInformationInfo storeSettings={storeSettings} invoiceForm={invoiceForm} />
          </View>
          <View style={[PDF_STYLES.row, PDF_STYLES.spaceBetween, PDF_STYLES.alignStart, PDF_STYLES.mt20]}>
            <ClientInfo invoiceForm={invoiceForm} />
            <View style={PDF_STYLES.flexGrow} />
            <PaymentInfo invoiceForm={invoiceForm} />
          </View>
        </>
      )}
    </View>
  );
};
export const HeaderInfo = memo(HeaderInfoComponent);
