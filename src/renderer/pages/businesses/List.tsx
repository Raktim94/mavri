import { type FC } from 'react';
import { GenericList } from '../../shared/components/lists/genericList/GenericList';
import type { Business } from '../../shared/types/business';

interface Props {
  item: Business;
  selectedItem?: Business;
  showDeleteButton?: boolean;
  onEdit?: (item: Business) => void;
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
