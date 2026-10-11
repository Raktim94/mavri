import { type FC } from 'react';
import { GenericList } from '../../shared/components/lists/genericList/GenericList';
import type { StyleProfile } from '../../shared/types/styleProfiles';

interface Props {
  item: StyleProfile;
  selectedItem?: StyleProfile;
  showDeleteButton?: boolean;
  onEdit?: (item: StyleProfile) => void;
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
    getInvoiceCount={entry => entry.invoiceCount}
    getQuotesCount={entry => entry.quotesCount}
    getIsArchived={entry => entry.isArchived}
  />
);
