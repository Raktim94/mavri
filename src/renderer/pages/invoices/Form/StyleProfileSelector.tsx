import type { FC } from 'react';
import { useTranslation } from 'react-i18next';
import { FieldChip } from './fields/FieldChip';

interface Props {
  name?: string;
  onEdit: () => void;
}

export const StyleProfileSelector: FC<Props> = ({ name, onEdit }) => {
  const { t } = useTranslation();

  return <FieldChip label={t('styleProfiles.title')} value={name} onEdit={onEdit} />;
};
