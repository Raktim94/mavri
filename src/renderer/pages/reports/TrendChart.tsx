import { useTheme } from '@mui/material';
import { memo } from 'react';
import { useTranslation } from 'react-i18next';
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { formatDate } from '../../shared/utils/formatFunctions';
import { useAppSelector } from '../../state/configureStore';
import { selectSettings } from '../../state/pageSlice';
import { CustomTooltip } from './CustomTooltip';
import { DashboardCard } from './DashboardCard';

interface Props {
  data: { date: string; total: number }[];
}

const compact = (value: number) =>
  new Intl.NumberFormat('en', { notation: 'compact', maximumFractionDigits: 1 }).format(value);

const TrendChartComponent: React.FC<Props> = ({ data }) => {
  const theme = useTheme();
  const { t } = useTranslation();
  const storeSettings = useAppSelector(selectSettings);
  const color = theme.palette.primary.main;

  return (
    <DashboardCard title={t('reports.salesTrending')} subtitle={t('reports.cumulative')}>
      <div role="img" aria-label={t('reports.trendDescription')}>
        <ResponsiveContainer width="100%" height={280}>
          <AreaChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
            <defs>
              <linearGradient id="trendFill" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={color} stopOpacity={0.35} />
                <stop offset="100%" stopColor={color} stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={theme.palette.divider} />
            <XAxis
              dataKey="date"
              tickLine={false}
              axisLine={false}
              tick={{ fill: theme.palette.text.secondary, fontSize: 12 }}
              tickFormatter={value => (storeSettings ? formatDate(value, storeSettings.dateFormat) : value)}
            />
            <YAxis
              width={48}
              tickLine={false}
              axisLine={false}
              tick={{ fill: theme.palette.text.secondary, fontSize: 12 }}
              tickFormatter={compact}
            />
            <Tooltip content={props => <CustomTooltip {...props} />} />
            <Area type="monotone" dataKey="total" stroke={color} strokeWidth={2.5} fill="url(#trendFill)" />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </DashboardCard>
  );
};
export const TrendChart = memo(TrendChartComponent);
