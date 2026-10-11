import { memo, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import type { ItemSales } from '../../shared/types/itemSales';
import { DashboardCard } from './DashboardCard';
import { RankedList } from './RankedList';

interface Props {
  data: ItemSales[];
}

const ItemsSalesChartComponent: React.FC<Props> = ({ data }) => {
  const { t } = useTranslation();
  const rows = useMemo(
    () => data.map(i => ({ name: i.name, detail: t('reports.qtyShort', { count: i.quantity }), value: i.amount })),
    [data, t]
  );
  return (
    <DashboardCard title={t('reports.topItems')}>
      <RankedList rows={rows} />
    </DashboardCard>
  );
};
export const ItemsSalesChart = memo(ItemsSalesChartComponent);
