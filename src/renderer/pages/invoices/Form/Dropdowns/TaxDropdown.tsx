import { Autocomplete, Box, FormControlLabel, Grid, Switch, TextField, Typography } from '@mui/material';
import { memo, useEffect, useState, type FC } from 'react';
import { useTranslation } from 'react-i18next';
import { AmountInput } from '../../../../shared/components/inputs/amountInput/AmountInput';
import { InvoiceTaxOptionType } from '../../../../shared/enums/invoiceTaxOptionType';
import { InvoiceTaxType } from '../../../../shared/enums/taxType';
import { useForm } from '../../../../shared/hooks/form/useForm';
import type { TaxForm } from '../../../../shared/types/invoice';
import { validators } from '../../../../shared/utils/validatorFunctions';
import { PageFormDrawer } from '../drawers/PageFormDrawer';
import {
  clearedItemRates,
  itemsInclusive,
  taxChoices,
  taxFormValid,
  taxOptionFrom,
  taxTypeForOption,
  withItemRate,
  withItemsInclusiveness
} from '../drawers/taxDrawerModel';

interface Props {
  isOpen: boolean;
  onClose?: () => void;
  onOpen?: () => void;
  onClick?: (data: TaxForm) => void;
  data?: TaxForm;
}

const emptyForm = (): TaxForm => ({
  taxType: undefined,
  taxRate: 0,
  taxName: '',
  invoiceItems: []
});

const TaxDropdownComponent: FC<Props> = ({ isOpen, data, onClose, onOpen, onClick }) => {
  const { t } = useTranslation();
  const choices = taxChoices(t);

  const [selectedOption, setSelectedOption] = useState<InvoiceTaxOptionType | undefined>(undefined);
  const { form, setForm, update } = useForm<TaxForm>(emptyForm());
  const [errors, setErrors] = useState({ taxRate: false });

  useEffect(() => {
    if (isOpen) {
      setForm({
        taxType: data?.taxType,
        taxRate: data?.taxRate ?? 0,
        taxName: data?.taxName ?? '',
        invoiceItems: data?.invoiceItems ?? []
      });
      setErrors({ taxRate: false });
      setSelectedOption(taxOptionFrom(data));
    }
  }, [isOpen, data, setForm]);

  const validateField = (value: string) => setErrors({ taxRate: !validators.required(value) });

  const isFormValid = taxFormValid(form);

  return (
    <PageFormDrawer
      isOpen={isOpen}
      onClose={onClose}
      onOpen={onOpen}
      title={t('invoices.addTaxes')}
      formData={form}
      isFormValid={isFormValid}
      onSave={payload => onClick?.(payload as TaxForm)}
      height="50%"
    >
      <Grid container spacing={2}>
        <Grid size={{ xs: 12, md: 12 }}>
          <Autocomplete
            fullWidth
            options={choices}
            getOptionLabel={option => option.label}
            disableClearable={true}
            value={choices.find(choice => choice.value === selectedOption) ?? choices[0]}
            onChange={(_event, selected) => {
              update('taxType', taxTypeForOption(selected.value));
              setSelectedOption(selected.value);
              update('taxRate', 0);
              update('taxName', '');
              setErrors({ taxRate: false });
              setForm(prev => ({ ...prev, invoiceItems: clearedItemRates(prev.invoiceItems) }));
            }}
            renderInput={params => <TextField {...params} label={t('invoices.type')} required />}
            freeSolo={false}
          />
        </Grid>
        {form.taxType && (
          <Grid size={{ xs: 12, md: 12 }}>
            <AmountInput
              required={true}
              max={100}
              label={t('invoices.percentage')}
              value={form.taxRate}
              decimalScale={3}
              error={errors.taxRate}
              helperText={errors.taxRate ? t('common.fieldRequired') : ''}
              onChange={value => {
                update('taxRate', value);
                validateField((value ?? '').toString());
              }}
            />
          </Grid>
        )}
        <Grid size={{ xs: 12, md: 12 }}>
          <TextField
            label={t('common.name')}
            fullWidth
            value={form.taxName}
            onChange={event => update('taxName', event.target.value)}
          />
        </Grid>
        {(form.taxType === InvoiceTaxType.exclusive || form.taxType === InvoiceTaxType.inclusive) && (
          <Grid size={{ xs: 12, md: 12 }}>
            <FormControlLabel
              control={
                <Switch
                  checked={form.taxType === InvoiceTaxType.inclusive}
                  onChange={event => {
                    update('taxType', event.target.checked ? InvoiceTaxType.inclusive : InvoiceTaxType.exclusive);
                  }}
                />
              }
              label={t('invoices.inclusive')}
            />
          </Grid>
        )}
        {selectedOption === InvoiceTaxOptionType.perItem && (
          <Grid size={{ xs: 12, md: 12 }}>
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
              {form.invoiceItems.map((invoiceItem, index) => (
                <Box
                  key={`invoice-item-${invoiceItem.itemId}-${index}`}
                  sx={{ display: 'flex', flexDirection: 'row', alignItems: 'center' }}
                >
                  <Typography
                    component="div"
                    variant="body2"
                    sx={{
                      fontWeight: 500,
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      display: 'flex',
                      justifyContent: 'start',
                      flexDirection: 'row'
                    }}
                  >
                    {invoiceItem.invoiceItemSnapshot.itemName}
                  </Typography>
                  <Box sx={{ flexGrow: 1 }} />
                  <Box sx={{ width: '20%' }}>
                    <AmountInput
                      required={false}
                      max={100}
                      decimalScale={3}
                      label={'%'}
                      value={invoiceItem.taxRate}
                      onChange={value => {
                        setForm(prev => ({
                          ...prev,
                          invoiceItems: withItemRate(prev.invoiceItems, index, value, itemsInclusive(form.invoiceItems))
                        }));
                      }}
                    />
                  </Box>
                </Box>
              ))}
              <FormControlLabel
                control={
                  <Switch
                    checked={itemsInclusive(form.invoiceItems)}
                    onChange={event => {
                      setForm(prev => ({
                        ...prev,
                        invoiceItems: withItemsInclusiveness(prev.invoiceItems, event.target.checked)
                      }));
                    }}
                  />
                }
                label={t('invoices.inclusive')}
              />
            </Box>
          </Grid>
        )}
      </Grid>
    </PageFormDrawer>
  );
};

export const TaxDropdown = memo(TaxDropdownComponent);
