import { SwipeableDrawer, useMediaQuery, useTheme } from '@mui/material';
import { memo, type FC } from 'react';
import { useTranslation } from 'react-i18next';
import { CRUDPage } from '../../../shared/components/layout/crudPage/CRUDPage';
import { FilterType } from '../../../shared/enums/filterType';
import { usePresetsRetrieve } from '../../../shared/hooks/presets/usePresetsRetrieve';
import type { Filter, FilterData } from '../../../shared/types/filter';
import type { Preset, PresetAdd, PresetUpdate } from '../../../shared/types/preset';
import type { Response } from '../../../shared/types/response';
import { createCommonFilters } from '../../../shared/utils/filterSortFunctions';
import { List as PresetList } from '../../presets/List';

interface Props {
  isOpen: boolean;
  onClose?: () => void;
  onOpen?: () => void;
  onClick?: (data: Preset) => void;
}

const PresetDropdownComponent: FC<Props> = ({ isOpen, onClose, onOpen, onClick }) => {
  const { t } = useTranslation();
  const filters: Filter[] = [...createCommonFilters({ t, namespace: 'presets', initial: FilterType.active })];
  const theme = useTheme();
  const isDesktop = useMediaQuery(theme.breakpoints.up('md'));

  const usePresetsCRUDRetrieve = (args: { filter?: FilterData[]; onDone?: (data: Response<Preset[]>) => void }) => {
    const { presets, execute } = usePresetsRetrieve({ filter: args.filter, onDone: args.onDone });
    return { items: presets, execute };
  };

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
              height: '80%',
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
        <CRUDPage<Preset, PresetAdd, PresetUpdate>
          filters={filters}
          showRightSide={false}
          showAddButton={false}
          useRetrieve={usePresetsCRUDRetrieve}
          searchField={'name'}
          sortOptions={[
            { label: t('common.name'), value: 'name' },
            { label: t('common.lastUpdate'), value: 'updatedAt' }
          ]}
          noItemText={t('presets.noItem')}
          renderListItem={(item, selectedItem) => (
            <PresetList
              key={item.id}
              item={item}
              showDeleteButton={false}
              selectedItem={selectedItem}
              onEdit={(editItem: Preset) => onClick?.(editItem)}
            />
          )}
        />
      </SwipeableDrawer>
    </>
  );
};
export const PresetDropdown = memo(PresetDropdownComponent);
