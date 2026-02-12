import { Box } from '@mui/material';
import { memo, type FC } from 'react';
import type { InvoiceFromData } from '../../../shared/types/invoice';
import { useAppSelector } from '../../../state/configureStore';
import { selectSettings } from '../../../state/pageSlice';
import { BankSelector } from './BankSelector';
import { CurrencySelector } from './CurrencySelector';
import { LanguageSelector } from './LanguageSelector';
import { StyleProfileSelector } from './StyleProfileSelector';

interface Props {
  invoiceForm?: InvoiceFromData;
  onEditCurrency: () => void;
  onEditLanguage: () => void;
  onEditStyleProfile: () => void;
  onEditBank: () => void;
}
const TopRowComponent: FC<Props> = ({
  invoiceForm,
  onEditBank,
  onEditCurrency,
  onEditStyleProfile,
  onEditLanguage
}) => {
  const storeSettings = useAppSelector(selectSettings);

  return (
    <Box sx={{ display: 'flex', flexDirection: 'row', justifyContent: 'space-between', gap: 2 }}>
      <CurrencySelector onEdit={onEditCurrency} invoiceForm={invoiceForm} />
      <BankSelector onEdit={onEditBank} invoiceForm={invoiceForm} />
      {storeSettings?.styleProfilesON && <StyleProfileSelector onEdit={onEditStyleProfile} invoiceForm={invoiceForm} />}
      <LanguageSelector onEdit={onEditLanguage} invoiceForm={invoiceForm} />
    </Box>
  );
};
export const TopRow = memo(TopRowComponent);
