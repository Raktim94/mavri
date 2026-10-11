import { Autocomplete, FormControlLabel, Grid, Switch, TextField } from '@mui/material';
import { useEffect, useRef, useState, type FC } from 'react';
import { useTranslation } from 'react-i18next';
import i18n from '../../i18n';
import { AmountInput } from '../../shared/components/inputs/amountInput/AmountInput';
import { useCategoriesRetrieve } from '../../shared/hooks/categories/useCategoriesRetrieve';
import { useForm } from '../../shared/hooks/form/useForm';
import { useFormDirtyCheck } from '../../shared/hooks/form/useFormDirtyCheck';
import { useUnitsRetrieve } from '../../shared/hooks/units/useUnitsRetrieve';
import type { Item, ItemFromData } from '../../shared/types/item';
import type { Response } from '../../shared/types/response';
import { useAppDispatch, useAppSelector } from '../../state/configureStore';
import { addToast, selectCategoriesOptions, selectSettings, selectUnitsOptions } from '../../state/pageSlice';
import {
  applyItemFieldEvaluation,
  createItemDraft,
  createItemFieldErrors,
  isItemDraftReady,
  type ItemFieldErrors,
  type ItemValidationField
} from './itemsModel';

interface Props {
  item?: Item;
  handleChange?: (data: { item: ItemFromData; isFormValid: boolean; description?: string }) => void;
}

export const Form: FC<Props> = ({ item, handleChange = () => {} }) => {
  const { t } = useTranslation();
  const dispatch = useAppDispatch();
  const baselineRef = useRef<ItemFromData | undefined>(undefined);
  const settings = useAppSelector(selectSettings);
  const unitsOptions = useAppSelector(selectUnitsOptions);
  const categoriesOptions = useAppSelector(selectCategoriesOptions);

  const toastFailure = (data: Response<unknown>) => {
    if (data.success) return;
    if (data.message) {
      const message = i18n.exists(data.message) ? t(data.message) : data.message;
      dispatch(addToast({ message, severity: 'error' }));
    } else if (data.key) {
      dispatch(addToast({ message: t(data.key), severity: 'error' }));
    }
  };

  useUnitsRetrieve({ onDone: toastFailure });
  useCategoriesRetrieve({ onDone: toastFailure });

  const { form, setForm, update } = useForm<ItemFromData>(createItemDraft(item));
  const [errors, setErrors] = useState<ItemFieldErrors>(createItemFieldErrors);

  useFormDirtyCheck(form, baselineRef);

  const syncField = (field: ItemValidationField, value: string) => {
    update(field, value);
    setErrors(prev => applyItemFieldEvaluation(prev, field, value));
  };

  useEffect(() => {
    const next = createItemDraft(item);
    baselineRef.current = next;
    setForm(next);
  }, [item, setForm]);

  useEffect(() => {
    handleChange({
      item: form,
      isFormValid: isItemDraftReady(form),
      description: t('common.invalidForm')
    });
  }, [form, errors, handleChange, t]);

  return (
    <Grid container spacing={2}>
      <Grid size={{ xs: 12, md: 6 }}>
        <TextField
          label={t('common.name')}
          fullWidth
          required
          value={form.name}
          error={errors.name}
          helperText={errors.name ? t('common.fieldRequired') : ''}
          onChange={e => syncField('name', e.target.value)}
        />
      </Grid>
      <Grid size={{ xs: 12, md: 6 }}>
        <TextField
          label={t('common.description')}
          fullWidth
          value={form.description}
          onChange={e => update('description', e.target.value)}
        />
      </Grid>
      <Grid size={{ xs: 12, md: 6 }}>
        <AmountInput
          required={true}
          label={t('common.amount')}
          value={form.amount !== undefined ? Number(form.amount) : undefined}
          amountFormat={settings?.amountFormat}
          error={errors.amount}
          helperText={errors.amount ? t('common.fieldRequired') : ''}
          onChange={value => {
            const next = value !== undefined ? value.toString() : '';
            update('amount', next);
            setErrors(prev => applyItemFieldEvaluation(prev, 'amount', next));
          }}
        />
      </Grid>
      <Grid size={{ xs: 12, md: 6 }}>
        <Autocomplete
          fullWidth
          options={unitsOptions}
          disableClearable={false}
          value={unitsOptions.find(opt => opt.value === form.unitId) ?? null}
          onChange={(_e, selected) => {
            update('unitId', selected?.value);
          }}
          renderInput={params => <TextField {...params} label={t('common.unit')} />}
          freeSolo={false}
        />
      </Grid>
      <Grid size={{ xs: 12, md: 6 }}>
        <Autocomplete
          fullWidth
          options={categoriesOptions}
          disableClearable={false}
          value={categoriesOptions.find(opt => opt.value === form.categoryId) ?? null}
          onChange={(_e, selected) => {
            update('categoryId', selected?.value);
          }}
          renderInput={params => <TextField {...params} label={t('common.category')} />}
          freeSolo={false}
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
