import { type FC } from 'react';
import { GenericList } from '../../shared/components/lists/genericList/GenericList';
import type { Bank } from '../../shared/types/bank';

interface Props {
  item: Bank;
  selectedItem?: Bank;
  showDeleteButton?: boolean;
  onEdit?: (item: Bank) => void;
  onDelete?: (id: number) => void;
}

export const List: FC<Props> = ({
  item,
  selectedItem,
  showDeleteButton = true,
  onEdit = () => {},
  onDelete = () => {}
}) => (
  <GenericList
    item={item}
    selectedItem={selectedItem}
    showDeleteButton={showDeleteButton}
    onEdit={onEdit}
    onDelete={onDelete}
    getName={entry => entry.name}
    getAdditional={entry => entry.bankName}
    getInvoiceCount={entry => entry.invoiceCount}
    getQuotesCount={entry => entry.quotesCount}
    getIsArchived={entry => entry.isArchived}
  />
);
