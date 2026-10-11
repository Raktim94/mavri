import { Box, FormControlLabel, Grid, Switch, TextField } from '@mui/material';
import { useCallback, useEffect, useRef, useState, type FC } from 'react';
import { useTranslation } from 'react-i18next';
import { PageHeader } from '../../../shared/components/layout/pageHeader/PageHeader';
import { validateOnlyNumbersLetters } from '../../../shared/utils/validatorFunctions';
import { useAppSelector } from '../../../state/configureStore';
import { selectSettings } from '../../../state/pageSlice';
import { applyInvoiceNumberingToggle, type InvoiceNumbering, type InvoiceNumberingToggle } from '../settingsModel';

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

const EMIT_DELAY_MS = 500;

export const CustomizeInvoice: FC<Props> = ({ showBack, onCustomizedInvoice = () => {}, onBack = () => {} }) => {
  const { t } = useTranslation();
  const storeSettings = useAppSelector(selectSettings);

  const [prefix, setPrefix] = useState<string>(storeSettings?.invoicePrefix ?? '');
  const [suffix, setSuffix] = useState<string>(storeSettings?.invoiceSuffix ?? '');
  const [includeMonth, setIncludeMonth] = useState<boolean>(storeSettings?.shouldIncludeMonth ?? true);
  const [includeYear, setIncludeYear] = useState<boolean>(storeSettings?.shouldIncludeYear ?? true);
  const [includeBusinessName, setIncludeBusinessName] = useState<boolean>(
    storeSettings?.shouldIncludeBusinessName ?? true
  );
  const emitTimerRef = useRef<NodeJS.Timeout | null>(null);

  const emitLater = useCallback(
    (numbering: InvoiceNumbering) => {
      if (emitTimerRef.current) {
        clearTimeout(emitTimerRef.current);
      }
      emitTimerRef.current = setTimeout(() => {
        onCustomizedInvoice(numbering);
      }, EMIT_DELAY_MS);
    },
    [onCustomizedInvoice]
  );

  const changePrefix = (event: React.ChangeEvent<HTMLInputElement>) => {
    const value = event.target.value;
    if (validateOnlyNumbersLetters(value)) {
      setPrefix(value);
      emitLater({ prefix: value, suffix, includeMonth, includeYear, includeBusinessName });
    }
  };

  const changeSuffix = (event: React.ChangeEvent<HTMLInputElement>) => {
    const value = event.target.value;
    if (validateOnlyNumbersLetters(value)) {
      setSuffix(value);
      emitLater({ prefix, suffix: value, includeMonth, includeYear, includeBusinessName });
    }
  };

  const toggleNumbering =
    (setter: (value: boolean) => void, toggle: InvoiceNumberingToggle) =>
    (event: React.ChangeEvent<HTMLInputElement>) => {
      const checked = event.target.checked;
      setter(checked);
      onCustomizedInvoice(
        applyInvoiceNumberingToggle({ prefix, suffix, includeMonth, includeYear, includeBusinessName }, toggle, checked)
      );
    };

  useEffect(() => {
    const timeout = setTimeout(() => {
      onCustomizedInvoice({ prefix, suffix, includeMonth, includeYear, includeBusinessName });
    }, EMIT_DELAY_MS);

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
            onChange={changePrefix}
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
            onChange={changeSuffix}
            helperText={t('customizeInvoice.lettersAndNumbers')}
          />
        </Grid>
        <Grid size={{ xs: 12, md: 12 }}>
          <FormControlLabel
            control={<Switch checked={includeYear} onChange={toggleNumbering(setIncludeYear, 'includeYear')} />}
            label={t('customizeInvoice.includeYear')}
          />
          <FormControlLabel
            control={<Switch checked={includeMonth} onChange={toggleNumbering(setIncludeMonth, 'includeMonth')} />}
            label={t('customizeInvoice.includeMonth')}
          />
          <FormControlLabel
            control={
              <Switch
                checked={includeBusinessName}
                onChange={toggleNumbering(setIncludeBusinessName, 'includeBusinessName')}
              />
            }
            label={t('customizeInvoice.includeBusinessName')}
          />
        </Grid>
      </Grid>
    </Box>
  );
};
