import { type FC } from 'react';
import { useTranslation } from 'react-i18next';
import { CRUDPage } from '../../shared/components/layout/crudPage/CRUDPage';
import { FilterType } from '../../shared/enums/filterType';
import { useClientAdd } from '../../shared/hooks/clients/useClientAdd';
import { useClientAddBatch } from '../../shared/hooks/clients/useClientAddBatch';
import { useClientDelete } from '../../shared/hooks/clients/useClientDelete';
import { useClientsRetrieve } from '../../shared/hooks/clients/useClientsRetrieve';
import { useClientUpdate } from '../../shared/hooks/clients/useClientUpdate';
import type { Client, ClientAdd, ClientUpdate } from '../../shared/types/client';
import type { Filter, FilterData } from '../../shared/types/filter';
import type { Response } from '../../shared/types/response';
import { createCommonFilters, createInvoiceFilters } from '../../shared/utils/filterSortFunctions';
import { isClientFromData } from '../../shared/utils/typeGuardFunctions';
import { CLIENT_EXCEL_COLUMNS, CLIENT_EXCEL_TEMPLATE } from './clientModel';
import { Form } from './Form';
import { List } from './List';

export const ClientsPage: FC = () => {
  const { t } = useTranslation();

  const filters: Filter[] = [
    ...createCommonFilters({ t, namespace: 'clients', initial: FilterType.active }),
    ...createInvoiceFilters({ t, namespace: 'clients' })
  ];

  const useClientList = (args: { filter?: FilterData[]; onDone?: (data: Response<Client[]>) => void }) => {
    const { clients, execute } = useClientsRetrieve({ filter: args.filter, onDone: args.onDone });
    return { items: clients, execute };
  };

  const useClientCreate = (args: {
    item?: ClientAdd;
    immediate?: boolean;
    onDone?: (data: Response<Client>) => void;
  }) => useClientAdd({ client: args.item, immediate: args.immediate, onDone: args.onDone });

  const useClientCreateBatch = (args: {
    item?: ClientAdd[];
    immediate?: boolean;
    onDone?: (data: Response<ClientAdd[]>) => void;
  }) => useClientAddBatch({ clients: args.item, immediate: args.immediate, onDone: args.onDone });

  const useClientEdit = (args: {
    item?: ClientUpdate;
    immediate?: boolean;
    onDone?: (data: Response<Client>) => void;
  }) => useClientUpdate({ client: args.item, immediate: args.immediate, onDone: args.onDone });

  return (
    <CRUDPage<Client, ClientAdd, ClientUpdate>
      componentId="clients"
      title={t('common.client')}
      filters={filters}
      excelData={{
        excelColumns: CLIENT_EXCEL_COLUMNS,
        excelFileName: 'clients',
        excelFormat: 'xlsx',
        excelTemplateData: CLIENT_EXCEL_TEMPLATE
      }}
      useRetrieve={useClientList}
      useAdd={useClientCreate}
      useAddBatch={useClientCreateBatch}
      useUpdate={useClientEdit}
      useDelete={useClientDelete}
      searchField="name"
      sortOptions={[
        { label: t('common.name'), value: 'name' },
        { label: t('common.lastUpdate'), value: 'updatedAt' }
      ]}
      noItemButtonText={t('clients.add')}
      noItemText={t('clients.noItem')}
      leftTitle={t('menuItems.clients')}
      validateAndNormalize={async data => (isClientFromData(data) ? data : undefined)}
      renderListItem={(item, selectedItem, onEdit, onDelete) => (
        <List
          key={item.id}
          item={item}
          selectedItem={selectedItem}
          onEdit={(editItem: Client) => onEdit(editItem)}
          onDelete={(id: number) => onDelete(id)}
        />
      )}
      form={({ item, onChange }) => (
        <Form
          client={item}
          handleChange={change => {
            if (isClientFromData(change.client)) {
              onChange({
                changedData: change.client,
                isFormValid: change.isFormValid,
                description: change.description
              });
            }
          }}
        />
      )}
    />
  );
};
