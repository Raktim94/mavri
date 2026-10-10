import { Box, LinearProgress, Typography, useTheme } from '@mui/material';
import { memo, type FC } from 'react';
import { formatAmount } from '../../shared/utils/formatFunctions';
import { useAppSelector } from '../../state/configureStore';
import { selectSettings } from '../../state/pageSlice';

export interface RankedRow {
  name: string;
  detail: string;
  value: number;
}

interface Props {
  rows: RankedRow[];
  limit?: number;
}

const RankedListComponent: FC<Props> = ({ rows, limit = 6 }) => {
  const theme = useTheme();
  const storeSettings = useAppSelector(selectSettings);
  const sorted = [...rows].sort((a, b) => b.value - a.value).slice(0, limit);
  const total = rows.reduce((sum, r) => sum + r.value, 0) || 1;
  const max = sorted[0]?.value || 1;

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
      {sorted.map((row, index) => (
        <Box key={row.name}>
          <Box sx={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 2, mb: 0.75 }}>
            <Box sx={{ display: 'flex', alignItems: 'baseline', gap: 1.25, minWidth: 0 }}>
              <Typography
                variant="caption"
                sx={{ color: 'text.secondary', fontVariantNumeric: 'tabular-nums', width: 16, flexShrink: 0 }}
              >
                {index + 1}
              </Typography>
              <Typography variant="body2" noWrap sx={{ fontWeight: 500 }}>
                {row.name}
              </Typography>
              <Typography variant="caption" color="text.secondary" noWrap>
                {row.detail}
              </Typography>
            </Box>
            <Box sx={{ display: 'flex', alignItems: 'baseline', gap: 1, flexShrink: 0 }}>
              <Typography variant="body2" sx={{ fontWeight: 600, fontVariantNumeric: 'tabular-nums' }}>
                {formatAmount(row.value, storeSettings?.amountFormat)}
              </Typography>
              <Typography variant="caption" color="text.secondary" sx={{ width: 36, textAlign: 'right' }}>
                {((row.value / total) * 100).toFixed(0)}%
              </Typography>
            </Box>
          </Box>
          <LinearProgress
            variant="determinate"
            value={(row.value / max) * 100}
            sx={{
              height: 6,
              borderRadius: 3,
              backgroundColor: theme.palette.action.hover,
              '& .MuiLinearProgress-bar': {
                borderRadius: 3,
                backgroundColor: index === 0 ? theme.palette.primary.main : theme.palette.secondary.main,
                opacity: index === 0 ? 1 : Math.max(0.35, 0.85 - index * 0.12)
              }
            }}
          />
        </Box>
      ))}
    </Box>
  );
};
export const RankedList = memo(RankedListComponent);
