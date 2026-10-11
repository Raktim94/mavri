import { Autocomplete, Grid, TextField } from '@mui/material';
import { memo, useEffect, useState, type FC } from 'react';
import { useTranslation } from 'react-i18next';
import { AmountInput } from '../../../../shared/components/inputs/amountInput/AmountInput';
import { DiscountType } from '../../../../shared/enums/discountType';
import { useForm } from '../../../../shared/hooks/form/useForm';
import type { DiscountForm } from '../../../../shared/types/invoice';
import { validators } from '../../../../shared/utils/validatorFunctions';
import { useAppSelector } from '../../../../state/configureStore';
import { selectSettings } from '../../../../state/pageSlice';
import { PageFormDrawer } from '../drawers/PageFormDrawer';
import { rateChoiceIndex, rateChoices, rateFormValid } from '../drawers/rateDrawerModel';

interface Props {
  isOpen: boolean;
  onClose?: () => void;
  onOpen?: () => void;
  onClick?: (data: DiscountForm) => void;
  data?: DiscountForm;
}

const emptyForm = (data?: DiscountForm): DiscountForm => ({
  discountType: data?.discountType,
  discountAmount: data?.discountAmount ?? 0,
  discountRate: data?.discountRate ?? 0,
  discountName: data?.discountName ?? ''
});

const DiscountDropdownComponent: FC<Props> = ({ isOpen, data, onClose, onOpen, onClick }) => {
  const { t } = useTranslation();
  const storeSettings = useAppSelector(selectSettings);
  const choices = rateChoices(t);

  const { form, setForm, update } = useForm<DiscountForm>(emptyForm(data));
  const [errors, setErrors] = useState({ discountAmount: false, discountRate: false });

  useEffect(() => {
    if (isOpen) {
      setForm(emptyForm(data));
      setErrors({ discountAmount: false, discountRate: false });
    }
  }, [isOpen, data, setForm]);

  const validateField = (field: 'discountAmount' | 'discountRate', value: string) => {
    setErrors(current => ({ ...current, [field]: !validators.required(value) }));
  };

  const isFormValid = rateFormValid({
    type: form.discountType,
    amount: form.discountAmount,
    rate: form.discountRate
  });

  return (
    <PageFormDrawer
      isOpen={isOpen}
      onClose={onClose}
      onOpen={onOpen}
      title={t('invoices.addDiscount')}
      formData={form}
      isFormValid={isFormValid}
      onSave={payload => onClick?.(payload as DiscountForm)}
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
            value={choices[rateChoiceIndex(choices, form.discountType)]}
            onChange={(_event, selected) => {
              update('discountType', selected.value);
              update('discountAmount', 0);
              update('discountRate', 0);
              update('discountName', '');
              setErrors({ discountAmount: false, discountRate: false });
            }}
            renderInput={params => <TextField {...params} label={t('invoices.type')} required />}
            freeSolo={false}
          />
        </Grid>
        {form.discountType === DiscountType.fixed && (
          <Grid size={{ xs: 12, md: 12 }}>
            <AmountInput
              required={true}
              amountFormat={storeSettings?.amountFormat}
              label={t('invoices.fixed')}
              value={form.discountAmount}
              error={errors.discountAmount}
              helperText={errors.discountAmount ? t('common.fieldRequired') : ''}
              onChange={value => {
                update('discountAmount', value);
                validateField('discountAmount', (value ?? '').toString());
              }}
            />
          </Grid>
        )}
        {form.discountType === DiscountType.percentage && (
          <Grid size={{ xs: 12, md: 12 }}>
            <AmountInput
              required={true}
              max={100}
              label={t('invoices.percentage')}
              value={form.discountRate}
              error={errors.discountRate}
              helperText={errors.discountRate ? t('common.fieldRequired') : ''}
              onChange={value => {
                update('discountRate', value);
                validateField('discountRate', (value ?? '').toString());
              }}
            />
          </Grid>
        )}
        {(form.discountType === DiscountType.fixed || form.discountType === DiscountType.percentage) && (
          <Grid size={{ xs: 12, md: 12 }}>
            <TextField
              label={t('common.name')}
              fullWidth
              value={form.discountName}
              onChange={event => update('discountName', event.target.value)}
            />
          </Grid>
        )}
      </Grid>
    </PageFormDrawer>
  );
};

export const DiscountDropdown = memo(DiscountDropdownComponent);
