import type { FC } from 'react';
import { useTranslation } from 'react-i18next';
import { FieldChip } from './fields/FieldChip';

interface Props {
  name?: string;
  onEdit: () => void;
  onClear?: () => void;
}

export const BankSelector: FC<Props> = ({ name, onEdit, onClear }) => {
  const { t } = useTranslation();

  return (
    <FieldChip label={t('common.bank')} value={name} onEdit={onEdit} onClear={onClear} clearText={t('common.clear')} />
  );
};
