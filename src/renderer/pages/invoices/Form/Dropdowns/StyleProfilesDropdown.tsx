import { memo, type FC } from 'react';
import { useTranslation } from 'react-i18next';
import { useStyleProfilesRetrieve } from '../../../../shared/hooks/styleProfiles/useStyleProfilesRetrieve';
import type { StyleProfile, StyleProfileAdd, StyleProfileUpdate } from '../../../../shared/types/styleProfiles';
import type { FilterData } from '../../../../shared/types/filter';
import type { Response } from '../../../../shared/types/response';
import { List as StyleProfileList } from '../../../styleProfiles/List';
import { EntityPickerDrawer } from '../drawers/EntityPickerDrawer';

interface Props {
  isOpen: boolean;
  onClose?: () => void;
  onOpen?: () => void;
  onClick?: (data: StyleProfile) => void;
}

const StyleProfilesDropdownComponent: FC<Props> = ({ isOpen, onClose, onOpen, onClick }) => {
  const { t } = useTranslation();
  const useRetrieve = (args: { filter?: FilterData[]; onDone?: (data: Response<StyleProfile[]>) => void }) => {
    const { styleProfiles, execute } = useStyleProfilesRetrieve({ filter: args.filter, onDone: args.onDone });
    return { items: styleProfiles, execute };
  };

  return (
    <EntityPickerDrawer<StyleProfile, StyleProfileAdd, StyleProfileUpdate>
      isOpen={isOpen}
      onClose={onClose}
      onOpen={onOpen}
      componentId="invoices:styleprofiles"
      namespace="styleProfiles"
      searchField="name"
      primarySort={{ label: t('common.name'), value: 'name' }}
      noItemText={t('styleProfiles.noItem')}
      useRetrieve={useRetrieve}
      renderListItem={(item, selectedItem) => (
        <StyleProfileList
          key={item.id}
          item={item}
          showDeleteButton={false}
          selectedItem={selectedItem}
          onEdit={editItem => onClick?.(editItem)}
        />
      )}
    />
  );
};

export const StyleProfilesDropdown = memo(StyleProfilesDropdownComponent);
