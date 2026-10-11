import { type FC } from 'react';
import { useTranslation } from 'react-i18next';
import { CRUDPage } from '../../shared/components/layout/crudPage/CRUDPage';
import { FilterType } from '../../shared/enums/filterType';
import { useBankAdd } from '../../shared/hooks/banks/useBankAdd';
import { useBankAddBatch } from '../../shared/hooks/banks/useBankAddBatch';
import { useBankDelete } from '../../shared/hooks/banks/useBankDelete';
import { useBanksRetrieve } from '../../shared/hooks/banks/useBanksRetrieve';
import { useBankUpdate } from '../../shared/hooks/banks/useBankUpdate';
import type { Bank, BankAdd, BankUpdate } from '../../shared/types/bank';
import type { Filter, FilterData } from '../../shared/types/filter';
import type { Response } from '../../shared/types/response';
import { createCommonFilters, createInvoiceFilters } from '../../shared/utils/filterSortFunctions';
import { isBankFromData } from '../../shared/utils/typeGuardFunctions';
import { BANK_EXCEL_COLUMNS, BANK_EXCEL_TEMPLATE } from './banksModel';
import { Form } from './Form';
import { List } from './List';

export const BanksPage: FC = () => {
  const { t } = useTranslation();

  const filters: Filter[] = [
    ...createCommonFilters({ t, namespace: 'banks', initial: FilterType.active }),
    ...createInvoiceFilters({ t, namespace: 'banks' })
  ];

  const useBankList = (args: { filter?: FilterData[]; onDone?: (data: Response<Bank[]>) => void }) => {
    const { banks, execute } = useBanksRetrieve({ filter: args.filter, onDone: args.onDone });
    return { items: banks, execute };
  };

  const useBankCreate = (args: { item?: BankAdd; immediate?: boolean; onDone?: (data: Response<Bank>) => void }) =>
    useBankAdd({ bank: args.item, immediate: args.immediate, onDone: args.onDone });

  const useBankCreateBatch = (args: {
    item?: BankAdd[];
    immediate?: boolean;
    onDone?: (data: Response<BankAdd[]>) => void;
  }) => useBankAddBatch({ banks: args.item, immediate: args.immediate, onDone: args.onDone });

  const useBankEdit = (args: { item?: BankUpdate; immediate?: boolean; onDone?: (data: Response<Bank>) => void }) =>
    useBankUpdate({ bank: args.item, immediate: args.immediate, onDone: args.onDone });

  return (
    <CRUDPage<Bank, BankAdd, BankUpdate>
      componentId="banks"
      title={t('common.bank')}
      filters={filters}
      excelData={{
        excelColumns: BANK_EXCEL_COLUMNS,
        excelFileName: 'banks',
        excelFormat: 'xlsx',
        excelTemplateData: BANK_EXCEL_TEMPLATE
      }}
      useRetrieve={useBankList}
      useAdd={useBankCreate}
      useAddBatch={useBankCreateBatch}
      useUpdate={useBankEdit}
      useDelete={useBankDelete}
      searchField="name"
      sortOptions={[
        { label: t('common.name'), value: 'name' },
        { label: t('common.lastUpdate'), value: 'updatedAt' }
      ]}
      noItemButtonText={t('banks.add')}
      noItemText={t('banks.noItem')}
      leftTitle={t('menuItems.banks')}
      validateAndNormalize={async data => (isBankFromData(data) ? data : undefined)}
      renderListItem={(item, selectedItem, onEdit, onDelete) => (
        <List
          key={item.id}
          item={item}
          selectedItem={selectedItem}
          onEdit={(editItem: Bank) => onEdit(editItem)}
          onDelete={(id: number) => onDelete(id)}
        />
      )}
      form={({ item, onChange }) => (
        <Form
          bank={item}
          handleChange={change => {
            if (isBankFromData(change.bank)) {
              onChange({
                changedData: change.bank,
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
