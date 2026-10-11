import { memo, type FC } from 'react';
import { useTranslation } from 'react-i18next';
import { useBusinessesRetrieve } from '../../../../shared/hooks/businesses/useBusinessesRetrieve';
import type { Business, BusinessAdd, BusinessUpdate } from '../../../../shared/types/business';
import type { FilterData } from '../../../../shared/types/filter';
import type { Response } from '../../../../shared/types/response';
import { List as BusinessList } from '../../../businesses/List';
import { EntityPickerDrawer } from '../drawers/EntityPickerDrawer';

interface Props {
  isOpen: boolean;
  onClose?: () => void;
  onOpen?: () => void;
  onClick?: (data: Business) => void;
}

const BusinessesDropdownComponent: FC<Props> = ({ isOpen, onClose, onOpen, onClick }) => {
  const { t } = useTranslation();
  const useRetrieve = (args: { filter?: FilterData[]; onDone?: (data: Response<Business[]>) => void }) => {
    const { businesses, execute } = useBusinessesRetrieve({ filter: args.filter, onDone: args.onDone });
    return { items: businesses, execute };
  };

  return (
    <EntityPickerDrawer<Business, BusinessAdd, BusinessUpdate>
      isOpen={isOpen}
      onClose={onClose}
      onOpen={onOpen}
      componentId="invoices:businesses"
      namespace="businesses"
      searchField="name"
      primarySort={{ label: t('common.name'), value: 'name' }}
      noItemText={t('businesses.noItem')}
      useRetrieve={useRetrieve}
      renderListItem={(item, selectedItem) => (
        <BusinessList
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

export const BusinessesDropdown = memo(BusinessesDropdownComponent);
