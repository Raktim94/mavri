import CheckCircleOutlineOutlinedIcon from '@mui/icons-material/CheckCircleOutlineOutlined';
import WarningAmberOutlinedIcon from '@mui/icons-material/WarningAmberOutlined';
import { Box, ButtonBase, Typography, useTheme } from '@mui/material';
import { memo, type FC } from 'react';
import { useTranslation } from 'react-i18next';
import { formatAmount } from '../../shared/utils/formatFunctions';
import { useAppSelector } from '../../state/configureStore';
import { selectSettings } from '../../state/pageSlice';
import type { AttentionQueue as Queue } from './attention';
import { DashboardCard } from './DashboardCard';

interface Props {
  queue: Queue;
  onOpenInvoices: () => void;
}

// Overdue invoices that need a follow-up. Urgency is conveyed by an icon and
// the "N days overdue" text, never by colour alone.
const AttentionQueueComponent: FC<Props> = ({ queue, onOpenInvoices }) => {
  const theme = useTheme();
  const { t } = useTranslation();
  const storeSettings = useAppSelector(selectSettings);
  const fmt = (v: number) => formatAmount(v, storeSettings?.amountFormat);

  return (
    <DashboardCard
      title={t('reports.needsAttention')}
      subtitle={
        queue.totalCount > 0
          ? t('reports.overdueSummary', { count: queue.totalCount, amount: fmt(queue.totalBalance) })
          : undefined
      }
    >
      {queue.totalCount === 0 ? (
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, py: 2, color: 'text.secondary' }}>
          <CheckCircleOutlineOutlinedIcon color="success" aria-hidden />
          <Typography variant="body2">{t('reports.nothingOverdue')}</Typography>
        </Box>
      ) : (
        <Box component="ul" sx={{ listStyle: 'none', m: 0, p: 0, display: 'flex', flexDirection: 'column' }}>
          {queue.items.map(item => (
            <Box
              component="li"
              key={`${item.id ?? item.number}`}
              sx={{
                display: 'flex',
                alignItems: 'center',
                gap: 1.5,
                py: 1.25,
                '&:not(:last-child)': { borderBottom: `1px solid ${theme.palette.divider}` }
              }}
            >
              <WarningAmberOutlinedIcon fontSize="small" color="warning" aria-hidden />
              <Box sx={{ minWidth: 0, flexGrow: 1 }}>
                <Typography variant="body2" noWrap sx={{ fontWeight: 600 }}>
                  {item.number} · {item.client}
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  {t('reports.daysOverdue', { count: item.daysOverdue })}
                </Typography>
              </Box>
              <Typography variant="body2" sx={{ fontWeight: 600, fontVariantNumeric: 'tabular-nums' }}>
                {fmt(item.balance)}
              </Typography>
            </Box>
          ))}
        </Box>
      )}
      {queue.totalCount > queue.items.length && (
        <ButtonBase
          onClick={onOpenInvoices}
          sx={{ mt: 1.5, color: 'primary.main', typography: 'body2', fontWeight: 600, borderRadius: 1 }}
        >
          {t('reports.viewAllOverdue', { count: queue.totalCount })}
        </ButtonBase>
      )}
    </DashboardCard>
  );
};
export const AttentionQueue = memo(AttentionQueueComponent);
