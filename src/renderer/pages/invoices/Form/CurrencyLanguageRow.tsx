import { Box } from '@mui/material';
import { memo, type FC } from 'react';
import type { InvoiceFromData } from '../../../shared/types/invoice';
import { CurrencySelector } from './CurrencySelector';
import { LanguageSelector } from './LanguageSelector';

interface Props {
  invoiceForm?: InvoiceFromData;
  onEditCurrency: () => void;
  onEditLanguage: () => void;
}
const CurrencyLanguageRowComponent: FC<Props> = ({ invoiceForm, onEditCurrency, onEditLanguage }) => {
  return (
    <Box sx={{ display: 'flex', flexDirection: 'row', justifyContent: 'space-between', gap: 2 }}>
      <CurrencySelector onEdit={onEditCurrency} invoiceForm={invoiceForm} />

      <LanguageSelector onEdit={onEditLanguage} invoiceForm={invoiceForm} />
    </Box>
  );
};
export const CurrencyLanguageRow = memo(CurrencyLanguageRowComponent);
