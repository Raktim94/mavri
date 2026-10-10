import { Box, Typography, useTheme } from '@mui/material';
import { memo, type FC } from 'react';
import { useTranslation } from 'react-i18next';
import { Cell, Pie, PieChart, ResponsiveContainer } from 'recharts';
import type { InvoicesByCurrencyMeta } from '../../shared/types/invoice';
import { formatAmount } from '../../shared/utils/formatFunctions';
import { useAppSelector } from '../../state/configureStore';
import { selectSettings } from '../../state/pageSlice';
import { DashboardCard } from './DashboardCard';

interface Props {
  data: InvoicesByCurrencyMeta;
}

const CollectionCardComponent: FC<Props> = ({ data }) => {
  const theme = useTheme();
  const { t } = useTranslation();
  const storeSettings = useAppSelector(selectSettings);
  const fmt = (v: number) => formatAmount(v, storeSettings?.amountFormat);

  const slices = [
    { name: t('reports.collected'), value: Math.max(data.totalAmountPaid, 0), color: theme.palette.success.main },
    { name: t('reports.outstanding'), value: Math.max(data.balanceDue, 0), color: theme.palette.primary.main }
  ];

  return (
    <DashboardCard title={t('reports.collectionRate')} subtitle={t('reports.paidVsOutstanding')}>
      <Box sx={{ position: 'relative', height: 190 }}>
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={slices}
              dataKey="value"
              innerRadius={62}
              outerRadius={84}
              startAngle={90}
              endAngle={-270}
              paddingAngle={2}
              cornerRadius={6}
              stroke="none"
            >
              {slices.map(s => (
                <Cell key={s.name} fill={s.color} />
              ))}
            </Pie>
          </PieChart>
        </ResponsiveContainer>
        <Box
          sx={{
            position: 'absolute',
            inset: 0,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            pointerEvents: 'none'
          }}
        >
          <Typography variant="h3" component="div" sx={{ fontSize: '1.75rem' }}>
            {data.collectionRate.toFixed(0)}%
          </Typography>
        </Box>
      </Box>
      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1, mt: 1 }}>
        {slices.map(s => (
          <Box key={s.name} sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <Box sx={{ width: 10, height: 10, borderRadius: '50%', backgroundColor: s.color }} />
              <Typography variant="body2" color="text.secondary">
                {s.name}
              </Typography>
            </Box>
            <Typography variant="body2" sx={{ fontWeight: 600, fontVariantNumeric: 'tabular-nums' }}>
              {fmt(s.value)}
            </Typography>
          </Box>
        ))}
      </Box>
    </DashboardCard>
  );
};
export const CollectionCard = memo(CollectionCardComponent);
