import { FormControlLabel, Grid, Switch, TextField } from '@mui/material';
import { useEffect, useRef, useState, type FC } from 'react';
import { useTranslation } from 'react-i18next';
import { useForm } from '../../shared/hooks/form/useForm';
import { useFormDirtyCheck } from '../../shared/hooks/form/useFormDirtyCheck';
import type { Unit, UnitFromData } from '../../shared/types/unit';
import { validators } from '../../shared/utils/validatorFunctions';

interface Props {
  unit?: Unit;
  handleChange?: (data: { unit: UnitFromData; isFormValid: boolean; description?: string }) => void;
}

const createDraft = (unit?: Unit): UnitFromData => ({
  id: unit?.id,
  name: unit?.name ?? '',
  isArchived: unit?.isArchived ?? false
});

export const Form: FC<Props> = ({ unit, handleChange = () => {} }) => {
  const { t } = useTranslation();
  const baselineRef = useRef<UnitFromData | undefined>(undefined);
  const { form, setForm, update } = useForm<UnitFromData>(createDraft(unit));
  const [nameError, setNameError] = useState(false);

  useFormDirtyCheck(form, baselineRef);

  const syncName = (value: string) => {
    update('name', value);
    setNameError(!validators.required(value));
  };

  useEffect(() => {
    const next = createDraft(unit);
    baselineRef.current = next;
    setForm(next);
  }, [unit, setForm]);

  useEffect(() => {
    handleChange({
      unit: form,
      isFormValid: form.name.trim() !== '' && !nameError,
      description: t('common.invalidForm')
    });
  }, [form, nameError, handleChange, t]);

  return (
    <Grid container spacing={2}>
      <Grid size={{ xs: 12, md: 12 }}>
        <TextField
          label={t('common.name')}
          fullWidth
          required
          value={form.name}
          error={nameError}
          helperText={nameError ? t('common.fieldRequired') : ''}
          onChange={e => syncName(e.target.value)}
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
