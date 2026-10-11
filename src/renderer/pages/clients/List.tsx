import { type FC } from 'react';
import { GenericList } from '../../shared/components/lists/genericList/GenericList';
import type { Client } from '../../shared/types/client';

interface Props {
  item: Client;
  selectedItem?: Client;
  showDeleteButton?: boolean;
  onEdit?: (item: Client) => void;
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
    getShortName={entry => entry.shortName}
    getName={entry => entry.name}
    getEmail={entry => entry.email}
    getPhone={entry => entry.phone}
    getInvoiceCount={entry => entry.invoiceCount}
    getQuotesCount={entry => entry.quotesCount}
    getIsArchived={entry => entry.isArchived}
  />
);
