import AddIcon from '@mui/icons-material/Add';
import type { FC } from 'react';
import { useTranslation } from 'react-i18next';
import { FieldChip } from './fields/FieldChip';

interface Props {
  onEdit: () => void;
}

export const ItemSelector: FC<Props> = ({ onEdit }) => {
  const { t } = useTranslation();

  return <FieldChip label={t('invoices.addItem')} icon={<AddIcon />} required onEdit={onEdit} />;
};
