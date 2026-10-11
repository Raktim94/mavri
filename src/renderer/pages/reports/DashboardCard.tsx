import { Box, Card, Typography, useTheme } from '@mui/material';
import type { FC, ReactNode } from 'react';

interface Props {
  title: string;
  subtitle?: string;
  action?: ReactNode;
  children: ReactNode;
  minHeight?: number;
}

// Shared chrome for every dashboard panel: quiet bordered surface, serif title.
export const DashboardCard: FC<Props> = ({ title, subtitle, action, children, minHeight }) => {
  const theme = useTheme();
  return (
    <Card
      variant="outlined"
      sx={{
        height: '100%',
        p: { xs: 2, md: 3 },
        borderRadius: 3,
        minHeight,
        borderColor: theme.palette.divider,
        backgroundColor: theme.palette.background.paper
      }}
    >
      <Box sx={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', mb: 2, gap: 2 }}>
        <Box>
          <Typography variant="h4" component="h2" sx={{ fontSize: '1.25rem' }}>
            {title}
          </Typography>
          {subtitle && (
            <Typography variant="body2" color="text.secondary" sx={{ mt: 0.25 }}>
              {subtitle}
            </Typography>
          )}
        </Box>
        {action}
      </Box>
      {children}
    </Card>
  );
};
