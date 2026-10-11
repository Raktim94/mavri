import { type FC } from 'react';
import { useTranslation } from 'react-i18next';
import { CRUDPage } from '../../shared/components/layout/crudPage/CRUDPage';
import { FilterType } from '../../shared/enums/filterType';
import { useItemAdd } from '../../shared/hooks/items/useItemAdd';
import { useItemAddBatch } from '../../shared/hooks/items/useItemAddBatch';
import { useItemDelete } from '../../shared/hooks/items/useItemDelete';
import { useItemsRetrieve } from '../../shared/hooks/items/useItemsRetrieve';
import { useItemUpdate } from '../../shared/hooks/items/useItemUpdate';
import type { Filter, FilterData } from '../../shared/types/filter';
import type { Item, ItemAdd, ItemUpdate } from '../../shared/types/item';
import type { Response } from '../../shared/types/response';
import { createCommonFilters, createInvoiceFilters } from '../../shared/utils/filterSortFunctions';
import { isItemFromData } from '../../shared/utils/typeGuardFunctions';
import { Form } from './Form';
import { ITEM_EXCEL_COLUMNS, ITEM_EXCEL_TEMPLATE } from './itemsModel';
import { List } from './List';

export const ItemsPage: FC = () => {
  const { t } = useTranslation();

  const filters: Filter[] = [
    ...createCommonFilters({ t, namespace: 'items', initial: FilterType.active }),
    ...createInvoiceFilters({ t, namespace: 'items' })
  ];

  const useItemList = (args: { filter?: FilterData[]; onDone?: (data: Response<Item[]>) => void }) => {
    const { items, execute } = useItemsRetrieve({ filter: args.filter, onDone: args.onDone });
    return { items, execute };
  };

  const useItemCreate = (args: { item?: ItemAdd; immediate?: boolean; onDone?: (data: Response<Item>) => void }) =>
    useItemAdd({ item: args.item, immediate: args.immediate, onDone: args.onDone });

  const useItemCreateBatch = (args: {
    item?: ItemAdd[];
    immediate?: boolean;
    onDone?: (data: Response<ItemAdd[]>) => void;
  }) => useItemAddBatch({ items: args.item, immediate: args.immediate, onDone: args.onDone });

  const useItemEdit = (args: { item?: ItemUpdate; immediate?: boolean; onDone?: (data: Response<Item>) => void }) =>
    useItemUpdate({ item: args.item, immediate: args.immediate, onDone: args.onDone });

  return (
    <CRUDPage<Item, ItemAdd, ItemUpdate>
      componentId="items"
      title={t('items.title')}
      filters={filters}
      excelData={{
        excelColumns: ITEM_EXCEL_COLUMNS,
        excelFileName: 'items',
        excelFormat: 'xlsx',
        excelTemplateData: ITEM_EXCEL_TEMPLATE
      }}
      useRetrieve={useItemList}
      useAdd={useItemCreate}
      useAddBatch={useItemCreateBatch}
      useUpdate={useItemEdit}
      useDelete={useItemDelete}
      searchField="name"
      sortOptions={[
        { label: t('common.name'), value: 'name' },
        { label: t('common.lastUpdate'), value: 'updatedAt' }
      ]}
      noItemButtonText={t('items.add')}
      noItemText={t('items.noItem')}
      leftTitle={t('menuItems.items')}
      validateAndNormalize={async data => (isItemFromData(data) ? data : undefined)}
      renderListItem={(item, selectedItem, onEdit, onDelete) => (
        <List
          key={item.id}
          item={item}
          selectedItem={selectedItem}
          onEdit={(editItem: Item) => onEdit(editItem)}
          onDelete={(id: number) => onDelete(id)}
        />
      )}
      form={({ item, onChange }) => (
        <Form
          item={item}
          handleChange={change => {
            if (isItemFromData(change.item)) {
              onChange({
                changedData: change.item,
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
