import { Autocomplete, Grid, TextField } from '@mui/material';
import { memo, useEffect, useState, type FC } from 'react';
import { useTranslation } from 'react-i18next';
import { AmountInput } from '../../../../shared/components/inputs/amountInput/AmountInput';
import { DiscountType } from '../../../../shared/enums/discountType';
import { useForm } from '../../../../shared/hooks/form/useForm';
import type { SurchargeForm } from '../../../../shared/types/invoice';
import { validators } from '../../../../shared/utils/validatorFunctions';
import { useAppSelector } from '../../../../state/configureStore';
import { selectSettings } from '../../../../state/pageSlice';
import { PageFormDrawer } from '../drawers/PageFormDrawer';
import { rateChoiceIndex, rateChoices, rateFormValid } from '../drawers/rateDrawerModel';

interface Props {
  isOpen: boolean;
  onClose?: () => void;
  onOpen?: () => void;
  onClick?: (data: SurchargeForm) => void;
  data?: SurchargeForm;
}

const emptyForm = (data?: SurchargeForm): SurchargeForm => ({
  surchargeAmount: data?.surchargeAmount ?? 0,
  surchargeName: data?.surchargeName ?? '',
  surchargeType: data?.surchargeType,
  surchargeRate: data?.surchargeRate ?? 0
});

const SurchargeDropdownComponent: FC<Props> = ({ isOpen, data, onClose, onOpen, onClick }) => {
  const { t } = useTranslation();
  const storeSettings = useAppSelector(selectSettings);
  const choices = rateChoices(t);

  const { form, setForm, update } = useForm<SurchargeForm>(emptyForm(data));
  const [errors, setErrors] = useState({ surchargeAmount: false, surchargeRate: false });

  useEffect(() => {
    if (isOpen) {
      setForm(emptyForm(data));
      setErrors({ surchargeAmount: false, surchargeRate: false });
    }
  }, [isOpen, data, setForm]);

  const validateField = (field: 'surchargeAmount' | 'surchargeRate', value: string) => {
    setErrors(current => ({ ...current, [field]: !validators.required(value) }));
  };

  const isFormValid = rateFormValid({
    type: form.surchargeType,
    amount: form.surchargeAmount,
    rate: form.surchargeRate
  });

  return (
    <PageFormDrawer
      isOpen={isOpen}
      onClose={onClose}
      onOpen={onOpen}
      title={t('invoices.addSurcharge')}
      formData={form}
      isFormValid={isFormValid}
      onSave={payload => onClick?.(payload as SurchargeForm)}
      height="30%"
      mobileHeight="50%"
    >
      <Grid container spacing={2}>
        <Grid size={{ xs: 12, md: 12 }}>
          <Autocomplete
            fullWidth
            options={choices}
            getOptionLabel={option => option.label}
            disableClearable={true}
            value={choices[rateChoiceIndex(choices, form.surchargeType)]}
            onChange={(_event, selected) => {
              update('surchargeType', selected.value);
              update('surchargeAmount', 0);
              update('surchargeRate', 0);
              update('surchargeName', '');
              setErrors({ surchargeAmount: false, surchargeRate: false });
            }}
            renderInput={params => <TextField {...params} label={t('invoices.type')} required />}
            freeSolo={false}
          />
        </Grid>
        {form.surchargeType === DiscountType.fixed && (
          <Grid size={{ xs: 12, md: 12 }}>
            <AmountInput
              required={true}
              amountFormat={storeSettings?.amountFormat}
              label={t('invoices.fixed')}
              value={form.surchargeAmount}
              error={errors.surchargeAmount}
              helperText={errors.surchargeAmount ? t('common.fieldRequired') : ''}
              onChange={value => {
                update('surchargeAmount', value);
                validateField('surchargeAmount', (value ?? '').toString());
              }}
            />
          </Grid>
        )}
        {form.surchargeType === DiscountType.percentage && (
          <Grid size={{ xs: 12, md: 12 }}>
            <AmountInput
              required={true}
              max={100}
              label={t('invoices.percentage')}
              value={form.surchargeRate}
              error={errors.surchargeRate}
              helperText={errors.surchargeRate ? t('common.fieldRequired') : ''}
              onChange={value => {
                update('surchargeRate', value);
                validateField('surchargeRate', (value ?? '').toString());
              }}
            />
          </Grid>
        )}
        {(form.surchargeType === DiscountType.fixed || form.surchargeType === DiscountType.percentage) && (
          <Grid size={{ xs: 12, md: 12 }}>
            <TextField
              label={t('common.name')}
              fullWidth
              value={form.surchargeName}
              onChange={event => update('surchargeName', event.target.value)}
            />
          </Grid>
        )}
      </Grid>
    </PageFormDrawer>
  );
};

export const SurchargeDropdown = memo(SurchargeDropdownComponent);
