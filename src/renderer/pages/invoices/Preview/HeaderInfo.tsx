import { View } from '@react-pdf/renderer';
import { memo, type FC, type ReactNode } from 'react';
import type { InvoiceFromData, PdfTexts } from '../../../shared/types/invoice';
import type { HeaderBlock } from '../../../shared/types/layouts';
import type { Settings } from '../../../shared/types/settings';
import { BusinessInfo } from './BusinessInfo';
import { ClientInfo } from './ClientInfo';
import { InvoiceInformationInfo } from './InvoiceInformationInfo';
import { LogoInfo } from './LogoInfo';
import { PaymentInfo } from './PaymentInfo';
import { TitleInfo } from './TitleInfo';
import { headerBlockStyles } from './models/headerBlockModel';
import { PDF_STYLES } from './pdfTheme';

interface Props {
  invoiceForm?: InvoiceFromData;
  storeSettings?: Settings;
  logoUrl?: string;
  pdfTexts: PdfTexts;
  blocks: HeaderBlock[];
}

const HeaderInfoComponent: FC<Props> = ({ invoiceForm, storeSettings, logoUrl, pdfTexts, blocks }) => {
  const renderBlock = (block: HeaderBlock, index: number): ReactNode => {
    const key = `${block.type}-${index}`;
    const styles = headerBlockStyles(block);

    switch (block.type) {
      case 'row':
      case 'column':
        return (
          <View key={key} style={styles}>
            {block.children?.map(renderBlock)}
          </View>
        );
      case 'title':
        return (
          <TitleInfo
            key={key}
            invoiceForm={invoiceForm}
            labels={{ pdfINVOICELabel: pdfTexts.pdfINVOICE, pdfQUOTELabel: pdfTexts.pdfQUOTE }}
          />
        );
      case 'logo':
        return <LogoInfo key={key} invoiceForm={invoiceForm} logoUrl={logoUrl} />;
      case 'businessInfo':
        return <BusinessInfo key={key} invoiceForm={invoiceForm} />;
      case 'clientInfo':
        return <ClientInfo key={key} invoiceForm={invoiceForm} billToLabel={pdfTexts.billTo} />;
      case 'invoiceMeta':
        return (
          <View key={key} style={styles}>
            <InvoiceInformationInfo
              storeSettings={storeSettings}
              invoiceForm={invoiceForm}
              showTitle={block.showTitle}
              showInvoiceLabel={block.showInvoiceLabel}
              labels={{
                invoiceNoLabel: pdfTexts.invoiceNo,
                quoteNoLabel: pdfTexts.quoteNo,
                dueDateLabel: pdfTexts.dueDate,
                dateLabel: pdfTexts.date,
                pdfINVOICELabel: pdfTexts.pdfINVOICE,
                pdfQUOTELabel: pdfTexts.pdfQUOTE
              }}
            />
          </View>
        );
      case 'paymentInfo':
        return (
          <View key={key} style={styles}>
            <PaymentInfo
              invoiceForm={invoiceForm}
              paymentInfoLabel={pdfTexts.paymentInfo}
              source={block.paymentSource}
            />
          </View>
        );
      default:
        return null;
    }
  };

  return <View style={PDF_STYLES.header}>{blocks.map(renderBlock)}</View>;
};

export const HeaderInfo = memo(HeaderInfoComponent);
