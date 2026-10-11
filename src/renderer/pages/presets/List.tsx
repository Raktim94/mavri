import { type FC } from 'react';
import { GenericList } from '../../shared/components/lists/genericList/GenericList';
import type { Preset } from '../../shared/types/preset';

interface Props {
  item: Preset;
  selectedItem?: Preset;
  showDeleteButton?: boolean;
  onEdit?: (item: Preset) => void;
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
    getIsArchived={entry => entry.isArchived}
  />
);
