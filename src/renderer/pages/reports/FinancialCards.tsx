import ReceiptLongOutlinedIcon from '@mui/icons-material/ReceiptLongOutlined';
import CheckCircleOutlineOutlinedIcon from '@mui/icons-material/CheckCircleOutlineOutlined';
import TrendingUpIcon from '@mui/icons-material/TrendingUp';
import ScheduleOutlinedIcon from '@mui/icons-material/ScheduleOutlined';
import { Grid, useTheme } from '@mui/material';
import { memo, type FC } from 'react';
import { useTranslation } from 'react-i18next';
import { SummaryCard } from '../../shared/components/layout/summaryCard/SummaryCard';
import type { InvoicesByCurrencyMeta } from '../../shared/types/invoice';
import { formatAmount } from '../../shared/utils/formatFunctions';
import { useAppSelector } from '../../state/configureStore';
import { selectSettings } from '../../state/pageSlice';

interface Props {
  data: InvoicesByCurrencyMeta;
}
const FinancialCardsComponent: FC<Props> = ({ data }) => {
  const theme = useTheme();
  const { t } = useTranslation();
  const storeSettings = useAppSelector(selectSettings);

  return (
    <Grid container spacing={2}>
      <Grid size={{ xs: 12, md: 6, lg: 3 }}>
        <SummaryCard
          title={t('reports.invoicedThisPeriod')}
          value={formatAmount(data.totalAmount, storeSettings?.amountFormat)}
          subtitle={t('reports.totalInvoices', { count: data.invoiceCount })}
          accentColor={theme.palette.primary.main}
          icon={<ReceiptLongOutlinedIcon />}
        />
      </Grid>
      <Grid size={{ xs: 12, md: 6, lg: 3 }}>
        <SummaryCard
          title={t('reports.collectionRate')}
          value={`${data.collectionRate.toFixed(2)}%`}
          subtitle={t('reports.avgInvoice', {
            avg: formatAmount(data.avgPerInvoice, storeSettings?.amountFormat)
          })}
          accentColor={theme.palette.info.main}
          icon={<TrendingUpIcon />}
        />
      </Grid>
      <Grid size={{ xs: 12, md: 6, lg: 3 }}>
        <SummaryCard
          title={t('reports.collected')}
          value={formatAmount(data.totalAmountPaid, storeSettings?.amountFormat)}
          subtitle={t('reports.overdue', {
            count: data.overdueCount
          })}
          accentColor={theme.palette.success.main}
          icon={<CheckCircleOutlineOutlinedIcon />}
        />
      </Grid>
      <Grid size={{ xs: 12, md: 6, lg: 3 }}>
        <SummaryCard
          title={t('reports.outstanding')}
          value={formatAmount(data.balanceDue, storeSettings?.amountFormat)}
          accentColor={theme.palette.warning.main}
          icon={<ScheduleOutlinedIcon />}
        />
      </Grid>
    </Grid>
  );
};
export const FinancialCards = memo(FinancialCardsComponent);
