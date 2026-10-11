import InfoOutlinedIcon from '@mui/icons-material/InfoOutlined';
import {
  Autocomplete,
  Box,
  Dialog,
  DialogContent,
  FormControl,
  FormControlLabel,
  FormHelperText,
  FormLabel,
  Grid,
  Radio,
  RadioGroup,
  TextField,
  Tooltip
} from '@mui/material';
import { memo, useEffect, useState, type FC } from 'react';
import { useTranslation } from 'react-i18next';
import i18n from '../../../../i18n';
import { AmountInput } from '../../../../shared/components/inputs/amountInput/AmountInput';
import { ModalAppBar } from '../../../../shared/components/layout/modalAppBar/ModalAppBar';
import { Alignment } from '../../../../shared/enums/alignment';
import type { InvoiceType } from '../../../../shared/enums/invoiceType';
import { useForm } from '../../../../shared/hooks/form/useForm';
import { useHeadersRetrieve } from '../../../../shared/hooks/invoices/useHeadersRetrieve';
import type { CustomField, CustomFieldMeta, ItemForm } from '../../../../shared/types/invoice';
import type { Response } from '../../../../shared/types/response';
import { validators } from '../../../../shared/utils/validatorFunctions';
import { useAppDispatch, useAppSelector } from '../../../../state/configureStore';
import { addToast, selectSettings } from '../../../../state/pageSlice';
import {
  initialItemForm,
  itemFormValid,
  mergeHeaderOptions,
  metadataErrors,
  metadataPresent,
  toggleAlignment,
  type TouchedFields
} from './itemMetadataModel';

interface Props {
  isOpen: boolean;
  type: InvoiceType;
  headerOptions: CustomFieldMeta[];
  currQuantity?: string;
  currUnitPrice?: number;
  customField?: CustomField;
  onCancel?: () => void;
  onSave?: (data: ItemForm) => void;
}

const EMPTY_TOUCHED: TouchedFields = { header: false, sortOrder: false, value: false, alignment: false };
const EMPTY_ERRORS = {
  quantity: false,
  unitPrice: false,
  header: false,
  sortOrder: false,
  value: false,
  alignment: false
};

const ItemMetadataSetterComponent: FC<Props> = ({
  isOpen,
  type,
  headerOptions,
  currQuantity,
  currUnitPrice,
  customField,
  onCancel = () => {},
  onSave = () => {}
}) => {
  const { t } = useTranslation();
  const storeSettings = useAppSelector(selectSettings);
  const dispatch = useAppDispatch();

  const { form, setForm, update } = useForm<ItemForm>(initialItemForm({ currQuantity, currUnitPrice, customField }));
  const [errors, setErrors] = useState(EMPTY_ERRORS);
  const [touched, setTouched] = useState<TouchedFields>(EMPTY_TOUCHED);
  const [customHeaders, setCustomHeaders] = useState<CustomFieldMeta[]>([]);

  const { execute: retrieveHeaders } = useHeadersRetrieve({
    type: type,
    immediate: false,
    onDone: (data: Response<CustomFieldMeta[]>) => {
      if (!data.success) {
        if (data.message) {
          const message = i18n.exists(data.message) ? t(data.message) : data.message;
          dispatch(addToast({ message: message, severity: 'error' }));
        } else if (data.key) dispatch(addToast({ message: t(data.key), severity: 'error' }));
      }

      setCustomHeaders(mergeHeaderOptions(headerOptions, data.data ?? []));
    }
  });

  const present = metadataPresent(form);

  const validateRequired = (value: string) => !validators.required(value);

  useEffect(() => {
    if (isOpen) retrieveHeaders();
  }, [isOpen, retrieveHeaders]);

  useEffect(() => {
    if (isOpen) {
      setForm(initialItemForm({ currQuantity, currUnitPrice, customField }));
    }
  }, [currQuantity, currUnitPrice, customField, isOpen, setForm]);

  useEffect(() => {
    if (isOpen) {
      setTouched(EMPTY_TOUCHED);
      setErrors(current => ({ ...current, header: false, value: false, sortOrder: false, alignment: false }));
    }
  }, [isOpen]);

  useEffect(() => {
    const next = metadataErrors({ form, touched });
    setErrors(current => ({ ...current, ...next }));
  }, [form, touched]);

  const isFormValid = itemFormValid(form);

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
          setErrors(EMPTY_ERRORS);
        }}
      />
      <DialogContent sx={{ minWidth: '300px' }}>
        <Grid container spacing={2}>
          <Grid size={{ xs: 12, md: 6 }}>
            <AmountInput
              required={true}
              label={t('invoices.quantity')}
              value={form.quantity}
              error={errors.quantity}
              helperText={errors.quantity ? t('common.fieldRequired') : ''}
              decimalScale={3}
              onChange={value => {
                update('quantity', value);
                setErrors(current => ({
                  ...current,
                  quantity: validateRequired(value != undefined ? value.toString() : '')
                }));
              }}
            />
          </Grid>
          {storeSettings && (
            <Grid size={{ xs: 12, md: 6 }}>
              <AmountInput
                required={true}
                amountFormat={storeSettings?.amountFormat}
                label={t('common.amount')}
                value={form.unitPrice}
                error={errors.unitPrice}
                helperText={errors.unitPrice ? t('common.fieldRequired') : ''}
                onChange={value => {
                  update('unitPrice', value);
                  setErrors(current => ({ ...current, unitPrice: validateRequired((value ?? '').toString()) }));
                }}
              />
            </Grid>
          )}
          <Grid size={{ xs: 12, md: 6 }}>
            <Autocomplete
              freeSolo
              options={customHeaders.map(entry => entry.header)}
              value={form.header ?? ''}
              renderInput={params => (
                <TextField
                  {...params}
                  error={errors.header}
                  helperText={errors.header ? t('common.fieldRequired') : ''}
                  placeholder={t('invoices.customFieldHeaderPlaceholder')}
                  label={
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                      {t('invoices.customFieldHeader')}
                      {present && ' *'}
                      <Tooltip title={t('invoices.customFieldHeaderTooltip')}>
                        <InfoOutlinedIcon fontSize="small" sx={{ color: 'action.active', cursor: 'pointer' }} />
                      </Tooltip>
                    </Box>
                  }
                  variant="outlined"
                />
              )}
              onChange={(_event, newValue) => {
                update('header', newValue ?? '');
                setTouched(current => ({ ...current, header: true }));

                const specific = customHeaders.find(entry => entry.header === newValue);
                if (specific) {
                  update('sortOrder', specific.sortOrder);
                  update('alignment', specific.alignment);
                  setTouched(current => ({ ...current, alignment: true, sortOrder: true }));
                }
              }}
            />
          </Grid>
          <Grid size={{ xs: 12, md: 6 }}>
            <TextField
              label={t('invoices.customFieldValue')}
              fullWidth
              value={form.value ?? ''}
              error={errors.value}
              helperText={errors.value ? t('common.fieldRequired') : ''}
              required={present}
              onChange={event => {
                update('value', event.target.value);
                setTouched(current => ({ ...current, value: true }));
              }}
            />
          </Grid>
          <Grid size={{ xs: 12, md: 6 }}>
            <AmountInput
              required={present}
              label={t('invoices.sortOrder')}
              value={form.sortOrder}
              error={errors.sortOrder}
              helperText={errors.sortOrder ? t('common.fieldRequired') : ''}
              onChange={value => {
                update('sortOrder', value);
                setTouched(current => ({ ...current, sortOrder: true }));
              }}
            />
          </Grid>
          <Grid size={{ xs: 12, md: 6 }}>
            <FormControl component="fieldset" error={errors.alignment}>
              <FormLabel component="legend" required={present}>
                {t('invoices.customFieldAlignment')}
              </FormLabel>
              <RadioGroup
                row
                value={form.alignment ?? ''}
                onChange={(_event, newValue) => {
                  update('alignment', form.alignment === newValue ? undefined : (newValue as Alignment));
                  setTouched(current => ({ ...current, alignment: true }));
                }}
              >
                {[Alignment.left, Alignment.center, Alignment.right].map(alignment => (
                  <FormControlLabel
                    key={alignment}
                    onClick={event => {
                      event.preventDefault();
                      update('alignment', toggleAlignment(form.alignment, alignment));
                      setTouched(current => ({ ...current, alignment: true }));
                    }}
                    value={alignment}
                    control={<Radio />}
                    label={alignment}
                  />
                ))}
              </RadioGroup>
              <FormHelperText>{errors.alignment ? t('common.fieldRequired') : ''}</FormHelperText>
            </FormControl>
          </Grid>
        </Grid>
      </DialogContent>
    </Dialog>
  );
};

export const ItemMetadataSetter = memo(ItemMetadataSetterComponent);
