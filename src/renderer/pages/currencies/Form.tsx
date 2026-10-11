import { Autocomplete, FormControlLabel, Grid, Switch, TextField } from '@mui/material';
import { useEffect, useRef, useState, type FC } from 'react';
import { useTranslation } from 'react-i18next';
import { useForm } from '../../shared/hooks/form/useForm';
import { useFormDirtyCheck } from '../../shared/hooks/form/useFormDirtyCheck';
import type { Currency, CurrencyFromData } from '../../shared/types/currency';
import { getFormattedLabel } from '../../shared/utils/formatFunctions';
import { CURRENCY_FORMAT_ITEMS_ARRAY } from '../../state/constant';
import {
  applyCurrencyFieldEvaluation,
  createCurrencyDraft,
  createCurrencyFieldErrors,
  hasCurrencyFormat,
  isCurrencyDraftReady,
  isCurrencyFormatLocked,
  type CurrencyFieldErrors,
  type CurrencyValidationField
} from './currencyModel';

interface Props {
  currency?: Currency;
  handleChange?: (data: { currency: CurrencyFromData; isFormValid: boolean; description?: string }) => void;
}

export const Form: FC<Props> = ({ currency, handleChange = () => {} }) => {
  const { t } = useTranslation();
  const baselineRef = useRef<CurrencyFromData | undefined>(undefined);
  const { form, setForm, update } = useForm<CurrencyFromData>(createCurrencyDraft(currency));
  const [errors, setErrors] = useState<CurrencyFieldErrors>(createCurrencyFieldErrors);

  useFormDirtyCheck(form, baselineRef);

  const syncField = (field: CurrencyValidationField, value: string) => {
    update(field, value);
    setErrors(prev => applyCurrencyFieldEvaluation(prev, field, value));
  };

  useEffect(() => {
    const next = createCurrencyDraft(currency);
    baselineRef.current = next;
    setForm(next);
  }, [currency, setForm]);

  useEffect(() => {
    handleChange({
      currency: form,
      isFormValid: isCurrencyDraftReady(form),
      description: t('common.invalidForm')
    });
  }, [form, errors, handleChange, t]);

  const formatPreview = (label: string) => getFormattedLabel({ label, symbol: form.symbol, code: form.code });

  return (
    <Grid container spacing={2}>
      <Grid size={{ xs: 12, md: 4 }}>
        <TextField
          label={t('currencies.code')}
          fullWidth
          required
          value={form.code}
          error={errors.code}
          helperText={errors.code ? t('common.fieldRequired') : ''}
          onChange={e => syncField('code', e.target.value)}
        />
      </Grid>
      <Grid size={{ xs: 12, md: 4 }}>
        <TextField
          label={t('currencies.symbol')}
          fullWidth
          required
          value={form.symbol}
          error={errors.symbol}
          helperText={errors.symbol ? t('common.fieldRequired') : ''}
          onChange={e => syncField('symbol', e.target.value)}
        />
      </Grid>
      <Grid size={{ xs: 12, md: 4 }}>
        <Autocomplete
          fullWidth
          disabled={isCurrencyFormatLocked(form)}
          options={CURRENCY_FORMAT_ITEMS_ARRAY}
          getOptionLabel={option => formatPreview(option.label)}
          disableClearable={hasCurrencyFormat(form)}
          value={CURRENCY_FORMAT_ITEMS_ARRAY.find(opt => opt.value === form.format) ?? null}
          onChange={(_e, selected) => {
            if (!selected) return;
            syncField('format', selected.value);
          }}
          renderOption={(props, option) => (
            <li {...props} key={option.value}>
              {formatPreview(option.label)}
            </li>
          )}
          renderInput={params => (
            <TextField
              {...params}
              error={errors.format}
              helperText={errors.format ? t('common.fieldRequired') : ''}
              label={t('currencies.format')}
              required
            />
          )}
          freeSolo={false}
        />
      </Grid>
      <Grid size={{ xs: 12, md: 4 }}>
        <TextField
          label={t('currencies.subunit')}
          fullWidth
          required
          type="number"
          value={form.subunit}
          error={errors.subunit}
          helperText={errors.subunit ? t('common.fieldRequired') : ''}
          onChange={e => {
            update('subunit', Number(e.target.value));
            setErrors(prev => applyCurrencyFieldEvaluation(prev, 'subunit', e.target.value));
          }}
        />
      </Grid>
      <Grid size={{ xs: 12, md: 12 }}>
        <TextField
          label={t('common.text')}
          fullWidth
          required
          value={form.text}
          error={errors.text}
          helperText={errors.text ? t('common.fieldRequired') : ''}
          onChange={e => syncField('text', e.target.value)}
        />
      </Grid>
      <Grid size={{ xs: 12, md: 12 }}>
        <FormControlLabel
          control={<Switch checked={form.isArchived} onChange={e => update('isArchived', e.target.checked)} />}
          label={t('common.archived')}
        />
      </Grid>
    </Grid>
  );
};
