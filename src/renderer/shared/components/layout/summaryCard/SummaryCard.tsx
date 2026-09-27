import { Box, Card, CardContent, Typography, useTheme } from '@mui/material';
import type { FC, ReactNode } from 'react';

interface SummaryCardProps {
  title: string;
  value: string;
  subtitle?: string;
  accentColor: string;
  icon: ReactNode;
}

// A flat, quiet card with one small tinted icon chip for accent — deliberately
// not a solid-color block. Four competing solid-fill cards read as a
// generic dashboard template; a shared neutral surface with the color
// carried only by the icon lets the numbers themselves be what draws the
// eye, and keeps all four cards legible at a glance regardless of theme.
export const SummaryCard: FC<SummaryCardProps> = ({ title, value, subtitle, accentColor, icon }) => {
  const theme = useTheme();

  return (
    <Card
      variant="outlined"
      sx={{
        height: '100%',
        borderRadius: 3,
        borderColor: theme.palette.divider,
        boxShadow: 'none',
        backgroundColor: theme.palette.background.paper
      }}
    >
      <CardContent sx={{ p: 2.5, '&:last-child': { pb: 2.5 } }}>
        <Box sx={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', mb: 1.5 }}>
          <Typography variant="body2" color="text.secondary" sx={{ fontWeight: 500 }}>
            {title}
          </Typography>
          <Box
            sx={{
              width: 30,
              height: 30,
              borderRadius: 1.5,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              backgroundColor: `${accentColor}1a`,
              color: accentColor,
              flexShrink: 0,
              '& svg': { fontSize: 18 }
            }}
          >
            {icon}
          </Box>
        </Box>
        <Typography
          variant="h4"
          sx={{
            fontWeight: 600,
            fontVariantNumeric: 'tabular-nums',
            letterSpacing: '-0.01em',
            lineHeight: 1.2
          }}
        >
          {value}
        </Typography>
        {subtitle && (
          <Typography variant="body2" color="text.secondary" sx={{ mt: 0.75 }}>
            {subtitle}
          </Typography>
        )}
      </CardContent>
    </Card>
  );
};
