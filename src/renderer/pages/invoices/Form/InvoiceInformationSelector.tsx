import { Typography } from '@mui/material';
import { memo, type FC, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { DateFormat } from '../../../shared/enums/dateFormat';
import { InvoiceType } from '../../../shared/enums/invoiceType';
import type { InvoiceFromData } from '../../../shared/types/invoice';
import { formatDate } from '../../../shared/utils/formatFunctions';
import { useAppSelector } from '../../../state/configureStore';
import { selectSettings } from '../../../state/pageSlice';
import { FieldChip } from './fields/FieldChip';

interface Props {
  type: InvoiceType;
  invoiceForm?: InvoiceFromData;
  onEdit: () => void;
}

const LINE_SX = { fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis' } as const;

export const invoiceInfoLines = (
  t: (key: string, opts?: Record<string, unknown>) => string,
  invoiceForm: InvoiceFromData | undefined,
  dateFormat?: DateFormat
): ReactNode => {
  const lines: ReactNode[] = [
    <Typography key="number" component="div" variant="body2" sx={LINE_SX}>
      {invoiceForm?.invoicePrefix}
      {invoiceForm?.invoiceNumber}
      {invoiceForm?.invoiceSuffix}
    </Typography>
  ];

  if (dateFormat && invoiceForm?.issuedAt) {
    lines.push(
      <Typography key="issued" component="div" variant="body2" sx={LINE_SX}>
        {t('invoices.issuedAt', { date: formatDate(invoiceForm.issuedAt, dateFormat) })}
      </Typography>
    );
  }

  if (dateFormat && invoiceForm?.dueDate) {
    lines.push(
      <Typography key="due" component="div" variant="body2" sx={LINE_SX}>
        {t('invoices.dueDateAt', { date: formatDate(invoiceForm.dueDate, dateFormat) })}
      </Typography>
    );
  }

  return <>{lines}</>;
};

const InvoiceInformationSelectorComponent: FC<Props> = ({ type, invoiceForm, onEdit }) => {
  const { t } = useTranslation();
  const storeSettings = useAppSelector(selectSettings);

  const label = type === InvoiceType.quotation ? t('invoices.quoteInfo') : t('invoices.invoiceInfo');

  return (
    <FieldChip
      label={label}
      required
      align="end"
      secondary={invoiceInfoLines(t, invoiceForm, storeSettings?.dateFormat)}
      onEdit={onEdit}
    />
  );
};

export const InvoiceInformationSelector = memo(InvoiceInformationSelectorComponent);
