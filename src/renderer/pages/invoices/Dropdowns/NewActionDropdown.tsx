import AddCircleOutline from '@mui/icons-material/AddCircleOutline';
import LibraryAddIcon from '@mui/icons-material/LibraryAdd';
import {
  Box,
  ListItem,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  SwipeableDrawer,
  Typography,
  useMediaQuery,
  useTheme
} from '@mui/material';
import { memo, type FC } from 'react';
import { useTranslation } from 'react-i18next';
import { PageHeader } from '../../../shared/components/layout/pageHeader/PageHeader';

interface Props {
  isOpen: boolean;
  onClose?: () => void;
  onOpen?: () => void;
  onNew?: () => void;
  onNewFromPreset?: () => void;
}
const NewActionDropdownComponent: FC<Props> = ({ isOpen, onClose, onOpen, onNew, onNewFromPreset }) => {
  const { t } = useTranslation();
  const theme = useTheme();
  const isDesktop = useMediaQuery(theme.breakpoints.up('md'));

  return (
    <>
      <SwipeableDrawer
        anchor="bottom"
        open={isOpen}
        onClose={() => onClose?.()}
        onOpen={() => onOpen?.()}
        slotProps={{
          paper: {
            sx: {
              maxWidth: isDesktop ? '40%' : '100%',
              height: '40%',
              mx: 'auto',
              borderTopLeftRadius: 16,
              borderTopRightRadius: 16,
              borderBottomLeftRadius: 0,
              borderBottomRightRadius: 0,
              p: 3
            }
          }
        }}
      >
        <Box sx={{ mb: 2, mt: 2, display: 'flex', gap: 2, flexDirection: 'column' }}>
          <PageHeader
            title={t('ariaLabel.moreActions')}
            showBack={false}
            showSave={false}
            showClose={true}
            onClose={onClose}
          />
          <Box>
            <ListItemButton
              onClick={() => onNew?.()}
              sx={{
                width: '100%',
                borderRadius: 1,
                display: 'flex',
                justifyContent: 'start',
                alignItems: 'start',
                flexDirection: 'column'
              }}
            >
              <ListItem sx={{ p: 0 }}>
                <ListItemIcon sx={{ minWidth: 'auto', mr: 1 }}>
                  <AddCircleOutline />
                </ListItemIcon>
                <ListItemText
                  primary={
                    <Typography
                      component="div"
                      variant="body1"
                      sx={{ fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis' }}
                    >
                      {t('common.createNew')}
                    </Typography>
                  }
                  disableTypography
                  sx={{ m: 0 }}
                  slotProps={{ primary: { sx: { fontWeight: 600, m: 0 } } }}
                />
              </ListItem>
            </ListItemButton>
            <ListItemButton
              onClick={() => onNewFromPreset?.()}
              sx={{
                width: '100%',
                borderRadius: 1,
                display: 'flex',
                justifyContent: 'start',
                alignItems: 'start',
                flexDirection: 'column'
              }}
            >
              <ListItem sx={{ p: 0 }}>
                <ListItemIcon sx={{ minWidth: 'auto', mr: 1 }}>
                  <LibraryAddIcon />
                </ListItemIcon>
                <ListItemText
                  primary={
                    <Typography
                      component="div"
                      variant="body1"
                      sx={{ fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis' }}
                    >
                      {t('common.createNewFromPreset')}
                    </Typography>
                  }
                  disableTypography
                  sx={{ m: 0 }}
                  slotProps={{ primary: { sx: { fontWeight: 600, m: 0 } } }}
                />
              </ListItem>
            </ListItemButton>
          </Box>
        </Box>
      </SwipeableDrawer>
    </>
  );
};
export const NewActionDropdown = memo(NewActionDropdownComponent);
