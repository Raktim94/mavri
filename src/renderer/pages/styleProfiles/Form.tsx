import { FormControlLabel, Grid, Switch, TextField } from '@mui/material';
import { useCallback, useEffect, useMemo, useState, type FC } from 'react';
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
    color: styleProfile?.color,
    logoSize: styleProfile?.logoSize,
    fontSize: styleProfile?.fontSize,
    layout: styleProfile?.layout,
    tableHeaderStyle: styleProfile?.tableHeaderStyle,
    tableRowStyle: styleProfile?.tableRowStyle,
    pageFormat: styleProfile?.pageFormat,
    labelUpperCase: styleProfile?.labelUpperCase ?? false,
    watermarkFileName: styleProfile?.watermarkFileName ?? undefined,
    watermarkFileType: styleProfile?.watermarkFileType ?? undefined,
    watermarkFileSize: styleProfile?.watermarkFileSize ?? undefined,
    watermarkFileData: styleProfile?.watermarkFileData ?? undefined,
    paidWatermarkFileName: styleProfile?.paidWatermarkFileName ?? undefined,
    paidWatermarkFileType: styleProfile?.paidWatermarkFileType ?? undefined,
    paidWatermarkFileSize: styleProfile?.paidWatermarkFileSize ?? undefined,
    paidWatermarkFileData: styleProfile?.paidWatermarkFileData ?? undefined,
    isArchived: styleProfile?.isArchived ?? false
  });

  const [errors, setErrors] = useState({
    name: false
  });

  const handleChangeStyleProfile = useCallback(
    (newData: CustomizationForm) => {
      setForm({
        color: newData?.customizationColor,
        logoSize: newData?.customizationLogoSize,
        fontSize: newData?.customizationFontSizeSize,
        layout: newData?.customizationLayout,
        tableHeaderStyle: newData?.customizationTableHeaderStyle,
        tableRowStyle: newData?.customizationTableRowStyle,
        pageFormat: newData?.customizationPageFormat,
        labelUpperCase: newData?.customizationLabelUpperCase ?? false,
        watermarkFileName: newData?.customizationWatermarkFileName ?? undefined,
        watermarkFileType: newData?.customizationWatermarkFileType ?? undefined,
        watermarkFileSize: newData?.customizationWatermarkFileSize ?? undefined,
        watermarkFileData: newData?.customizationWatermarkFileData ?? undefined,
        paidWatermarkFileName: newData?.customizationPaidWatermarkFileName ?? undefined,
        paidWatermarkFileType: newData?.customizationPaidWatermarkFileType ?? undefined,
        paidWatermarkFileSize: newData?.customizationPaidWatermarkFileSize ?? undefined,
        paidWatermarkFileData: newData?.customizationPaidWatermarkFileData ?? undefined,
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

  const customizationData = useMemo(() => {
    return {
      customizationColor: styleProfile?.color,
      customizationLogoSize: styleProfile?.logoSize,
      customizationFontSizeSize: styleProfile?.fontSize,
      customizationLayout: styleProfile?.layout,
      customizationTableHeaderStyle: styleProfile?.tableHeaderStyle,
      customizationTableRowStyle: styleProfile?.tableRowStyle,
      customizationPageFormat: styleProfile?.pageFormat,
      customizationLabelUpperCase: styleProfile?.labelUpperCase ?? false,
      customizationWatermarkFileName: styleProfile?.watermarkFileName ?? undefined,
      customizationWatermarkFileType: styleProfile?.watermarkFileType ?? undefined,
      customizationWatermarkFileSize: styleProfile?.watermarkFileSize ?? undefined,
      customizationWatermarkFileData: styleProfile?.watermarkFileData ?? undefined,
      customizationPaidWatermarkFileName: styleProfile?.paidWatermarkFileName ?? undefined,
      customizationPaidWatermarkFileType: styleProfile?.paidWatermarkFileType ?? undefined,
      customizationPaidWatermarkFileSize: styleProfile?.paidWatermarkFileSize ?? undefined,
      customizationPaidWatermarkFileData: styleProfile?.paidWatermarkFileData ?? undefined
    };
  }, [styleProfile]);

  useEffect(() => {
    setForm({
      id: styleProfile?.id,
      name: styleProfile?.name ?? '',
      color: styleProfile?.color,
      logoSize: styleProfile?.logoSize,
      fontSize: styleProfile?.fontSize,
      layout: styleProfile?.layout,
      tableHeaderStyle: styleProfile?.tableHeaderStyle,
      tableRowStyle: styleProfile?.tableRowStyle,
      pageFormat: styleProfile?.pageFormat,
      labelUpperCase: styleProfile?.labelUpperCase ?? false,
      watermarkFileName: styleProfile?.watermarkFileName ?? undefined,
      watermarkFileType: styleProfile?.watermarkFileType ?? undefined,
      watermarkFileSize: styleProfile?.watermarkFileSize ?? undefined,
      watermarkFileData: styleProfile?.watermarkFileData ?? undefined,
      paidWatermarkFileName: styleProfile?.paidWatermarkFileName ?? undefined,
      paidWatermarkFileType: styleProfile?.paidWatermarkFileType ?? undefined,
      paidWatermarkFileSize: styleProfile?.paidWatermarkFileSize ?? undefined,
      paidWatermarkFileData: styleProfile?.paidWatermarkFileData ?? undefined,
      isArchived: styleProfile?.isArchived ?? false
    });
  }, [styleProfile, setForm]);

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
      data={customizationData}
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
