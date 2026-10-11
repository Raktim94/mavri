import type { FC } from 'react';
import { useTranslation } from 'react-i18next';
import type { Language } from '../../../shared/enums/language';
import { LANGUAGE_ITEMS } from '../../../state/constant';
import { FieldChip } from './fields/FieldChip';

interface Props {
  language?: Language;
  isRequired?: boolean;
  onEdit: () => void;
}

export const LanguageSelector: FC<Props> = ({ onEdit, isRequired = true, language }) => {
  const { t } = useTranslation();

  const value = language ? LANGUAGE_ITEMS[language]?.label : undefined;

  return <FieldChip label={t('languageFormat.language')} value={value} required={isRequired} onEdit={onEdit} />;
};
