import type { FC } from 'react';
import { useTranslation } from 'react-i18next';
import { FieldChip } from './fields/FieldChip';

interface Props {
  clientName?: string;
  isRequired?: boolean;
  onEdit: () => void;
}

export const ClientSelector: FC<Props> = ({ clientName, onEdit, isRequired = true }) => {
  const { t } = useTranslation();

  return <FieldChip label={t('invoices.billTo')} value={clientName} required={isRequired} onEdit={onEdit} />;
};
