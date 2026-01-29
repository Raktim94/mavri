import { Box } from '@mui/material';
import { memo, type FC } from 'react';
import type { InvoiceFromData } from '../../../shared/types/invoice';
import { CurrencySelector } from './CurrencySelector';
import { LanguageSelector } from './LanguageSelector';
import { StyleProfileSelector } from './StyleProfileSelector';

interface Props {
  invoiceForm?: InvoiceFromData;
  onEditCurrency: () => void;
  onEditLanguage: () => void;
  onEditStyleProfile: () => void;
}
const CurrencyLanguageProfileRowComponent: FC<Props> = ({
  invoiceForm,
  onEditCurrency,
  onEditStyleProfile,
  onEditLanguage
}) => {
  return (
    <Box sx={{ display: 'flex', flexDirection: 'row', justifyContent: 'space-between', gap: 2 }}>
      <CurrencySelector onEdit={onEditCurrency} invoiceForm={invoiceForm} />
      <StyleProfileSelector onEdit={onEditStyleProfile} invoiceForm={invoiceForm} />
      <LanguageSelector onEdit={onEditLanguage} invoiceForm={invoiceForm} />
    </Box>
  );
};
export const CurrencyLanguageProfileRow = memo(CurrencyLanguageProfileRowComponent);
