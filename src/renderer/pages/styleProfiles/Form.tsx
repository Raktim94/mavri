import { FormControlLabel, Grid, Switch, TextField } from '@mui/material';
import { useCallback, useEffect, useMemo, useRef, useState, type FC } from 'react';
import { useTranslation } from 'react-i18next';
import { CustomizationLayout } from '../../shared/components/layout/customizationLayout/CustomizationLayout';
import { useForm } from '../../shared/hooks/form/useForm';
import { useFormDirtyCheck } from '../../shared/hooks/form/useFormDirtyCheck';
import type { CustomizationForm } from '../../shared/types/invoice';
import type { StyleProfile, StyleProfileFromData } from '../../shared/types/styleProfiles';
import { useAppSelector } from '../../state/configureStore';
import { selectSettings } from '../../state/pageSlice';
import {
  applyCustomizationToDraft,
  applyStyleProfileFieldEvaluation,
  createStyleProfileDraft,
  createStyleProfileFieldErrors,
  isStyleProfileDraftReady,
  toCustomizationPreview,
  type StyleProfileFieldErrors
} from './styleProfileModel';

interface Props {
  styleProfile?: StyleProfile;
  handleChange?: (data: { styleProfile: StyleProfileFromData; isFormValid: boolean; description?: string }) => void;
}

export const Form: FC<Props> = ({ styleProfile, handleChange = () => {} }) => {
  const { t } = useTranslation();
  const baselineRef = useRef<StyleProfileFromData | undefined>(undefined);
  const storeSettings = useAppSelector(selectSettings);
  const { form, setForm, update } = useForm<StyleProfileFromData>(createStyleProfileDraft(styleProfile));
  const [errors, setErrors] = useState<StyleProfileFieldErrors>(createStyleProfileFieldErrors);

  useFormDirtyCheck(form, baselineRef);

  const onCustomizationChange = useCallback(
    (changes: CustomizationForm) => {
      setForm(applyCustomizationToDraft(form, changes, styleProfile?.id));
    },
    [form, setForm, styleProfile]
  );

  const syncName = (value: string) => {
    update('name', value);
    setErrors(prev => applyStyleProfileFieldEvaluation(prev, value));
  };

  const preview = useMemo(() => toCustomizationPreview(form), [form]);

  useEffect(() => {
    const next = createStyleProfileDraft(styleProfile);
    baselineRef.current = next;
    setForm(next);
  }, [styleProfile, setForm]);

  useEffect(() => {
    if (!form) return;

    handleChange({
      styleProfile: form,
      isFormValid: isStyleProfileDraftReady(form, errors),
      description: t('common.invalidForm')
    });
  }, [form, errors, handleChange, t]);

  return (
    <CustomizationLayout
      language={storeSettings?.language}
      data={preview}
      onChange={onCustomizationChange}
      renderCustomTop={() => (
        <Grid container spacing={2}>
          <Grid size={{ xs: 12, md: 12 }}>
            <TextField
              label={t('common.name')}
              fullWidth
              required
              value={form.name}
              error={errors.name}
              helperText={errors.name ? t('common.fieldRequired') : ''}
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
      )}
    />
  );
};
