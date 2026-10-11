import { Document, Image, Page, Text, View } from '@react-pdf/renderer';
import { Fragment, memo, useMemo, type FC } from 'react';
import { InvoiceStatus } from '../../../shared/enums/invoiceStatus';
import type { AttachmentURL, InvoiceFromData, PdfTexts } from '../../../shared/types/invoice';
import type { LayoutSchema, TotalsRowBlock } from '../../../shared/types/layouts';
import type { Settings } from '../../../shared/types/settings';
import { FinancialInfo } from './FinancialInfo';
import { HeaderInfo } from './HeaderInfo';
import { ItemsInfo } from './ItemsInfo';
import { NotesInfo } from './NotesInfo';
import { PageCounterInfo } from './PageCounterInfo';
import { PaymentInfo } from './PaymentInfo';
import { SignatureInfo } from './SignatureInfo';
import { WatermarkInfo } from './WatermarkInfo';
import { WatermarkPaidInfo } from './WatermarkPaidInfo';
import { registerPdfFonts } from './pdfFonts';
import { PDF_STYLES, createFontFamilyStyle, fontScaleFor } from './pdfTheme';
import type { PdfTotalsLabels } from './models/pdfTotalsModel';

registerPdfFonts();

type PdfSection = NonNullable<LayoutSchema['sections']>[number];

interface Props {
  invoiceForm?: InvoiceFromData;
  storeSettings?: Settings;
  logoUrl?: string;
  qrCodeUrl?: string;
  signatureUrl?: string;
  attachmentUrls: AttachmentURL[];
  pdfTexts: PdfTexts;
  layoutRequired: string;
  watermarkUrl?: string;
  watermarkPaidUrl?: string;
}

const financialLabelsFrom = (pdfTexts: PdfTexts): PdfTotalsLabels => ({
  subTotalLabel: pdfTexts.subTotalLabel,
  discountLabel: pdfTexts.discountLabel,
  surchargeLabel: pdfTexts.surchargeLabel,
  incLabel: pdfTexts.incLabel,
  taxLabel: pdfTexts.taxLabel,
  taxExclusivePerItemLabel: pdfTexts.taxExclusivePerItemLabel,
  taxInclusivePerItemLabel: pdfTexts.taxInclusivePerItemLabel,
  shippingFeeLabel: pdfTexts.shippingFeeLabel,
  totalLabel: pdfTexts.totalLabel,
  paidLabel: pdfTexts.paidLabel,
  balanceDueLabel: pdfTexts.balanceDueLabel
});

const PDFDocumentComponent: FC<Props> = ({
  invoiceForm,
  storeSettings,
  logoUrl,
  qrCodeUrl,
  signatureUrl,
  attachmentUrls,
  pdfTexts,
  layoutRequired,
  watermarkUrl,
  watermarkPaidUrl
}) => {
  const customization = invoiceForm?.invoiceCustomization;
  const sections = invoiceForm?.invoiceLayoutSnapshot?.layoutSchema?.sections ?? [];
  const fontStyles = useMemo(() => createFontFamilyStyle(customization?.fontFamily), [customization?.fontFamily]);
  const scale = fontScaleFor(customization);
  const financialLabels = financialLabelsFrom(pdfTexts);

  const pageStyle = [PDF_STYLES.page, fontStyles.customFont, { fontSize: scale.page }];

  const renderWatermarks = (order?: 'default' | 'paidFirst') => (
    <Fragment key="watermark">
      {order === 'paidFirst' && invoiceForm?.status === InvoiceStatus.paid && (
        <WatermarkPaidInfo invoiceForm={invoiceForm} watermarkPaidUrl={watermarkPaidUrl} />
      )}
      <WatermarkInfo invoiceForm={invoiceForm} watermarkUrl={watermarkUrl} />
      {order !== 'paidFirst' && invoiceForm?.status === InvoiceStatus.paid && (
        <WatermarkPaidInfo invoiceForm={invoiceForm} watermarkPaidUrl={watermarkPaidUrl} />
      )}
    </Fragment>
  );

  const renderTotalsBlock = (block: TotalsRowBlock, index: number) => {
    if (block.type === 'spacer') return <View key={`spacer-${index}`} style={PDF_STYLES.flexGrow} />;

    if (block.type === 'paymentInfo') {
      return (
        <PaymentInfo
          key={`payment-${index}`}
          invoiceForm={invoiceForm}
          paymentInfoLabel={pdfTexts.paymentInfo}
          qrCodeUrl={qrCodeUrl}
          source={block.paymentSource}
        />
      );
    }

    return (
      <FinancialInfo
        key={`totals-${index}`}
        invoiceForm={invoiceForm}
        storeSettings={storeSettings}
        labels={financialLabels}
      />
    );
  };

  const renderSection = (section: PdfSection) => {
    switch (section.type) {
      case 'watermark':
        return renderWatermarks(section.watermarkOrder);
      case 'header':
        return (
          <HeaderInfo
            key="header"
            invoiceForm={invoiceForm}
            storeSettings={storeSettings}
            logoUrl={logoUrl}
            pdfTexts={pdfTexts}
            blocks={section.blocks ?? []}
          />
        );
      case 'itemsTable':
        return (
          <ItemsInfo
            key="itemsTable"
            invoiceForm={invoiceForm}
            storeSettings={storeSettings}
            columnSizing={section.columnSizing}
            labels={{
              itemLabel: pdfTexts.itemLabel,
              unitLabel: pdfTexts.unitLabel,
              qtyLabel: pdfTexts.qtyLabel,
              unitCostLabel: pdfTexts.unitCostLabel,
              totalLabel: pdfTexts.totalLabel,
              taxLabel: pdfTexts.taxLabel,
              discountLabel: pdfTexts.discountLabel
            }}
          />
        );
      case 'financialTotals':
        return (
          <View
            key="financialTotals"
            wrap={false}
            style={[PDF_STYLES.row, PDF_STYLES.spaceBetween, PDF_STYLES.alignStart, PDF_STYLES.pt10]}
            minPresenceAhead={20}
          >
            <View style={PDF_STYLES.flexGrow} />
            <FinancialInfo invoiceForm={invoiceForm} storeSettings={storeSettings} labels={financialLabels} />
          </View>
        );
      case 'paymentInfo':
        return (
          <View
            key="paymentInfo"
            wrap={false}
            style={[PDF_STYLES.row, PDF_STYLES.spaceBetween, PDF_STYLES.alignStart, PDF_STYLES.pt20]}
            minPresenceAhead={20}
          >
            <PaymentInfo invoiceForm={invoiceForm} paymentInfoLabel={pdfTexts.paymentInfo} qrCodeUrl={qrCodeUrl} />
          </View>
        );
      case 'totalsRow':
        return (
          <View
            key="totalsRow"
            wrap={false}
            style={[PDF_STYLES.row, PDF_STYLES.spaceBetween, PDF_STYLES.alignStart, PDF_STYLES.pt10]}
            minPresenceAhead={20}
          >
            {section.totalsBlocks?.map(renderTotalsBlock)}
          </View>
        );
      case 'notes':
        return (
          <NotesInfo
            key="notes"
            invoiceForm={invoiceForm}
            labels={{ customerNoteLabel: pdfTexts.customerNote, termsConditionsLabel: pdfTexts.termsConditions }}
          />
        );
      case 'signature':
        return (
          <SignatureInfo
            key="signature"
            invoiceForm={invoiceForm}
            signatureUrl={signatureUrl}
            authorisedSignatoryLabel={pdfTexts.authorisedSignatoryLabel}
          />
        );
      case 'pageCounter':
        return (
          <PageCounterInfo
            key="pageCounter"
            invoiceForm={invoiceForm}
            labels={{ ofLabel: pdfTexts.of, pageLabel: pdfTexts.page }}
          />
        );
      default:
        return null;
    }
  };

  return (
    <Document>
      <Page size={customization?.pageFormat} style={pageStyle}>
        {!invoiceForm?.layoutId || !invoiceForm.invoiceLayoutSnapshot?.layoutSchema ? (
          <View style={{ flexGrow: 1, justifyContent: 'center', alignItems: 'center' }}>
            <Text style={PDF_STYLES.layoutRequired}>{layoutRequired}</Text>
          </View>
        ) : (
          sections.filter(section => section.visible !== false).map(renderSection)
        )}
      </Page>

      {attachmentUrls.map(item => (
        <Page key={item.id} size={customization?.pageFormat} style={pageStyle}>
          <WatermarkInfo invoiceForm={invoiceForm} watermarkUrl={watermarkUrl} />
          <Image style={PDF_STYLES.attachment} src={item.url} />
          <PageCounterInfo invoiceForm={invoiceForm} labels={{ ofLabel: pdfTexts.of, pageLabel: pdfTexts.page }} />
        </Page>
      ))}
    </Document>
  );
};

export const PDFDocument = memo(PDFDocumentComponent);
