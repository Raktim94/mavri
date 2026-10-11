import { memo, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { SwipeableDrawer } from '@mui/material';
import { CRUDPage } from '../../../../shared/components/layout/crudPage/CRUDPage';
import { FilterType } from '../../../../shared/enums/filterType';
import type { Filter, FilterData } from '../../../../shared/types/filter';
import type { Response } from '../../../../shared/types/response';
import { createCommonFilters, createInvoiceFilters } from '../../../../shared/utils/filterSortFunctions';
import { drawerPaperSx, useIsDesktop } from './drawerSx';

interface Props<T> {
  isOpen: boolean;
  onClose?: () => void;
  onOpen?: () => void;
  componentId: string;
  namespace: string;
  searchField: string;
  primarySort: { label: string; value: string };
  noItemText: string;
  useRetrieve: (args: { filter?: FilterData[]; onDone?: (data: Response<T[]>) => void }) => {
    items: T[];
    execute: () => void;
  };
  renderListItem: (item: T, selectedItem: T | undefined) => ReactNode;
}

function EntityPickerDrawerComponent<T, TAdd, TUpdate>(props: Props<T>) {
  const { t } = useTranslation();
  const isDesktop = useIsDesktop();

  const {
    isOpen,
    onClose,
    onOpen,
    componentId,
    namespace,
    searchField,
    primarySort,
    noItemText,
    useRetrieve,
    renderListItem
  } = props;

  const filters: Filter[] = [
    ...createCommonFilters({ t, namespace, initial: FilterType.active }),
    ...createInvoiceFilters({ t, namespace })
  ];

  return (
    <SwipeableDrawer
      anchor="bottom"
      open={isOpen}
      onClose={() => onClose?.()}
      onOpen={() => onOpen?.()}
      slotProps={{ paper: { sx: drawerPaperSx({ isDesktop, height: '80%' }) } }}
    >
      <CRUDPage<T, TAdd, TUpdate>
        componentId={componentId}
        filters={filters}
        showRightSide={false}
        showAddButton={false}
        useRetrieve={useRetrieve}
        searchField={searchField as unknown as keyof T}
        sortOptions={[
          { label: primarySort.label, value: primarySort.value as unknown as keyof T },
          { label: t('common.lastUpdate'), value: 'updatedAt' as unknown as keyof T }
        ]}
        noItemText={noItemText}
        renderListItem={(item, selectedItem) => renderListItem(item, selectedItem)}
      />
    </SwipeableDrawer>
  );
}

export const EntityPickerDrawer = memo(EntityPickerDrawerComponent) as typeof EntityPickerDrawerComponent;
