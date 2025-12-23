import { Document, Font, Page, View } from '@react-pdf/renderer';
import { memo, type FC } from 'react';
import { LayoutType } from '../../../shared/enums/layoutType';
import type { InvoiceFromData } from '../../../shared/types/invoice';
import type { Settings } from '../../../shared/types/settings';
import RobotoBold from './../../../assets/roboto/static/Roboto-Bold.ttf';
import RobotoItalic from './../../../assets/roboto/static/Roboto-Italic.ttf';
import RobotoRegular from './../../../assets/roboto/static/Roboto-Regular.ttf';
import { DEFAULT_FONT_SIZES, FONT_SIZES, PDF_STYLES } from './constant';
import { FinancialInfo } from './FinancialInfo';
import { HeaderInfo } from './HeaderInfo';
import { ItemsInfo } from './ItemsInfo';
import { NotesInfo } from './NotesInfo';
import { PaymentInfo } from './PaymentInfo';

Font.register({
  family: 'Roboto',
  src: RobotoRegular
});

Font.register({
  family: 'Roboto',
  src: RobotoBold,
  fontWeight: 'bold'
});

Font.register({
  family: 'Roboto',
  src: RobotoItalic,
  fontStyle: 'italic'
});

interface Props {
  invoiceForm?: InvoiceFromData;
  storeSettings?: Settings;
}
const PDFDocumentComponent: FC<Props> = ({ invoiceForm, storeSettings }) => {
  return (
    <Document>
      <Page
        size={invoiceForm?.customizationPageFormat}
        style={[
          PDF_STYLES.page,
          { fontSize: FONT_SIZES[invoiceForm?.customizationFontSizeSize ?? DEFAULT_FONT_SIZES].page }
        ]}
      >
        <HeaderInfo invoiceForm={invoiceForm} storeSettings={storeSettings} />
        <ItemsInfo invoiceForm={invoiceForm} storeSettings={storeSettings} />
        <View style={[PDF_STYLES.row, PDF_STYLES.spaceBetween, PDF_STYLES.alignStart, PDF_STYLES.mt10]}>
          {invoiceForm?.customizationLayout === LayoutType.compact && <PaymentInfo invoiceForm={invoiceForm} />}
          {invoiceForm?.customizationLayout !== LayoutType.compact && <View style={PDF_STYLES.flexGrow} />}
          <FinancialInfo invoiceForm={invoiceForm} storeSettings={storeSettings} />
        </View>
        <NotesInfo invoiceForm={invoiceForm} />
      </Page>
    </Document>
  );
};
export const PDFDocument = memo(PDFDocumentComponent);
