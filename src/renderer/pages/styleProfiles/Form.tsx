import { FormControlLabel, Grid, Switch, TextField } from '@mui/material';
import { useCallback, useEffect, useState, type FC } from 'react';
import { useTranslation } from 'react-i18next';
import { CustomizationLayout } from '../../shared/components/layout/customizationLayout/CustomizationLayout';
import { useForm } from '../../shared/hooks/useForm';
import type { CustomizationForm } from '../../shared/types/invoice';
import type { StyleProfile, StyleProfileFromData } from '../../shared/types/styleProfiles';
import { validators } from '../../shared/utils/validatorFunctions';

interface Props {
  styleProfile?: StyleProfile;
  handleChange?: (data: { styleProfile: StyleProfileFromData; isFormValid: boolean; description?: string }) => void;
}
export const Form: FC<Props> = ({ handleChange = () => {}, styleProfile }) => {
  const { t } = useTranslation();
  const { form, setForm, update } = useForm<StyleProfileFromData>({
    id: styleProfile?.id,
    name: styleProfile?.name ?? '',
    customizationColor: styleProfile?.customizationColor,
    customizationLogoSize: styleProfile?.customizationLogoSize,
    customizationFontSizeSize: styleProfile?.customizationFontSizeSize,
    customizationLayout: styleProfile?.customizationLayout,
    customizationTableHeaderStyle: styleProfile?.customizationTableHeaderStyle,
    customizationTableRowStyle: styleProfile?.customizationTableRowStyle,
    customizationPageFormat: styleProfile?.customizationPageFormat,
    customizationLabelUpperCase: styleProfile?.customizationLabelUpperCase ?? false,
    customizationWatermarkFileName: styleProfile?.customizationWatermarkFileName ?? undefined,
    customizationWatermarkFileType: styleProfile?.customizationWatermarkFileType ?? undefined,
    customizationWatermarkFileSize: styleProfile?.customizationWatermarkFileSize ?? undefined,
    customizationWatermarkFileData: styleProfile?.customizationWatermarkFileData ?? undefined,
    customizationPaidWatermarkFileName: styleProfile?.customizationPaidWatermarkFileName ?? undefined,
    customizationPaidWatermarkFileType: styleProfile?.customizationPaidWatermarkFileType ?? undefined,
    customizationPaidWatermarkFileSize: styleProfile?.customizationPaidWatermarkFileSize ?? undefined,
    customizationPaidWatermarkFileData: styleProfile?.customizationPaidWatermarkFileData ?? undefined,
    isArchived: styleProfile?.isArchived ?? false
  });

  const [errors, setErrors] = useState({
    name: false
  });

  const handleChangeStyleProfile = useCallback(
    (newData: CustomizationForm) => {
      setForm({
        ...newData,
        customizationLabelUpperCase: newData?.customizationLabelUpperCase ?? false,
        id: styleProfile?.id,
        name: form?.name,
        isArchived: form?.isArchived
      });
    },
    [setForm, form, styleProfile]
  );

  const validateField = (field: keyof typeof errors, value: string) => {
    if (!validators.required(value) && field === 'name') {
      setErrors(e => ({ ...e, [field]: true }));
    } else {
      setErrors(e => ({ ...e, [field]: false }));
    }
  };

  useEffect(() => {
    if (!form) return;

    const valid = form.name.trim() !== '' && !errors.name;

    handleChange({
      styleProfile: form,
      isFormValid: valid,
      description: t('common.invalidForm')
    });
  }, [form, errors, handleChange, t]);

  return (
    <CustomizationLayout
      data={styleProfile}
      onChange={handleChangeStyleProfile}
      renderCustomTop={() => {
        return (
          <Grid size={{ xs: 12, md: 12 }}>
            <TextField
              label={t('common.name')}
              fullWidth
              required
              value={form.name}
              error={errors.name}
              helperText={errors.name ? t('common.fieldRequired') : ''}
              onChange={e => {
                update('name', e.target.value);
                validateField('name', e.target.value);
              }}
            />
          </Grid>
        );
      }}
      renderCustomBottom={() => {
        return (
          <Grid size={{ xs: 12, md: 12 }}>
            <FormControlLabel
              control={<Switch checked={form.isArchived} onChange={e => update('isArchived', e.target.checked)} />}
              label={t('common.archived')}
            />
          </Grid>
        );
      }}
    />
  );
};
