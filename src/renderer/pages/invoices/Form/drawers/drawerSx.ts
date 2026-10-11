import { useMediaQuery, useTheme } from '@mui/material';

export const useIsDesktop = (): boolean => {
  const theme = useTheme();
  return useMediaQuery(theme.breakpoints.up('md'));
};

export const drawerPaperSx = (args: { isDesktop: boolean; height: string; mobileHeight?: string }) => ({
  maxWidth: args.isDesktop ? '40%' : '100%',
  height: args.isDesktop ? args.height : (args.mobileHeight ?? args.height),
  mx: 'auto',
  borderTopLeftRadius: 16,
  borderTopRightRadius: 16,
  borderBottomLeftRadius: 0,
  borderBottomRightRadius: 0,
  p: 3
});
