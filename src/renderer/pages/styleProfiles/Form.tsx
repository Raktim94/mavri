import { FormControlLabel, Grid, Switch, TextField } from '@mui/material';
import { useCallback, useEffect, useMemo, useState, type FC } from 'react';
import { useTranslation } from 'react-i18next';
import { CustomizationLayout } from '../../shared/components/layout/customizationLayout/CustomizationLayout';
import { FontFamily } from '../../shared/enums/fontFamily';
import { useForm } from '../../shared/hooks/useForm';
import type { CustomizationForm } from '../../shared/types/invoice';
import type { StyleProfile, StyleProfileFromData } from '../../shared/types/styleProfiles';
import { validators } from '../../shared/utils/validatorFunctions';
import { DEFAULT_TABLE_FIELD_SORT_ORDERS } from '../../state/constant';

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
    fontFamily: styleProfile?.fontFamily ?? FontFamily.roboto,
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
    isArchived: styleProfile?.isArchived ?? false,
    showQuantity: styleProfile?.showQuantity ?? true,
    showUnit: styleProfile?.showUnit ?? true,
    showRowNo: styleProfile?.showRowNo ?? true,
    fieldSortOrders: styleProfile?.fieldSortOrders ?? DEFAULT_TABLE_FIELD_SORT_ORDERS
  });

  const [errors, setErrors] = useState({
    name: false
  });

  const handleChangeStyleProfile = useCallback(
    (newData: CustomizationForm) => {
      setForm({
        color: newData?.color,
        logoSize: newData?.logoSize,
        fontSize: newData?.fontSize,
        fontFamily: newData?.fontFamily ?? FontFamily.roboto,
        layout: newData?.layout,
        tableHeaderStyle: newData?.tableHeaderStyle,
        tableRowStyle: newData?.tableRowStyle,
        pageFormat: newData?.pageFormat,
        labelUpperCase: newData?.labelUpperCase ?? false,
        watermarkFileName: newData?.watermarkFileName ?? undefined,
        watermarkFileType: newData?.watermarkFileType ?? undefined,
        watermarkFileSize: newData?.watermarkFileSize ?? undefined,
        watermarkFileData: newData?.watermarkFileData ?? undefined,
        paidWatermarkFileName: newData?.paidWatermarkFileName ?? undefined,
        paidWatermarkFileType: newData?.paidWatermarkFileType ?? undefined,
        paidWatermarkFileSize: newData?.paidWatermarkFileSize ?? undefined,
        paidWatermarkFileData: newData?.paidWatermarkFileData ?? undefined,
        id: styleProfile?.id,
        name: form?.name,
        isArchived: form?.isArchived,
        showQuantity: newData?.showQuantity ?? true,
        showUnit: newData?.showUnit ?? true,
        showRowNo: newData?.showRowNo ?? true,
        fieldSortOrders: newData?.fieldSortOrders ?? DEFAULT_TABLE_FIELD_SORT_ORDERS
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
      color: styleProfile?.color,
      logoSize: styleProfile?.logoSize,
      fontSize: styleProfile?.fontSize,
      fontFamily: styleProfile?.fontFamily ?? FontFamily.roboto,
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
      showQuantity: styleProfile?.showQuantity ?? true,
      showUnit: styleProfile?.showUnit ?? true,
      showRowNo: styleProfile?.showRowNo ?? true,
      fieldSortOrders: styleProfile?.fieldSortOrders ?? DEFAULT_TABLE_FIELD_SORT_ORDERS
    };
  }, [styleProfile]);

  useEffect(() => {
    setForm({
      id: styleProfile?.id,
      name: styleProfile?.name ?? '',
      color: styleProfile?.color,
      logoSize: styleProfile?.logoSize,
      fontSize: styleProfile?.fontSize,
      fontFamily: styleProfile?.fontFamily ?? FontFamily.roboto,
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
      isArchived: styleProfile?.isArchived ?? false,
      showQuantity: styleProfile?.showQuantity ?? true,
      showUnit: styleProfile?.showUnit ?? true,
      showRowNo: styleProfile?.showRowNo ?? true,
      fieldSortOrders: styleProfile?.fieldSortOrders ?? DEFAULT_TABLE_FIELD_SORT_ORDERS
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
          <>
            <Grid container spacing={2}>
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
              <Grid size={{ xs: 12, md: 12 }}>
                <FormControlLabel
                  control={<Switch checked={form.isArchived} onChange={e => update('isArchived', e.target.checked)} />}
                  label={t('common.archived')}
                />
              </Grid>
            </Grid>
          </>
        );
      }}
    />
  );
};
