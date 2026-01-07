import { Document, Font, Image, Page, View } from '@react-pdf/renderer';
import { memo, type FC } from 'react';
import { InvoiceStatus } from '../../../shared/enums/invoiceStatus';
import { LayoutType } from '../../../shared/enums/layoutType';
import type { AttachmentURL, InvoiceFromData, PdfTexts } from '../../../shared/types/invoice';
import type { Settings } from '../../../shared/types/settings';
import RobotoBold from './../../../assets/roboto/static/Roboto-Bold.ttf';
import RobotoItalic from './../../../assets/roboto/static/Roboto-Italic.ttf';
import RobotoRegular from './../../../assets/roboto/static/Roboto-Regular.ttf';
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
  watermarkUrl?: string;
  watermarkPaidUrl?: string;
}
const PDFDocumentComponent: FC<Props> = ({
  invoiceForm,
  storeSettings,
  logoUrl,
  attachmentUrls,
  pdfTexts,
  watermarkUrl,
  watermarkPaidUrl
}) => {
  return (
    <Document>
      <Page
        size={invoiceForm?.customizationPageFormat}
        style={[
          PDF_STYLES.page,
          { fontSize: FONT_SIZES[invoiceForm?.customizationFontSizeSize ?? DEFAULT_FONT_SIZES].page }
        ]}
      >
        {invoiceForm?.status === InvoiceStatus.paid && (
          <WatermarkPaidInfo invoiceForm={invoiceForm} watermarkPaidUrl={watermarkPaidUrl} />
        )}
        <WatermarkInfo invoiceForm={invoiceForm} watermarkUrl={watermarkUrl} />

        <HeaderInfo invoiceForm={invoiceForm} storeSettings={storeSettings} logoUrl={logoUrl} pdfTexts={pdfTexts} />
        <ItemsInfo
          invoiceForm={invoiceForm}
          storeSettings={storeSettings}
          itemLabel={pdfTexts.itemLabel}
          unitLabel={pdfTexts.unitLabel}
          qtyLabel={pdfTexts.qtyLabel}
          unitCostLabel={pdfTexts.unitCostLabel}
          totalLabel={pdfTexts.totalLabel2}
          itemTaxLabel={pdfTexts.itemTaxLabel}
        />
        <View
          wrap={false}
          style={[PDF_STYLES.row, PDF_STYLES.spaceBetween, PDF_STYLES.alignStart, PDF_STYLES.pt10]}
          minPresenceAhead={20}
        >
          {invoiceForm?.customizationLayout === LayoutType.compact && (
            <PaymentInfo invoiceForm={invoiceForm} paymentInfoLabel={pdfTexts.paymentInfo} />
          )}
          {invoiceForm?.customizationLayout !== LayoutType.compact && <View style={PDF_STYLES.flexGrow} />}
          <FinancialInfo
            invoiceForm={invoiceForm}
            storeSettings={storeSettings}
            subTotalLabel={pdfTexts.subTotalLabel}
            discountPrctLabel={pdfTexts.discountPrctLabel}
            discountLabel={pdfTexts.discountLabel}
            taxExclusiveLabel={pdfTexts.taxExclusiveLabel}
            taxInclusiveLabel={pdfTexts.taxInclusiveLabel}
            taxRateLabel={pdfTexts.taxRateLabel}
            taxExclusivePerItemLabel={pdfTexts.taxExclusivePerItemLabel}
            taxInclusivePerItemLabel={pdfTexts.taxInclusivePerItemLabel}
            shippingFeeLabel={pdfTexts.shippingFeeLabel}
            totalLabel={pdfTexts.totalLabel1}
            paidLabel={pdfTexts.paidLabel}
            balanceDueLabel={pdfTexts.balanceDueLabel}
            taxLabel={pdfTexts.taxLabel}
          />
        </View>
        <NotesInfo
          invoiceForm={invoiceForm}
          customerNoteLabel={pdfTexts.customerNote}
          termsConditionsLabel={pdfTexts.termsConditions}
        />
        <PageCounterInfo invoiceForm={invoiceForm} ofLabel={pdfTexts.of} pageLabel={pdfTexts.page} />
      </Page>
      {attachmentUrls.map(item => (
        <Page
          key={item.id}
          size={invoiceForm?.customizationPageFormat}
          style={[
            PDF_STYLES.page,
            { fontSize: FONT_SIZES[invoiceForm?.customizationFontSizeSize ?? DEFAULT_FONT_SIZES].page }
          ]}
        >
          <Image style={PDF_STYLES.attachment} src={item.url} />
          <PageCounterInfo invoiceForm={invoiceForm} ofLabel={pdfTexts.of} pageLabel={pdfTexts.page} />
        </Page>
      ))}
    </Document>
  );
};
export const PDFDocument = memo(PDFDocumentComponent);
