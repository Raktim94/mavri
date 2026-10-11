import { memo, useState, type FC } from 'react';
import { useTranslation } from 'react-i18next';
import type { InvoiceType } from '../../../../shared/enums/invoiceType';
import { useItemsRetrieve } from '../../../../shared/hooks/items/useItemsRetrieve';
import type { FilterData } from '../../../../shared/types/filter';
import type { CustomFieldMeta, ItemForm } from '../../../../shared/types/invoice';
import type { Item, ItemAdd, ItemUpdate } from '../../../../shared/types/item';
import type { Response } from '../../../../shared/types/response';
import { List as ItemsList } from '../../../items/List';
import { EntityPickerDrawer } from '../drawers/EntityPickerDrawer';
import { ItemMetadataSetter } from '../Modals/ItemMetadataSetter';

interface Props {
  isOpen: boolean;
  type: InvoiceType;
  headerOptions: CustomFieldMeta[];
  onClose?: () => void;
  onOpen?: () => void;
  onClick?: (item: Item, data: ItemForm) => void;
}

const ItemsDropdownComponent: FC<Props> = ({ isOpen, type, headerOptions, onClose, onOpen, onClick }) => {
  const { t } = useTranslation();
  const [pickedItem, setPickedItem] = useState<Item | undefined>(undefined);

  const useRetrieve = (args: { filter?: FilterData[]; onDone?: (data: Response<Item[]>) => void }) => {
    const { items, execute } = useItemsRetrieve({ filter: args.filter, onDone: args.onDone });
    return { items, execute };
  };

  return (
    <>
      {isOpen && (
        <ItemMetadataSetter
          type={type}
          headerOptions={headerOptions}
          currUnitPrice={Number(pickedItem?.amount ?? 0)}
          isOpen={pickedItem !== undefined}
          onCancel={() => setPickedItem(undefined)}
          onSave={data => {
            if (pickedItem) onClick?.(pickedItem, data);
            setPickedItem(undefined);
          }}
        />
      )}

      {!pickedItem && (
        <EntityPickerDrawer<Item, ItemAdd, ItemUpdate>
          isOpen={isOpen}
          onClose={onClose}
          onOpen={onOpen}
          componentId="invoices:items"
          namespace="items"
          searchField="name"
          primarySort={{ label: t('common.name'), value: 'name' }}
          noItemText={t('items.noItem')}
          useRetrieve={useRetrieve}
          renderListItem={(item, selectedItem) => (
            <ItemsList
              key={item.id}
              item={item}
              showDeleteButton={false}
              selectedItem={selectedItem}
              onEdit={editItem => setPickedItem(editItem)}
            />
          )}
        />
      )}
    </>
  );
};

export const ItemsDropdown = memo(ItemsDropdownComponent);
