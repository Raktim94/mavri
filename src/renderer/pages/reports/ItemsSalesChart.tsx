import { Box, Typography, useTheme } from '@mui/material';
import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { Cell, Legend, Pie, PieChart, ResponsiveContainer, type PieLabelRenderProps } from 'recharts';
import type { ItemSales } from '../../shared/types/itemSales';
import { CustomLegend } from './CustomLegent';

interface Props {
  data: ItemSales[];
}

export const ItemsSalesChart: React.FC<Props> = ({ data }) => {
  const theme = useTheme();
  const { t } = useTranslation();

  const getRandomColor = () => {
    const hue = Math.floor(Math.random() * 360);
    return `hsl(${hue}, 70%, 50%)`;
  };

  const chartData = useMemo(() => {
    return data.map(client => ({
      name: t('reports.itemsCount', {
        name: client.name,
        count: client.quantity
      }),
      value: client.amount,
      color: getRandomColor()
    }));
  }, [data, t]);

  const renderPercentageLabel = ({
    cx,
    cy,
    midAngle = 0,
    innerRadius,
    outerRadius,
    percent = 0
  }: PieLabelRenderProps) => {
    const RADIAN = Math.PI / 180;
    const radius = innerRadius + (outerRadius - innerRadius) * 0.5;
    const x = cx + radius * Math.cos(-midAngle * RADIAN);
    const y = cy + radius * Math.sin(-midAngle * RADIAN);

    return (
      <text x={x} y={y} fill="#fff" textAnchor="middle" dominantBaseline="central" fontSize="12" fontWeight="600">
        {(percent * 100).toFixed(0)}%
      </text>
    );
  };

  return (
    <Box sx={{ mt: 1 }}>
      <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
        <Typography variant="h6" color={theme.palette.text.primary}>
          {t('reports.topItems')}
        </Typography>
      </Box>

      <ResponsiveContainer width="100%" height={300}>
        <PieChart>
          <Pie
            data={chartData}
            dataKey="value"
            nameKey="name"
            cx="50%"
            cy="50%"
            innerRadius={40}
            outerRadius={100}
            paddingAngle={2}
            labelLine={false}
            label={renderPercentageLabel}
          >
            {chartData.map((entry, index) => (
              <Cell key={`cell-${index}`} fill={entry.color} />
            ))}
          </Pie>
          <Legend
            layout="vertical"
            align="right"
            verticalAlign="middle"
            content={props => <CustomLegend {...props} chartData={chartData} />}
          />
        </PieChart>
      </ResponsiveContainer>
    </Box>
  );
};
