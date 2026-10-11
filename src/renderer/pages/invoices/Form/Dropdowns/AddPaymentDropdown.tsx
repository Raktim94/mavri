import { Autocomplete, Grid, TextField } from '@mui/material';
import { memo, useEffect, useState, type FC } from 'react';
import { useTranslation } from 'react-i18next';
import { AmountInput } from '../../../../shared/components/inputs/amountInput/AmountInput';
import { Datepicker } from '../../../../shared/components/inputs/datepicker/Datepicker';
import { useForm } from '../../../../shared/hooks/form/useForm';
import type { PaymentForm } from '../../../../shared/types/invoice';
import { validators } from '../../../../shared/utils/validatorFunctions';
import { useAppSelector } from '../../../../state/configureStore';
import { selectSettings } from '../../../../state/pageSlice';
import { PageFormDrawer } from '../drawers/PageFormDrawer';
import { emptyPaymentForm, paymentChoices, paymentFormValid } from '../drawers/paymentDrawerModel';

interface Props {
  isOpen: boolean;
  onClose?: () => void;
  onOpen?: () => void;
  onClick?: (data: PaymentForm) => void;
  data?: PaymentForm;
}

const AddPaymentDropdownComponent: FC<Props> = ({ isOpen, data, onClose, onOpen, onClick }) => {
  const { t } = useTranslation();
  const storeSettings = useAppSelector(selectSettings);
  const choices = paymentChoices(t);

  const { form, setForm, update } = useForm<PaymentForm>(emptyPaymentForm(data));
  const [errors, setErrors] = useState({ paidAmount: false, paidAt: false, paymentMethod: false });

  useEffect(() => {
    if (isOpen) {
      setForm(emptyPaymentForm(data));
      setErrors({ paidAmount: false, paidAt: false, paymentMethod: false });
    }
  }, [isOpen, data, setForm]);

  const validateField = (field: 'paidAmount' | 'paidAt' | 'paymentMethod', value: string) => {
    setErrors(current => ({ ...current, [field]: !validators.required(value) }));
  };

  const isFormValid = paymentFormValid(form);

  return (
    <PageFormDrawer
      isOpen={isOpen}
      onClose={onClose}
      onOpen={onOpen}
      title={t('invoices.addPayment')}
      formData={form}
      isFormValid={isFormValid}
      onSave={payload => onClick?.(payload as PaymentForm)}
      height="30%"
    >
      <Grid container spacing={2}>
        {storeSettings && (
          <Grid size={{ xs: 12, md: 6 }}>
            <Autocomplete
              fullWidth
              options={choices}
              getOptionLabel={option => option.label}
              disableClearable={true}
              value={choices.find(choice => choice.value === form.paymentMethod) ?? choices[0]}
              onChange={(_event, selected) => {
                update('paymentMethod', selected.value);
                validateField('paymentMethod', selected.value.toString());
              }}
              renderInput={params => <TextField {...params} label={t('invoices.type')} required />}
              freeSolo={false}
            />
          </Grid>
        )}
        {storeSettings && (
          <Grid size={{ xs: 12, md: 6 }}>
            <AmountInput
              required={true}
              amountFormat={storeSettings?.amountFormat}
              label={t('common.amount')}
              value={form.paidAmount}
              error={errors.paidAmount}
              helperText={errors.paidAmount ? t('common.fieldRequired') : ''}
              onChange={value => {
                update('paidAmount', value);
                validateField('paidAmount', (value ?? '').toString());
              }}
            />
          </Grid>
        )}
        {storeSettings && (
          <Grid size={{ xs: 12, md: 12 }}>
            <Datepicker
              label={`${t('invoices.paidAt')}`}
              error={errors.paidAt}
              required={true}
              value={form.paidAt}
              format={storeSettings.dateFormat}
              onChange={value => {
                update('paidAt', value);
                validateField('paidAt', value ?? '');
              }}
            />
          </Grid>
        )}
        <Grid size={{ xs: 12, md: 12 }}>
          <TextField
            label={t('invoices.notes')}
            fullWidth
            value={form.notes}
            onChange={event => update('notes', event.target.value)}
          />
        </Grid>
      </Grid>
    </PageFormDrawer>
  );
};

export const AddPaymentDropdown = memo(AddPaymentDropdownComponent);
