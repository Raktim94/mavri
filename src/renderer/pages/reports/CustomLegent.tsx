import { Box, Typography } from '@mui/material';
import type { FC } from 'react';
import type { Props } from 'recharts/types/component/DefaultLegendContent';
import { formatAmount } from '../../shared/utils/formatFunctions';
import { useAppSelector } from '../../state/configureStore';
import { selectSettings } from '../../state/pageSlice';

interface CustomProps extends Props {
  chartData: {
    name: string;
    value: number;
    color: string;
  }[];
}
export const CustomLegend: FC<CustomProps> = ({ payload, chartData }) => {
  const storeSettings = useAppSelector(selectSettings);

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
      {payload?.map((entry, index) => {
        const item = chartData[index];
        const revenue = storeSettings ? formatAmount(item.value, storeSettings.amountFormat) : item.value;

        return (
          <Box
            key={index}
            sx={{
              display: 'flex',
              alignItems: 'center',
              gap: 1
            }}
          >
            <Box
              sx={{
                width: 12,
                height: 12,
                borderRadius: '3px',
                backgroundColor: entry.color
              }}
            />
            <Box sx={{ display: 'flex', flexDirection: 'column', lineHeight: 1.1 }}>
              <Typography variant="body2" fontWeight={600}>
                {item.name}
              </Typography>
              <Typography variant="caption" color="text.secondary">
                {revenue}
              </Typography>
            </Box>
          </Box>
        );
      })}
    </Box>
  );
};
