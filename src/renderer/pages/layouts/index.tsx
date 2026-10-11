import { type FC } from 'react';
import { useTranslation } from 'react-i18next';
import { CRUDPage } from '../../shared/components/layout/crudPage/CRUDPage';
import { FilterType } from '../../shared/enums/filterType';
import { useLayoutAdd } from '../../shared/hooks/layouts/useLayoutAdd';
import { useLayoutDelete } from '../../shared/hooks/layouts/useLayoutDelete';
import { useLayoutsRetrieve } from '../../shared/hooks/layouts/useLayoutsRetrieve';
import { useLayoutUpdate } from '../../shared/hooks/layouts/useLayoutUpdate';
import type { Filter, FilterData } from '../../shared/types/filter';
import { type Layout, type LayoutAdd, type LayoutUpdate } from '../../shared/types/layouts';
import type { Response } from '../../shared/types/response';
import { createCommonFilters, createInvoiceFilters } from '../../shared/utils/filterSortFunctions';
import { isLayoutData } from '../../shared/utils/typeGuardFunctions';
import { Form } from './Form';
import { List } from './List';

export const LayoutsPage: FC = () => {
  const { t } = useTranslation();

  const filters: Filter[] = [
    ...createCommonFilters({ t, namespace: 'layouts', initial: FilterType.active }),
    ...createInvoiceFilters({ t, namespace: 'layouts' })
  ];

  const useLayoutList = (args: { filter?: FilterData[]; onDone?: (data: Response<Layout[]>) => void }) => {
    const { layouts, execute } = useLayoutsRetrieve({ filter: args.filter, onDone: args.onDone });
    return { items: layouts, execute };
  };

  const useLayoutCreate = (args: {
    item?: LayoutAdd;
    immediate?: boolean;
    onDone?: (data: Response<Layout>) => void;
  }) => useLayoutAdd({ layout: args.item, immediate: args.immediate, onDone: args.onDone });

  const useLayoutEdit = (args: {
    item?: LayoutUpdate;
    immediate?: boolean;
    onDone?: (data: Response<Layout>) => void;
  }) => useLayoutUpdate({ layout: args.item, immediate: args.immediate, onDone: args.onDone });

  return (
    <CRUDPage<Layout, LayoutAdd, LayoutUpdate>
      componentId="layouts"
      title={t('common.layout')}
      filters={filters}
      useRetrieve={useLayoutList}
      useAdd={useLayoutCreate}
      useUpdate={useLayoutEdit}
      useDelete={useLayoutDelete}
      searchField={layout => layout.schema.meta.name}
      sortOptions={[
        { label: t('common.name'), value: 'schema', getValue: layout => layout.schema.meta.name },
        { label: t('common.lastUpdate'), value: 'updatedAt' }
      ]}
      noItemButtonText={t('layouts.add')}
      noItemText={t('layouts.noItem')}
      leftTitle={t('menuItems.layouts')}
      validateAndNormalize={async data => (isLayoutData(data) ? data : undefined)}
      renderListItem={(item, selectedItem, onEdit, onDelete) => (
        <List
          key={item.id}
          item={item}
          selectedItem={selectedItem}
          onEdit={(editItem: Layout) => onEdit(editItem)}
          onDelete={(id: number) => onDelete(id)}
        />
      )}
      form={({ item, onChange }) => (
        <Form
          item={item}
          handleChange={change => {
            if (isLayoutData(change.layout)) {
              onChange({
                changedData: change.layout,
                isFormValid: change.isFormValid,
                description: change.description
              });
            }
          }}
        />
      )}
    />
  );
};
