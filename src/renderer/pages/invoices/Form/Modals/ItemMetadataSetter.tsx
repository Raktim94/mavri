import InfoOutlinedIcon from '@mui/icons-material/InfoOutlined';
import {
  Autocomplete,
  Box,
  Dialog,
  DialogContent,
  FormControl,
  FormControlLabel,
  FormLabel,
  Grid,
  Radio,
  RadioGroup,
  TextField,
  Tooltip
} from '@mui/material';
import { memo, useEffect, useState, type FC } from 'react';
import { useTranslation } from 'react-i18next';
import { AmountInput } from '../../../../shared/components/inputs/amountInput/AmountInput';
import { ModalAppBar } from '../../../../shared/components/layout/modalAppBar/ModalAppBar';
import { Alignment } from '../../../../shared/enums/alignment';
import type { InvoiceType } from '../../../../shared/enums/invoiceType';
import { useHeadersRetrieve } from '../../../../shared/hooks/invoices/useHeadersRetrieve';
import { useForm } from '../../../../shared/hooks/useForm';
import type { CustomField, ItemForm } from '../../../../shared/types/invoice';
import type { Response } from '../../../../shared/types/response';
import { validators } from '../../../../shared/utils/validatorFunctions';
import { useAppDispatch } from '../../../../state/configureStore';
import { addToast } from '../../../../state/pageSlice';

interface Props {
  isOpen: boolean;
  type: InvoiceType;
  headerOptions: string[];
  currQuantity?: string;
  customField?: CustomField;
  onCancel?: () => void;
  onSave?: (data: ItemForm) => void;
}
const ItemMetadataSetterComponent: FC<Props> = ({
  isOpen,
  type,
  headerOptions,
  currQuantity,
  customField,
  onCancel = () => {},
  onSave = () => {}
}) => {
  const { t } = useTranslation();
  const [isFormValid, setIsFormValid] = useState(true);
  const { form, setForm, update } = useForm<ItemForm>({
    quantity: Number(currQuantity ?? 0),
    header: customField?.header ?? '',
    value: customField?.value ?? '',
    alignment: customField?.alignment ?? Alignment.left
  });
  const [errors, setErrors] = useState({
    quantity: false,
    header: false,
    value: false
  });

  const dispatch = useAppDispatch();
  const [customHeaders, setCustomHeaders] = useState<string[]>([]);
  const { execute: retrieveHeaders } = useHeadersRetrieve({
    type: type,
    immediate: false,
    onDone: (data: Response<string[]>) => {
      if (!data.success) {
        if (data.message) dispatch(addToast({ message: data.message, severity: 'error' }));
        else if (data.key) dispatch(addToast({ message: t(data.key), severity: 'error' }));
      }

      const unique = [...new Set(headerOptions.concat(data.data ?? []))];

      setCustomHeaders(unique);
    }
  });

  const validateField = (field: keyof typeof errors, value: string) => {
    if (!validators.required(value) && field === 'quantity') {
      setErrors(e => ({ ...e, [field]: true }));
    } else {
      setErrors(e => ({ ...e, [field]: false }));
    }
  };

  useEffect(() => {
    if (isOpen) retrieveHeaders();
  }, [isOpen, retrieveHeaders]);

  useEffect(() => {
    const valid = (() => {
      if (form.quantity === undefined) return false;

      const header = form.header;
      const value = form.value;

      const bothEmpty = (header === undefined || header === '') && (value === undefined || value === '');

      const bothFilled =
        typeof header === 'string' && header.trim() !== '' && typeof value === 'string' && value.trim() !== '';

      return bothEmpty || bothFilled;
    })();

    setIsFormValid(valid);
  }, [form]);

  useEffect(() => {
    if (isOpen)
      setForm({
        quantity: Number(currQuantity ?? 0),
        header: customField?.header ?? '',
        value: customField?.value ?? '',
        alignment: customField?.alignment ?? Alignment.left
      });
  }, [currQuantity, customField, isOpen, setForm]);

  return (
    <Dialog open={isOpen} onClose={onCancel}>
      <ModalAppBar
        title={t('invoices.addItem')}
        description={t('common.fieldRequired')}
        isFormValid={isFormValid}
        formData={form}
        onClose={onCancel}
        onSave={data => {
          onSave(data as ItemForm);
          setErrors({
            quantity: false,
            header: false,
            value: false
          });
        }}
      />
      <DialogContent sx={{ minWidth: '300px' }}>
        <Grid container spacing={2}>
          <Grid size={{ xs: 12, md: 12 }}>
            <AmountInput
              required={true}
              label={t('invoices.quantity')}
              value={form.quantity}
              error={errors.quantity}
              helperText={errors.quantity ? t('common.fieldRequired') : ''}
              decimalScale={3}
              onChange={e => {
                update('quantity', e);
                validateField('quantity', e != undefined ? e.toString() : '');
              }}
            />
          </Grid>
          <Grid size={{ xs: 12, md: 6 }}>
            <Autocomplete
              freeSolo
              options={customHeaders}
              value={form.header}
              renderInput={params => (
                <TextField
                  {...params}
                  error={errors.header}
                  helperText={errors.quantity ? t('common.fieldRequired') : ''}
                  placeholder={t('invoices.customFieldHeaderPlaceholder')}
                  label={
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                      {t('invoices.customFieldHeader')}
                      <Tooltip title={t('invoices.customFieldHeaderTooltip')}>
                        <InfoOutlinedIcon fontSize="small" sx={{ color: 'action.active', cursor: 'pointer' }} />
                      </Tooltip>
                    </Box>
                  }
                  variant="outlined"
                />
              )}
              onChange={(_e, newValue) => {
                update('header', newValue ?? '');
                validateField('header', newValue ?? '');
              }}
            />
          </Grid>
          <Grid size={{ xs: 12, md: 6 }}>
            <TextField
              label={t('invoices.customFieldValue')}
              fullWidth
              value={form.value}
              error={errors.value}
              helperText={errors.value ? t('common.fieldRequired') : ''}
              onChange={e => {
                update('value', e.target.value);
                validateField('value', e.target.value);
              }}
            />
          </Grid>
          <Grid size={{ xs: 12, md: 6 }}>
            <FormControl component="fieldset">
              <FormLabel component="legend">{t('invoices.customFieldAlignment')}</FormLabel>
              <RadioGroup
                row
                value={form.alignment ?? ''}
                onChange={(_e, newValue) => {
                  update('alignment', newValue as Alignment);
                }}
              >
                <FormControlLabel value={Alignment.left} control={<Radio />} label={Alignment.left} />
                <FormControlLabel value={Alignment.center} control={<Radio />} label={Alignment.center} />
                <FormControlLabel value={Alignment.right} control={<Radio />} label={Alignment.right} />
              </RadioGroup>
            </FormControl>
          </Grid>
        </Grid>
      </DialogContent>
    </Dialog>
  );
};
export const ItemMetadataSetter = memo(ItemMetadataSetterComponent);
