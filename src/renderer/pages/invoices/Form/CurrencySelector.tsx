import type { FC } from 'react';
import { useTranslation } from 'react-i18next';
import { FieldChip } from './fields/FieldChip';

interface Props {
  data?: {
    currencyCode?: string;
    currencySymbol?: string;
  };
  isRequired?: boolean;
  onEdit: () => void;
}

export const CurrencySelector: FC<Props> = ({ data, onEdit, isRequired = true }) => {
  const { currencyCode, currencySymbol } = data ?? {};
  const { t } = useTranslation();

  const value = currencyCode && currencySymbol ? `${currencyCode}\u00A0/\u00A0${currencySymbol}` : undefined;

  return <FieldChip label={t('common.currency')} value={value} required={isRequired} onEdit={onEdit} />;
};
