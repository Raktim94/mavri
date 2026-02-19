import EmojiEventsIcon from '@mui/icons-material/EmojiEvents';
import { Box, Typography } from '@mui/material';
import { type FC } from 'react';
import { useTranslation } from 'react-i18next';
import { PageHeader } from '../../../shared/components/layout/pageHeader/PageHeader';

interface Props {
  showBack: boolean;
  onBack?: () => void;
}

export const WallOfFame: FC<Props> = ({ showBack, onBack = () => {} }) => {
  const { t } = useTranslation();

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3, height: '100%' }}>
      <PageHeader title={t('settingsMenuItems.titles.wallOfFame')} showBack={showBack} onBack={onBack} />

      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          height: '100%',
          flexDirection: 'column',
          gap: 2
        }}
      >
        <EmojiEventsIcon color="action" fontSize="large" />
        <Typography variant="h5">{t('settingsMenuItems.supportText')}</Typography>
        <Typography variant="h6">{t('settingsMenuItems.supportDesc')}</Typography>
      </Box>
    </Box>
  );
};
