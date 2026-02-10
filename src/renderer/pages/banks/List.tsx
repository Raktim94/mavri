import { type FC } from 'react';
import { GenericList } from '../../shared/components/lists/genericList/GenericList';
import type { Bank } from '../../shared/types/bank';

interface Props {
  item: Bank;
  selectedItem?: Bank;
  onEdit: (item: Bank) => void;
  onDelete: (id: number) => void;
}
export const List: FC<Props> = ({ item, selectedItem, onEdit, onDelete }) => {
  return (
    <GenericList
      item={item}
      selectedItem={selectedItem}
      onEdit={onEdit}
      onDelete={onDelete}
      getName={c => c.name}
      getAdditional={c => c.bankName}
      getInvoiceCount={c => c.invoiceCount}
      getQuotesCount={c => c.quotesCount}
      getIsArchived={c => c.isArchived}
    />
  );
};
