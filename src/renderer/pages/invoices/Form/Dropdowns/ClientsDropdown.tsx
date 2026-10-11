import { memo, type FC } from 'react';
import { useTranslation } from 'react-i18next';
import { useClientsRetrieve } from '../../../../shared/hooks/clients/useClientsRetrieve';
import type { Client, ClientAdd, ClientUpdate } from '../../../../shared/types/client';
import type { FilterData } from '../../../../shared/types/filter';
import type { Response } from '../../../../shared/types/response';
import { List as ClientsList } from '../../../clients/List';
import { EntityPickerDrawer } from '../drawers/EntityPickerDrawer';

interface Props {
  isOpen: boolean;
  onClose?: () => void;
  onOpen?: () => void;
  onClick?: (data: Client) => void;
}

const ClientsDropdownComponent: FC<Props> = ({ isOpen, onClose, onOpen, onClick }) => {
  const { t } = useTranslation();
  const useRetrieve = (args: { filter?: FilterData[]; onDone?: (data: Response<Client[]>) => void }) => {
    const { clients, execute } = useClientsRetrieve({ filter: args.filter, onDone: args.onDone });
    return { items: clients, execute };
  };

  return (
    <EntityPickerDrawer<Client, ClientAdd, ClientUpdate>
      isOpen={isOpen}
      onClose={onClose}
      onOpen={onOpen}
      componentId="invoices:clients"
      namespace="clients"
      searchField="name"
      primarySort={{ label: t('common.name'), value: 'name' }}
      noItemText={t('currencies.noItem')}
      useRetrieve={useRetrieve}
      renderListItem={(item, selectedItem) => (
        <ClientsList
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

export const ClientsDropdown = memo(ClientsDropdownComponent);
