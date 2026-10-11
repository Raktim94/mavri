import { memo, type FC } from 'react';
import type { Language } from '../../../../shared/enums/language';
import { LANGUAGE_ITEMS_ARRAY } from '../../../../state/constant';
import { OptionPickerDrawer, type PickerOption } from '../drawers/OptionPickerDrawer';

interface Props {
  isOpen: boolean;
  onClose?: () => void;
  onOpen?: () => void;
  onClick?: (data: Language) => void;
}

const LANGUAGE_OPTIONS: PickerOption[] = LANGUAGE_ITEMS_ARRAY.map(option => ({
  label: option.label,
  value: option.value
}));

const LanguageDropdownComponent: FC<Props> = ({ isOpen, onClose, onOpen, onClick }) => (
  <OptionPickerDrawer
    isOpen={isOpen}
    onClose={onClose}
    onOpen={onOpen}
    options={LANGUAGE_OPTIONS}
    searchKey="invoices:languages"
    onPick={value => onClick?.(value as Language)}
    height="40%"
  />
);

export const LanguageDropdown = memo(LanguageDropdownComponent);
