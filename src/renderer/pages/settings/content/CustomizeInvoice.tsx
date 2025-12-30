import { Box, FormControlLabel, Grid, Switch, TextField } from '@mui/material';
import { useEffect, useRef, useState, type FC } from 'react';
import { useTranslation } from 'react-i18next';
import { PageHeader } from '../../../shared/components/layout/pageHeader/PageHeader';
import { validateOnlyNumbersLetters } from '../../../shared/utils/validatorFunctions';
import { useAppSelector } from '../../../state/configureStore';
import { selectSettings } from '../../../state/pageSlice';

interface Props {
  showBack: boolean;
  onBack?: () => void;
  onCustomizedInvoice?: (data: {
    suffix?: string;
    prefix?: string;
    includeMonth: boolean;
    includeYear: boolean;
    includeBusinessName: boolean;
  }) => void;
}
export const CustomizeInvoice: FC<Props> = ({ showBack, onCustomizedInvoice = () => {}, onBack = () => {} }) => {
  const { t } = useTranslation();
  const storeSettings = useAppSelector(selectSettings);

  const [suffix, setSuffix] = useState<string>(storeSettings?.invoiceSuffix ?? '');
  const [prefix, setPrefix] = useState<string>(storeSettings?.invoicePrefix ?? '');
  const [includeMonth, setIncludeMonth] = useState<boolean>(storeSettings?.shouldIncludeMonth ?? true);
  const [includeYear, setIncludeYear] = useState<boolean>(storeSettings?.shouldIncludeYear ?? true);
  const [includeBusinessName, setIncludeBusinessName] = useState<boolean>(
    storeSettings?.shouldIncludeBusinessName ?? true
  );
  const debounceRef = useRef<NodeJS.Timeout | null>(null);

  const handleInputChange =
    (setter: (val: string) => void, key: 'prefix' | 'suffix') => (e: React.ChangeEvent<HTMLInputElement>) => {
      const value = e.target.value;
      if (validateOnlyNumbersLetters(value)) {
        setter(value);

        if (debounceRef.current) {
          clearTimeout(debounceRef.current);
        }

        debounceRef.current = setTimeout(() => {
          onCustomizedInvoice({
            prefix: key === 'prefix' ? value : prefix,
            suffix: key === 'suffix' ? value : suffix,
            includeMonth,
            includeYear,
            includeBusinessName
          });
        }, 500);
      }
    };

  const handleSwitchChange =
    (setter: (val: boolean) => void, key: 'includeMonth' | 'includeYear' | 'includeBusinessName') =>
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const checked = e.target.checked;
      setter(checked);
      onCustomizedInvoice({
        prefix,
        suffix,
        includeMonth: key === 'includeMonth' ? checked : includeMonth,
        includeYear: key === 'includeYear' ? checked : includeYear,
        includeBusinessName: key === 'includeBusinessName' ? checked : includeBusinessName
      });
    };

  useEffect(() => {
    const timeout = setTimeout(() => {
      onCustomizedInvoice({ prefix, suffix, includeMonth, includeYear, includeBusinessName });
    }, 500);

    return () => clearTimeout(timeout);
  }, [prefix, suffix, includeMonth, includeYear, includeBusinessName, onCustomizedInvoice]);

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
      <PageHeader title={t('settingsMenuItems.titles.customizeInvoice')} showBack={showBack} onBack={onBack} />

      <Grid container spacing={2}>
        <Grid size={{ xs: 12, md: 6 }}>
          <TextField
            label={t('common.invoicePrefix')}
            fullWidth
            placeholder="e.g. INV"
            onChange={handleInputChange(setPrefix, 'prefix')}
            value={prefix}
            helperText={t('customizeInvoice.lettersAndNumbers')}
          />
        </Grid>
        <Grid size={{ xs: 12, md: 6 }}>
          <TextField
            label={t('common.invoiceSuffix')}
            fullWidth
            placeholder="e.g. ALPHA"
            value={suffix}
            onChange={handleInputChange(setSuffix, 'suffix')}
            helperText={t('customizeInvoice.lettersAndNumbers')}
          />
        </Grid>
        <Grid size={{ xs: 12, md: 12 }}>
          <FormControlLabel
            control={<Switch checked={includeYear} onChange={handleSwitchChange(setIncludeYear, 'includeYear')} />}
            label={t('customizeInvoice.includeYear')}
          />
          <FormControlLabel
            control={<Switch checked={includeMonth} onChange={handleSwitchChange(setIncludeMonth, 'includeMonth')} />}
            label={t('customizeInvoice.includeMonth')}
          />
          <FormControlLabel
            control={
              <Switch
                checked={includeBusinessName}
                onChange={handleSwitchChange(setIncludeBusinessName, 'includeBusinessName')}
              />
            }
            label={t('customizeInvoice.includeBusinessName')}
          />
        </Grid>
      </Grid>
    </Box>
  );
};
