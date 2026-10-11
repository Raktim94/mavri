import AddCircleOutline from '@mui/icons-material/AddCircleOutlined';
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
import { memo, useMemo, type FC } from 'react';
import { useTranslation } from 'react-i18next';
import i18n from '../../../i18n';
import { SearchInput } from '../../../shared/components/inputs/searchInput/SearchInput';
import { PageHeader } from '../../../shared/components/layout/pageHeader/PageHeader';
import { usePersistentSearch } from '../../../shared/hooks/persistent/usePersistentSearch';
import { usePresetsRetrieve } from '../../../shared/hooks/presets/usePresetsRetrieve';
import type { Preset } from '../../../shared/types/preset';
import type { Response } from '../../../shared/types/response';
import { filterAndSortArray } from '../../../shared/utils/filterSortFunctions';
import { useAppDispatch } from '../../../state/configureStore';
import { addToast } from '../../../state/pageSlice';

interface Props {
  open: boolean;
  onOpenDrawer?: () => void;
  onCloseDrawer?: () => void;
  onCreateBlank?: () => void;
  onCreateFromPreset?: (preset: Preset) => void;
}

const PresetPickerDrawerComponent: FC<Props> = ({
  open,
  onOpenDrawer,
  onCloseDrawer,
  onCreateBlank,
  onCreateFromPreset
}) => {
  const { t } = useTranslation();
  const theme = useTheme();
  const isWide = useMediaQuery(theme.breakpoints.up('md'));
  const [search, setSearch] = usePersistentSearch('', 'invoices:actions');
  const dispatch = useAppDispatch();

  const { presets } = usePresetsRetrieve({
    onDone: (data: Response<Preset[]>) => {
      if (data.success) return;

      if (data.message) {
        const message = i18n.exists(data.message) ? t(data.message) : data.message;
        dispatch(addToast({ message, severity: 'error' }));
      } else if (data.key) {
        dispatch(addToast({ message: t(data.key), severity: 'error' }));
      }
    }
  });

  const visiblePresets = useMemo(
    () => filterAndSortArray({ data: presets, searchValue: search, searchField: 'name' }),
    [presets, search]
  );

  const rowButtonSx = {
    width: '100%',
    borderRadius: 1,
    display: 'flex',
    justifyContent: 'start',
    alignItems: 'start',
    flexDirection: 'column' as const
  };

  return (
    <SwipeableDrawer
      anchor="bottom"
      open={open}
      onClose={() => onCloseDrawer?.()}
      onOpen={() => onOpenDrawer?.()}
      slotProps={{
        paper: {
          sx: {
            maxWidth: isWide ? '40%' : '100%',
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
          onClose={onCloseDrawer}
        />
        <Box>
          <SearchInput value={search} onChange={setSearch} />
          <ListItemButton onClick={() => onCreateBlank?.()} sx={[rowButtonSx, { marginTop: 2 }]}>
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
          {visiblePresets.map(preset => (
            <ListItemButton key={`preset-${preset.id}`} onClick={() => onCreateFromPreset?.(preset)} sx={rowButtonSx}>
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
                      {t('common.createNewFromPreset', { name: preset.name })}
                    </Typography>
                  }
                  disableTypography
                  sx={{ m: 0 }}
                  slotProps={{ primary: { sx: { fontWeight: 600, m: 0 } } }}
                />
              </ListItem>
            </ListItemButton>
          ))}
        </Box>
      </Box>
    </SwipeableDrawer>
  );
};

export const PresetPickerDrawer = memo(PresetPickerDrawerComponent);
