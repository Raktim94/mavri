import { type FC } from 'react';
import { useTranslation } from 'react-i18next';
import { CRUDPage } from '../../shared/components/layout/crudPage/CRUDPage';
import { FilterType } from '../../shared/enums/filterType';
import { useBusinessAdd } from '../../shared/hooks/businesses/useBusinessAdd';
import { useBusinessAddBatch } from '../../shared/hooks/businesses/useBusinessAddBatch';
import { useBusinessDelete } from '../../shared/hooks/businesses/useBusinessDelete';
import { useBusinessesRetrieve } from '../../shared/hooks/businesses/useBusinessesRetrieve';
import { useBusinessUpdate } from '../../shared/hooks/businesses/useBusinessUpdate';
import type { Business, BusinessAdd, BusinessUpdate } from '../../shared/types/business';
import type { Filter, FilterData } from '../../shared/types/filter';
import type { Response } from '../../shared/types/response';
import { createCommonFilters, createInvoiceFilters } from '../../shared/utils/filterSortFunctions';
import { isBusinessFromData } from '../../shared/utils/typeGuardFunctions';
import { BUSINESS_EXCEL_COLUMNS, BUSINESS_EXCEL_TEMPLATE } from './businessModel';
import { Form } from './Form';
import { List } from './List';

export const BusinessesPage: FC = () => {
  const { t } = useTranslation();

  const filters: Filter[] = [
    ...createCommonFilters({ t, namespace: 'businesses', initial: FilterType.active }),
    ...createInvoiceFilters({ t, namespace: 'businesses' })
  ];

  const useBusinessList = (args: { filter?: FilterData[]; onDone?: (data: Response<Business[]>) => void }) => {
    const { businesses, execute } = useBusinessesRetrieve({ filter: args.filter, onDone: args.onDone });
    return { items: businesses, execute };
  };

  const useBusinessCreate = (args: {
    item?: BusinessAdd;
    immediate?: boolean;
    onDone?: (data: Response<Business>) => void;
  }) => useBusinessAdd({ business: args.item, immediate: args.immediate, onDone: args.onDone });

  const useBusinessCreateBatch = (args: {
    item?: BusinessAdd[];
    immediate?: boolean;
    onDone?: (data: Response<BusinessAdd[]>) => void;
  }) => useBusinessAddBatch({ businesses: args.item, immediate: args.immediate, onDone: args.onDone });

  const useBusinessEdit = (args: {
    item?: BusinessUpdate;
    immediate?: boolean;
    onDone?: (data: Response<Business>) => void;
  }) => useBusinessUpdate({ business: args.item, immediate: args.immediate, onDone: args.onDone });

  return (
    <CRUDPage<Business, BusinessAdd, BusinessUpdate>
      componentId="businesses"
      title={t('businesses.title')}
      filters={filters}
      excelData={{
        excelColumns: BUSINESS_EXCEL_COLUMNS,
        excelFileName: 'businesses',
        excelFormat: 'xlsx',
        excelTemplateData: BUSINESS_EXCEL_TEMPLATE
      }}
      useRetrieve={useBusinessList}
      useAdd={useBusinessCreate}
      useAddBatch={useBusinessCreateBatch}
      useUpdate={useBusinessEdit}
      useDelete={useBusinessDelete}
      searchField="name"
      sortOptions={[
        { label: t('common.name'), value: 'name' },
        { label: t('common.lastUpdate'), value: 'updatedAt' }
      ]}
      noItemButtonText={t('businesses.add')}
      noItemText={t('businesses.noItem')}
      leftTitle={t('menuItems.businesses')}
      validateAndNormalize={async data => (isBusinessFromData(data) ? data : undefined)}
      renderListItem={(item, selectedItem, onEdit, onDelete) => (
        <List
          key={item.id}
          item={item}
          selectedItem={selectedItem}
          onEdit={(editItem: Business) => onEdit(editItem)}
          onDelete={(id: number) => onDelete(id)}
        />
      )}
      form={({ item, onChange }) => (
        <Form
          business={item}
          handleChange={change => {
            if (isBusinessFromData(change.business)) {
              onChange({
                changedData: change.business,
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
