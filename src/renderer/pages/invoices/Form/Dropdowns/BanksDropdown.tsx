import { memo, type FC } from 'react';
import { useTranslation } from 'react-i18next';
import { useBanksRetrieve } from '../../../../shared/hooks/banks/useBanksRetrieve';
import type { Bank, BankAdd, BankUpdate } from '../../../../shared/types/bank';
import type { FilterData } from '../../../../shared/types/filter';
import type { Response } from '../../../../shared/types/response';
import { List as BankList } from '../../../banks/List';
import { EntityPickerDrawer } from '../drawers/EntityPickerDrawer';

interface Props {
  isOpen: boolean;
  onClose?: () => void;
  onOpen?: () => void;
  onClick?: (data: Bank) => void;
}

const BanksDropdownComponent: FC<Props> = ({ isOpen, onClose, onOpen, onClick }) => {
  const { t } = useTranslation();
  const useRetrieve = (args: { filter?: FilterData[]; onDone?: (data: Response<Bank[]>) => void }) => {
    const { banks, execute } = useBanksRetrieve({ filter: args.filter, onDone: args.onDone });
    return { items: banks, execute };
  };

  return (
    <EntityPickerDrawer<Bank, BankAdd, BankUpdate>
      isOpen={isOpen}
      onClose={onClose}
      onOpen={onOpen}
      componentId="invoices:banks"
      namespace="banks"
      searchField="name"
      primarySort={{ label: t('common.name'), value: 'name' }}
      noItemText={t('banks.noItem')}
      useRetrieve={useRetrieve}
      renderListItem={(item, selectedItem) => (
        <BankList
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

export const BanksDropdown = memo(BanksDropdownComponent);
