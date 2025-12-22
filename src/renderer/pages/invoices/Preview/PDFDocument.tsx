import { Document, Font, Page } from '@react-pdf/renderer';
import { memo, type FC } from 'react';
import type { InvoiceFromData } from '../../../shared/types/invoice';
import type { Settings } from '../../../shared/types/settings';
import RobotoBold from './../../../assets/roboto/static/Roboto-Bold.ttf';
import RobotoItalic from './../../../assets/roboto/static/Roboto-Italic.ttf';
import RobotoRegular from './../../../assets/roboto/static/Roboto-Regular.ttf';
import { DEFAULT_FONT_SIZES, FONT_SIZES, PDF_STYLES } from './constant';
import { FinancialInfo } from './FinancialInfo';
import { Header } from './Header';
import { Items } from './Items';
import { Notes } from './Notes';

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
        <Header invoiceForm={invoiceForm} storeSettings={storeSettings} />
        <Items invoiceForm={invoiceForm} storeSettings={storeSettings} />
        <FinancialInfo invoiceForm={invoiceForm} storeSettings={storeSettings} />
        <Notes invoiceForm={invoiceForm} />
      </Page>
    </Document>
  );
};
export const PDFDocument = memo(PDFDocumentComponent);
