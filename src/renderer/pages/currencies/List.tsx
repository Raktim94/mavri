import { type FC } from 'react';
import { GenericList } from '../../shared/components/lists/genericList/GenericList';
import type { Currency } from '../../shared/types/currency';

interface Props {
  item: Currency;
  selectedItem?: Currency;
  showDeleteButton?: boolean;
  onEdit?: (item: Currency) => void;
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
    getName={entry => entry.text}
    getAdditional={entry => `${entry.code} / ${entry.symbol}`}
    getInvoiceCount={entry => entry.invoiceCount}
    getQuotesCount={entry => entry.quotesCount}
    getIsArchived={entry => entry.isArchived}
  />
);
