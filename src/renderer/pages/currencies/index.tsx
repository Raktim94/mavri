import { type FC } from 'react';
import { useTranslation } from 'react-i18next';
import { CRUDPage } from '../../shared/components/layout/crudPage/CRUDPage';
import { FilterType } from '../../shared/enums/filterType';
import { useCurrenciesRetrieve } from '../../shared/hooks/currencies/useCurrenciesRetrieve';
import { useCurrencyAdd } from '../../shared/hooks/currencies/useCurrencyAdd';
import { useCurrencyAddBatch } from '../../shared/hooks/currencies/useCurrencyAddBatch';
import { useCurrencyDelete } from '../../shared/hooks/currencies/useCurrencyDelete';
import { useCurrencyUpdate } from '../../shared/hooks/currencies/useCurrencyUpdate';
import type { Currency, CurrencyAdd, CurrencyUpdate } from '../../shared/types/currency';
import type { Filter, FilterData } from '../../shared/types/filter';
import type { Response } from '../../shared/types/response';
import { createCommonFilters, createInvoiceFilters } from '../../shared/utils/filterSortFunctions';
import { isCurrencyFromData } from '../../shared/utils/typeGuardFunctions';
import { CURRENCY_EXCEL_COLUMNS, CURRENCY_EXCEL_TEMPLATE } from './currencyModel';
import { Form } from './Form';
import { List } from './List';

export const CurrenciesPage: FC = () => {
  const { t } = useTranslation();

  const filters: Filter[] = [
    ...createCommonFilters({ t, namespace: 'currencies', initial: FilterType.active }),
    ...createInvoiceFilters({ t, namespace: 'currencies' })
  ];

  const useCurrencyList = (args: { filter?: FilterData[]; onDone?: (data: Response<Currency[]>) => void }) => {
    const { currencies, execute } = useCurrenciesRetrieve({ filter: args.filter, onDone: args.onDone });
    return { items: currencies, execute };
  };

  const useCurrencyCreate = (args: {
    item?: CurrencyAdd;
    immediate?: boolean;
    onDone?: (data: Response<Currency>) => void;
  }) => useCurrencyAdd({ currency: args.item, immediate: args.immediate, onDone: args.onDone });

  const useCurrencyCreateBatch = (args: {
    item?: CurrencyAdd[];
    immediate?: boolean;
    onDone?: (data: Response<CurrencyAdd[]>) => void;
  }) => useCurrencyAddBatch({ currencies: args.item, immediate: args.immediate, onDone: args.onDone });

  const useCurrencyEdit = (args: {
    item?: CurrencyUpdate;
    immediate?: boolean;
    onDone?: (data: Response<Currency>) => void;
  }) => useCurrencyUpdate({ currency: args.item, immediate: args.immediate, onDone: args.onDone });

  return (
    <CRUDPage<Currency, CurrencyAdd, CurrencyUpdate>
      componentId="currencies"
      title={t('common.currency')}
      filters={filters}
      excelData={{
        excelColumns: CURRENCY_EXCEL_COLUMNS,
        excelFileName: 'currencies',
        excelFormat: 'xlsx',
        excelTemplateData: CURRENCY_EXCEL_TEMPLATE
      }}
      useRetrieve={useCurrencyList}
      useAdd={useCurrencyCreate}
      useAddBatch={useCurrencyCreateBatch}
      useUpdate={useCurrencyEdit}
      useDelete={useCurrencyDelete}
      searchField="text"
      sortOptions={[
        { label: t('common.text'), value: 'text' },
        { label: t('common.lastUpdate'), value: 'updatedAt' }
      ]}
      noItemButtonText={t('currencies.add')}
      noItemText={t('currencies.noItem')}
      leftTitle={t('menuItems.currencies')}
      validateAndNormalize={async data => (isCurrencyFromData(data) ? data : undefined)}
      renderListItem={(item, selectedItem, onEdit, onDelete) => (
        <List
          key={item.id}
          item={item}
          selectedItem={selectedItem}
          onEdit={(editItem: Currency) => onEdit(editItem)}
          onDelete={(id: number) => onDelete(id)}
        />
      )}
      form={({ item, onChange }) => (
        <Form
          currency={item}
          handleChange={change => {
            if (isCurrencyFromData(change.currency)) {
              onChange({
                changedData: change.currency,
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
