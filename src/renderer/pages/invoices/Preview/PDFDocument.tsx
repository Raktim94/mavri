import { Document, Font, Page, View } from '@react-pdf/renderer';
import { memo, type FC } from 'react';
import { InvoiceStatus } from '../../../shared/enums/invoiceStatus';
import { LayoutType } from '../../../shared/enums/layoutType';
import type { AttachmentURL, InvoiceFromData, PdfTexts } from '../../../shared/types/invoice';
import type { Settings } from '../../../shared/types/settings';
import RobotoBold from './../../../assets/roboto/static/Roboto-Bold.ttf';
import RobotoItalic from './../../../assets/roboto/static/Roboto-Italic.ttf';
import RobotoRegular from './../../../assets/roboto/static/Roboto-Regular.ttf';
import { AttachmentsInfo } from './AttachmentsInfo';
import { DEFAULT_FONT_SIZES, FONT_SIZES, PDF_STYLES } from './constant';
import { FinancialInfo } from './FinancialInfo';
import { HeaderInfo } from './HeaderInfo';
import { ItemsInfo } from './ItemsInfo';
import { NotesInfo } from './NotesInfo';
import { PageCounterInfo } from './PageCounterInfo';
import { PaymentInfo } from './PaymentInfo';
import { WatermarkInfo } from './WatermarkInfo';
import { WatermarkPaidInfo } from './WatermarkPaidInfo';

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
  logoUrl?: string;
  attachmentUrls: AttachmentURL[];
  pdfTexts: PdfTexts;
}
const PDFDocumentComponent: FC<Props> = ({ invoiceForm, storeSettings, logoUrl, attachmentUrls, pdfTexts }) => {
  return (
    <Document>
      <Page
        size={invoiceForm?.customizationPageFormat}
        style={[
          PDF_STYLES.page,
          { fontSize: FONT_SIZES[invoiceForm?.customizationFontSizeSize ?? DEFAULT_FONT_SIZES].page }
        ]}
      >
        <WatermarkInfo invoiceForm={invoiceForm} />
        {invoiceForm?.status === InvoiceStatus.paid && <WatermarkPaidInfo invoiceForm={invoiceForm} />}
        <HeaderInfo invoiceForm={invoiceForm} storeSettings={storeSettings} logoUrl={logoUrl} pdfTexts={pdfTexts} />
        <ItemsInfo invoiceForm={invoiceForm} storeSettings={storeSettings} />
        <View style={[PDF_STYLES.row, PDF_STYLES.spaceBetween, PDF_STYLES.alignStart, PDF_STYLES.mt10]}>
          {invoiceForm?.customizationLayout === LayoutType.compact && (
            <PaymentInfo invoiceForm={invoiceForm} paymentInfoLabel={pdfTexts.paymentInfo} />
          )}
          {invoiceForm?.customizationLayout !== LayoutType.compact && <View style={PDF_STYLES.flexGrow} />}
          <FinancialInfo invoiceForm={invoiceForm} storeSettings={storeSettings} />
        </View>
        <NotesInfo
          invoiceForm={invoiceForm}
          customerNoteLabel={pdfTexts.customerNote}
          termsConditionsLabel={pdfTexts.termsConditions}
        />
        <AttachmentsInfo attachmentUrls={attachmentUrls} />
        <PageCounterInfo invoiceForm={invoiceForm} ofLabel={pdfTexts.of} pageLabel={pdfTexts.page} />
      </Page>
    </Document>
  );
};
export const PDFDocument = memo(PDFDocumentComponent);
