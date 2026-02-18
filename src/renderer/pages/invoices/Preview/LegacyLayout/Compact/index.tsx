import { Page, View } from '@react-pdf/renderer';
import { memo, useMemo, type FC } from 'react';
import { InvoiceStatus } from '../../../../../shared/enums/invoiceStatus';
import type { InvoiceFromData, PdfTexts } from '../../../../../shared/types/invoice';
import type { Settings } from '../../../../../shared/types/settings';
import { createCustomFontStyles, DEFAULT_FONT_SIZES, FONT_SIZES, PDF_STYLES } from './../../constant';
import { FinancialInfo } from './../../FinancialInfo';
import { ItemsInfo } from './../../ItemsInfo';
import { NotesInfo } from './../../NotesInfo';
import { PageCounterInfo } from './../../PageCounterInfo';
import { SignatureInfo } from './../../SignatureInfo';
import { WatermarkInfo } from './../../WatermarkInfo';
import { WatermarkPaidInfo } from './../../WatermarkPaidInfo';
import { PaymentInfo } from './../PaymentInfo';
import { HeaderInfo } from './HeaderInfo';

interface Props {
  invoiceForm?: InvoiceFromData;
  storeSettings?: Settings;
  logoUrl?: string;
  signatureUrl?: string;
  pdfTexts: PdfTexts;
  watermarkUrl?: string;
  watermarkPaidUrl?: string;
}
const CompactLayoutComponent: FC<Props> = ({
  invoiceForm,
  storeSettings,
  logoUrl,
  signatureUrl,
  pdfTexts,
  watermarkUrl,
  watermarkPaidUrl
}) => {
  const dynamicStyle = useMemo(
    () => createCustomFontStyles(invoiceForm?.invoiceCustomization?.fontFamily),
    [invoiceForm?.invoiceCustomization?.fontFamily]
  );

  return (
    <Page
      size={invoiceForm?.invoiceCustomization?.pageFormat}
      style={[
        PDF_STYLES.page,
        dynamicStyle.customFont,
        {
          fontSize: FONT_SIZES[invoiceForm?.invoiceCustomization?.fontSize ?? DEFAULT_FONT_SIZES].page
        }
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
        labels={{
          itemLabel: pdfTexts.itemLabel,
          unitLabel: pdfTexts.unitLabel,
          qtyLabel: pdfTexts.qtyLabel,
          unitCostLabel: pdfTexts.unitCostLabel,
          totalLabel: pdfTexts.totalLabel2,
          itemTaxLabel: pdfTexts.itemTaxLabel
        }}
      />
      <View
        wrap={false}
        style={[PDF_STYLES.row, PDF_STYLES.spaceBetween, PDF_STYLES.alignStart, PDF_STYLES.pt10]}
        minPresenceAhead={20}
      >
        <PaymentInfo invoiceForm={invoiceForm} paymentInfoLabel={pdfTexts.paymentInfo} />

        <View style={PDF_STYLES.flexGrow} />

        <FinancialInfo
          invoiceForm={invoiceForm}
          storeSettings={storeSettings}
          labels={{
            subTotalLabel: pdfTexts.subTotalLabel,
            discountPrctLabel: pdfTexts.discountPrctLabel,
            discountLabel: pdfTexts.discountLabel,
            taxExclusiveLabel: pdfTexts.taxExclusiveLabel,
            taxInclusiveLabel: pdfTexts.taxInclusiveLabel,
            taxRateLabel: pdfTexts.taxRateLabel,
            taxExclusivePerItemLabel: pdfTexts.taxExclusivePerItemLabel,
            taxInclusivePerItemLabel: pdfTexts.taxInclusivePerItemLabel,
            shippingFeeLabel: pdfTexts.shippingFeeLabel,
            totalLabel: pdfTexts.totalLabel1,
            paidLabel: pdfTexts.paidLabel,
            balanceDueLabel: pdfTexts.balanceDueLabel,
            taxLabel: pdfTexts.taxLabel
          }}
        />
      </View>
      <NotesInfo
        invoiceForm={invoiceForm}
        labels={{
          customerNoteLabel: pdfTexts.customerNote,
          termsConditionsLabel: pdfTexts.termsConditions
        }}
      />
      <PageCounterInfo
        invoiceForm={invoiceForm}
        labels={{
          ofLabel: pdfTexts.of,
          pageLabel: pdfTexts.page
        }}
      />
      <SignatureInfo invoiceForm={invoiceForm} signatureUrl={signatureUrl} />
    </Page>
  );
};
export const CompactLayout = memo(CompactLayoutComponent);
