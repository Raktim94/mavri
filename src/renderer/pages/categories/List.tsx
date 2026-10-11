import { type FC } from 'react';
import { GenericList } from '../../shared/components/lists/genericList/GenericList';
import type { Category } from '../../shared/types/category';

interface Props {
  item: Category;
  selectedItem?: Category;
  onEdit: (item: Category) => void;
  onDelete: (id: number) => void;
}

export const List: FC<Props> = ({ item, selectedItem, onEdit, onDelete }) => (
  <GenericList
    item={item}
    selectedItem={selectedItem}
    onEdit={onEdit}
    onDelete={onDelete}
    getName={entry => entry.name}
    getInvoiceCount={entry => entry.invoiceCount}
    getQuotesCount={entry => entry.quotesCount}
    getIsArchived={entry => entry.isArchived}
  />
);
