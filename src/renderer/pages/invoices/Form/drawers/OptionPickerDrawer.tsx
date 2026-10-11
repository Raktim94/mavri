import { Box, ListItem, ListItemButton, ListItemText, Paper, SwipeableDrawer, Typography } from '@mui/material';
import { memo, useCallback, useMemo, type FC } from 'react';
import { SearchInput } from '../../../../shared/components/inputs/searchInput/SearchInput';
import { usePersistentSearch } from '../../../../shared/hooks/persistent/usePersistentSearch';
import { filterAndSortArray } from '../../../../shared/utils/filterSortFunctions';
import { drawerPaperSx, useIsDesktop } from './drawerSx';

export interface PickerOption {
  label: string;
  value: string;
}

interface Props {
  isOpen: boolean;
  onClose?: () => void;
  onOpen?: () => void;
  options: PickerOption[];
  searchKey: string;
  onPick: (value: string) => void;
  height?: string;
}

const OptionPickerDrawerComponent: FC<Props> = ({
  isOpen,
  onClose,
  onOpen,
  options,
  searchKey,
  onPick,
  height = '40%'
}) => {
  const isDesktop = useIsDesktop();
  const [search, setSearch] = usePersistentSearch('', searchKey);

  const filtered = useMemo(
    () => filterAndSortArray({ data: options, searchValue: search, searchField: 'label' }),
    [options, search]
  );

  const onSearchChanged = useCallback((value: string) => setSearch(value), [setSearch]);

  return (
    <SwipeableDrawer
      anchor="bottom"
      open={isOpen}
      onClose={() => onClose?.()}
      onOpen={() => onOpen?.()}
      slotProps={{ paper: { sx: drawerPaperSx({ isDesktop, height }) } }}
    >
      <Box sx={{ mb: 2, mt: 2, display: 'flex', gap: 2, flexDirection: 'column' }}>
        <SearchInput value={search} onChange={onSearchChanged} />

        {filtered.map(option => (
          <Paper
            elevation={2}
            key={option.value}
            sx={{
              borderRadius: 1,
              minWidth: '250px',
              transition: 'all 0.2s ease-in-out'
            }}
          >
            <ListItemButton
              onClick={() => onPick(option.value)}
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
                <ListItemText
                  primary={
                    <Typography
                      component="div"
                      variant="body1"
                      sx={{ fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis' }}
                    >
                      {option.label}
                    </Typography>
                  }
                  disableTypography
                  sx={{ m: 0 }}
                  slotProps={{ primary: { sx: { fontWeight: 600, m: 0 } } }}
                />
              </ListItem>
            </ListItemButton>
          </Paper>
        ))}
      </Box>
    </SwipeableDrawer>
  );
};

export const OptionPickerDrawer = memo(OptionPickerDrawerComponent);
