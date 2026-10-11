import { memo, type FC } from 'react';
import { useTranslation } from 'react-i18next';
import { useCurrenciesRetrieve } from '../../../../shared/hooks/currencies/useCurrenciesRetrieve';
import type { Currency, CurrencyAdd, CurrencyUpdate } from '../../../../shared/types/currency';
import type { FilterData } from '../../../../shared/types/filter';
import type { Response } from '../../../../shared/types/response';
import { List as CurrenciesList } from '../../../currencies/List';
import { EntityPickerDrawer } from '../drawers/EntityPickerDrawer';

interface Props {
  isOpen: boolean;
  onClose?: () => void;
  onOpen?: () => void;
  onClick?: (data: Currency) => void;
}

const CurrenciesDropdownComponent: FC<Props> = ({ isOpen, onClose, onOpen, onClick }) => {
  const { t } = useTranslation();
  const useRetrieve = (args: { filter?: FilterData[]; onDone?: (data: Response<Currency[]>) => void }) => {
    const { currencies, execute } = useCurrenciesRetrieve({ filter: args.filter, onDone: args.onDone });
    return { items: currencies, execute };
  };

  return (
    <EntityPickerDrawer<Currency, CurrencyAdd, CurrencyUpdate>
      isOpen={isOpen}
      onClose={onClose}
      onOpen={onOpen}
      componentId="invoices:currencies"
      namespace="currencies"
      searchField="text"
      primarySort={{ label: t('common.text'), value: 'text' }}
      noItemText={t('currencies.noItem')}
      useRetrieve={useRetrieve}
      renderListItem={(item, selectedItem) => (
        <CurrenciesList
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

export const CurrenciesDropdown = memo(CurrenciesDropdownComponent);
