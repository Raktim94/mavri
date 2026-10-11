import { Text, View } from '@react-pdf/renderer';
import { memo, type FC } from 'react';
import { InvoiceType } from '../../../shared/enums/invoiceType';
import type { InvoiceFromData } from '../../../shared/types/invoice';
import type { Settings } from '../../../shared/types/settings';
import { formatDate } from '../../../shared/utils/formatFunctions';
import { TitleInfo } from './TitleInfo';
import { PDF_STYLES, fontScaleFor } from './pdfTheme';

interface Props {
  invoiceForm?: InvoiceFromData;
  storeSettings?: Settings;
  labels: {
    invoiceNoLabel: string;
    quoteNoLabel: string;
    dueDateLabel: string;
    dateLabel: string;
    pdfQUOTELabel: string;
    pdfINVOICELabel: string;
  };
  showTitle?: boolean;
  showInvoiceLabel?: boolean;
}

const MetaRow: FC<{ label?: string; value: string; boldSize: number; regularSize: number }> = ({
  label,
  value,
  boldSize,
  regularSize
}) => (
  <View style={[PDF_STYLES.row, PDF_STYLES.alignEnd]}>
    {label !== undefined && <Text style={[PDF_STYLES.regularBold, { fontSize: boldSize }]}>{label}</Text>}
    <Text style={[PDF_STYLES.regular, { fontSize: regularSize }]}>{value}</Text>
  </View>
);

const InvoiceInformationInfoComponent: FC<Props> = ({
  invoiceForm,
  storeSettings,
  labels,
  showTitle,
  showInvoiceLabel
}) => {
  const scale = fontScaleFor(invoiceForm?.invoiceCustomization);
  const numberLabel = invoiceForm?.invoiceType === InvoiceType.invoice ? labels.invoiceNoLabel : labels.quoteNoLabel;
  const fullNumber = `${invoiceForm?.invoicePrefix ?? ''}${invoiceForm?.invoiceNumber ?? ''}${invoiceForm?.invoiceSuffix ?? ''}`;

  return (
    <View style={[PDF_STYLES.alignEnd, PDF_STYLES.gap4]}>
      {showTitle && (
        <TitleInfo
          invoiceForm={invoiceForm}
          labels={{ pdfINVOICELabel: labels.pdfINVOICELabel, pdfQUOTELabel: labels.pdfQUOTELabel }}
        />
      )}

      <View style={[PDF_STYLES.gap3, PDF_STYLES.alignEnd]}>
        <MetaRow
          label={showInvoiceLabel ? `${numberLabel}: ` : undefined}
          value={fullNumber}
          boldSize={scale.regularBold}
          regularSize={scale.regular}
        />
        {storeSettings && invoiceForm?.issuedAt && (
          <MetaRow
            label={`${labels.dateLabel}: `}
            value={formatDate(invoiceForm.issuedAt, storeSettings.dateFormat)}
            boldSize={scale.regularBold}
            regularSize={scale.regular}
          />
        )}
        {storeSettings && invoiceForm?.dueDate && (
          <MetaRow
            label={`${labels.dueDateLabel}: `}
            value={formatDate(invoiceForm.dueDate, storeSettings.dateFormat)}
            boldSize={scale.regularBold}
            regularSize={scale.regular}
          />
        )}
      </View>
    </View>
  );
};

export const InvoiceInformationInfo = memo(InvoiceInformationInfoComponent);
