import { type FC } from 'react';
import { GenericList } from '../../shared/components/lists/genericList/GenericList';
import type { Item } from '../../shared/types/item';
import { formatAmount } from '../../shared/utils/formatFunctions';
import { useAppSelector } from '../../state/configureStore';
import { selectSettings } from '../../state/pageSlice';

interface Props {
  item: Item;
  selectedItem?: Item;
  showDeleteButton?: boolean;
  onEdit?: (item: Item) => void;
  onDelete?: (id: number) => void;
}

export const List: FC<Props> = ({
  item,
  selectedItem,
  showDeleteButton = true,
  onEdit = () => {},
  onDelete = () => {}
}) => {
  const settings = useAppSelector(selectSettings);

  return (
    <GenericList
      item={item}
      selectedItem={selectedItem}
      showDeleteButton={showDeleteButton}
      onEdit={onEdit}
      onDelete={onDelete}
      getName={entry => entry.name}
      getAdditional={entry => formatAmount(Number(entry.amount ?? 0), settings?.amountFormat)}
      getInvoiceCount={entry => entry.invoiceCount}
      getQuotesCount={entry => entry.quotesCount}
      getIsArchived={entry => entry.isArchived}
    />
  );
};
