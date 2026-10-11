import { Box, FormControlLabel, Switch, useMediaQuery, useTheme } from '@mui/material';
import { memo, type FC } from 'react';
import { useTranslation } from 'react-i18next';
import { InvoiceStatus } from '../../../shared/enums/invoiceStatus';
import { InvoiceType } from '../../../shared/enums/invoiceType';
import type { InvoiceFromData } from '../../../shared/types/invoice';
import { statusAfterClosedOff } from './financial/statusPolicy';

interface Props {
  invoiceForm?: InvoiceFromData;
  onArchivedChanged: (value: boolean) => void;
  onStatusChanged: (status: InvoiceStatus) => void;
}

const StatusSelectorComponent: FC<Props> = ({ invoiceForm, onArchivedChanged, onStatusChanged }) => {
  const { t } = useTranslation();
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));

  const rowSx = {
    display: 'flex',
    flexDirection: isMobile ? 'column' : 'row',
    width: '100%',
    justifyContent: 'end',
    alignItems: 'end',
    gap: 1
  } as const;

  const isClosed = invoiceForm?.status === InvoiceStatus.closed;
  const isPaid = invoiceForm?.status === InvoiceStatus.paid;

  return (
    <>
      <Box sx={rowSx}>
        <FormControlLabel
          control={
            <Switch
              checked={isClosed}
              onChange={event => {
                onStatusChanged(event.target.checked ? InvoiceStatus.closed : statusAfterClosedOff(invoiceForm));
              }}
            />
          }
          label={t('invoices.markAsClosed')}
        />
        {invoiceForm?.invoiceType === InvoiceType.invoice && (
          <FormControlLabel
            control={
              <Switch
                checked={isPaid}
                onChange={event => {
                  onStatusChanged(event.target.checked ? InvoiceStatus.paid : statusAfterClosedOff(invoiceForm));
                }}
              />
            }
            label={t('invoices.markAsPaid')}
          />
        )}
      </Box>
      <Box sx={rowSx}>
        <FormControlLabel
          control={
            <Switch
              checked={invoiceForm?.isArchived ?? false}
              onChange={event => {
                onArchivedChanged(event.target.checked);
              }}
            />
          }
          label={t('common.archived')}
        />
      </Box>
    </>
  );
};

export const StatusSelector = memo(StatusSelectorComponent);
