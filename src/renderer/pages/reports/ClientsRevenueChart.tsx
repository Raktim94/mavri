import { memo, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import type { ClientRevenue } from '../../shared/types/clientRevenue';
import { DashboardCard } from './DashboardCard';
import { RankedList } from './RankedList';

interface Props {
  data: ClientRevenue[];
}

const ClientsRevenueChartComponent: React.FC<Props> = ({ data }) => {
  const { t } = useTranslation();
  const rows = useMemo(
    () =>
      data.map(c => ({
        name: c.name,
        detail: t('reports.invoicesShort', { count: c.invoiceCount }),
        value: c.revenue
      })),
    [data, t]
  );
  return (
    <DashboardCard title={t('reports.topClients')}>
      <RankedList rows={rows} />
    </DashboardCard>
  );
};
export const ClientsRevenueChart = memo(ClientsRevenueChartComponent);
