import { Box, Chip, Typography, useTheme } from '@mui/material';
import { memo, type FC } from 'react';
import { useTranslation } from 'react-i18next';
import { InvoiceStatus } from '../../shared/enums/invoiceStatus';
import { formatAmount, formatDate } from '../../shared/utils/formatFunctions';
import { useAppSelector } from '../../state/configureStore';
import { selectSettings } from '../../state/pageSlice';
import { DashboardCard } from './DashboardCard';

export interface RecentInvoiceRow {
  id?: number;
  number: string;
  client: string;
  issuedAt: string;
  dueDate?: string;
  status: InvoiceStatus;
  total: number;
}

interface Props {
  rows: RecentInvoiceRow[];
}

const STATUS_LABEL: Record<InvoiceStatus, string> = {
  [InvoiceStatus.open]: 'Open',
  [InvoiceStatus.unpaid]: 'Unpaid',
  [InvoiceStatus.closed]: 'Closed',
  [InvoiceStatus.partiallyPaid]: 'Partially paid',
  [InvoiceStatus.paid]: 'Paid'
};

const RecentInvoicesComponent: FC<Props> = ({ rows }) => {
  const theme = useTheme();
  const { t } = useTranslation();
  const storeSettings = useAppSelector(selectSettings);

  const statusColor = (status: InvoiceStatus) => {
    switch (status) {
      case InvoiceStatus.paid:
        return theme.palette.success.main;
      case InvoiceStatus.partiallyPaid:
        return theme.palette.warning.main;
      case InvoiceStatus.unpaid:
        return theme.palette.error.main;
      default:
        return theme.palette.text.secondary;
    }
  };

  return (
    <DashboardCard title={t('reports.recentInvoices')}>
      <Box sx={{ overflowX: 'auto' }}>
        <Box component="table" sx={{ width: '100%', borderCollapse: 'collapse', minWidth: 560 }}>
          <Box component="thead">
            <Box component="tr">
              {[
                t('common.invoiceNo'),
                t('common.client'),
                t('common.date'),
                t('common.status'),
                t('common.amount')
              ].map((label, i) => (
                <Box
                  key={label}
                  component="th"
                  sx={{
                    textAlign: i === 4 ? 'right' : 'left',
                    pb: 1,
                    fontSize: 12,
                    fontWeight: 500,
                    letterSpacing: 0.5,
                    textTransform: 'uppercase',
                    color: 'text.secondary',
                    borderBottom: `1px solid ${theme.palette.divider}`
                  }}
                >
                  {label}
                </Box>
              ))}
            </Box>
          </Box>
          <Box component="tbody">
            {rows.map(row => (
              <Box
                component="tr"
                key={`${row.id ?? row.number}`}
                sx={{ '&:not(:last-child) td': { borderBottom: `1px solid ${theme.palette.divider}` } }}
              >
                <Box component="td" sx={{ py: 1.5, pr: 2 }}>
                  <Typography variant="body2" sx={{ fontWeight: 600 }}>
                    {row.number}
                  </Typography>
                </Box>
                <Box component="td" sx={{ py: 1.5, pr: 2 }}>
                  <Typography variant="body2">{row.client}</Typography>
                </Box>
                <Box component="td" sx={{ py: 1.5, pr: 2 }}>
                  <Typography variant="body2" color="text.secondary">
                    {storeSettings ? formatDate(row.issuedAt, storeSettings.dateFormat) : row.issuedAt}
                  </Typography>
                </Box>
                <Box component="td" sx={{ py: 1.5, pr: 2 }}>
                  <Chip
                    size="small"
                    label={STATUS_LABEL[row.status] ?? row.status}
                    sx={{
                      fontWeight: 500,
                      color: statusColor(row.status),
                      backgroundColor: `${statusColor(row.status)}1f`
                    }}
                  />
                </Box>
                <Box component="td" sx={{ py: 1.5, textAlign: 'right' }}>
                  <Typography variant="body2" sx={{ fontWeight: 600, fontVariantNumeric: 'tabular-nums' }}>
                    {formatAmount(row.total, storeSettings?.amountFormat)}
                  </Typography>
                </Box>
              </Box>
            ))}
          </Box>
        </Box>
      </Box>
    </DashboardCard>
  );
};
export const RecentInvoices = memo(RecentInvoicesComponent);
