import { Grid, TextField } from '@mui/material';
import { memo, useEffect, useState, type FC } from 'react';
import { useTranslation } from 'react-i18next';
import i18n from '../../../../i18n';
import { Datepicker } from '../../../../shared/components/inputs/datepicker/Datepicker';
import { InvoiceType } from '../../../../shared/enums/invoiceType';
import { useForm } from '../../../../shared/hooks/form/useForm';
import { useGetNextSequence } from '../../../../shared/hooks/invoices/useGetNextSequence';
import type { InvoiceInfo, NextSequenceData } from '../../../../shared/types/invoice';
import type { Response } from '../../../../shared/types/response';
import { validators } from '../../../../shared/utils/validatorFunctions';
import { useAppDispatch, useAppSelector } from '../../../../state/configureStore';
import { addToast, selectSettings } from '../../../../state/pageSlice';
import { PageFormDrawer } from '../drawers/PageFormDrawer';
import { invoiceInfoFormValid, shouldAutoFillInvoiceNumber } from '../drawers/invoiceInfoModel';

interface Props {
  isOpen: boolean;
  information: InvoiceInfo;
  onClose?: () => void;
  onOpen?: () => void;
  onClick?: (data: InvoiceInfo) => void;
}

const InvoiceInformationDropdownComponent: FC<Props> = ({ isOpen, onClose, onOpen, onClick, information }) => {
  const { t } = useTranslation();
  const storeSettings = useAppSelector(selectSettings);
  const dispatch = useAppDispatch();

  const { form, setForm, update } = useForm<InvoiceInfo>({
    issuedAt: information?.issuedAt ?? new Date().toISOString(),
    invoiceNumber: information?.invoiceNumber ?? '',
    dueDate: information?.dueDate ?? '',
    invoicePrefix: information.id ? (information?.invoicePrefix ?? '') : (storeSettings?.invoicePrefix ?? ''),
    invoiceSuffix: information.id ? (information?.invoiceSuffix ?? '') : (storeSettings?.invoiceSuffix ?? '')
  });
  const [errors, setErrors] = useState({ issuedAt: false, invoiceNumber: false });

  const { execute: retrieveSequence } = useGetNextSequence({
    seqData: {
      businessId: information.businessId ?? -1,
      clientId: information.clientId ?? -1,
      invoiceType: information.invoiceType ?? InvoiceType.invoice
    },
    immediate: false,
    onDone: (data: Response<NextSequenceData | undefined>) => {
      if (!data.success) {
        if (data.message) {
          const message = i18n.exists(data.message) ? t(data.message) : data.message;
          dispatch(addToast({ message: message, severity: 'error' }));
        } else if (data.key) dispatch(addToast({ message: t(data.key), severity: 'error' }));
      }

      const nextSequence = data.data?.formattedSequence;

      if (shouldAutoFillInvoiceNumber(form.invoiceNumber, nextSequence)) {
        update('invoiceNumber', nextSequence);
        setErrors(current => ({ ...current, invoiceNumber: !validators.required(nextSequence) }));
      }
    }
  });

  useEffect(() => {
    if (form.invoiceNumber == undefined || form.invoiceNumber === '') {
      retrieveSequence();
    }

    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [information.businessId, information.clientId]);

  useEffect(() => {
    setForm({
      issuedAt: information?.issuedAt ?? new Date().toISOString(),
      invoiceNumber: information?.invoiceNumber ?? '',
      dueDate: information?.dueDate,
      invoicePrefix: information.id ? (information?.invoicePrefix ?? '') : (storeSettings?.invoicePrefix ?? ''),
      invoiceSuffix: information.id ? (information?.invoiceSuffix ?? '') : (storeSettings?.invoiceSuffix ?? '')
    });
  }, [information, setForm, storeSettings]);

  const validateField = (field: 'issuedAt' | 'invoiceNumber', value: string) => {
    setErrors(current => ({ ...current, [field]: !validators.required(value) }));
  };

  const isQuotation = information.invoiceType === InvoiceType.quotation;

  return (
    <PageFormDrawer
      isOpen={isOpen}
      onClose={onClose}
      onOpen={onOpen}
      title={isQuotation ? t('invoices.quoteInfo') : t('invoices.invoiceInfo')}
      formData={form}
      isFormValid={invoiceInfoFormValid(form, errors)}
      onSave={data => onClick?.(data as InvoiceInfo)}
      height="40%"
      mobileHeight="80%"
    >
      <Grid container spacing={2}>
        <Grid size={{ xs: 12, md: 4 }}>
          <TextField
            label={isQuotation ? t('common.quotePrefix') : t('common.invoicePrefix')}
            fullWidth
            value={form.invoicePrefix}
            onChange={event => update('invoicePrefix', event.target.value)}
          />
        </Grid>
        <Grid size={{ xs: 12, md: 4 }}>
          <TextField
            label={isQuotation ? t('common.quoteNumber') : t('common.invoiceNumber')}
            fullWidth
            required
            value={form.invoiceNumber}
            error={errors.invoiceNumber}
            helperText={errors.invoiceNumber ? t('common.fieldRequired') : ''}
            onChange={event => {
              update('invoiceNumber', event.target.value);
              validateField('invoiceNumber', event.target.value);
            }}
          />
        </Grid>
        <Grid size={{ xs: 12, md: 4 }}>
          <TextField
            label={isQuotation ? t('common.quoteSuffix') : t('common.invoiceSuffix')}
            fullWidth
            value={form.invoiceSuffix}
            onChange={event => update('invoiceSuffix', event.target.value)}
          />
        </Grid>

        {storeSettings && (
          <Grid size={{ xs: 12, md: 6 }}>
            <Datepicker
              label={`${t('common.issuedAt')}`}
              error={errors.issuedAt}
              required={true}
              value={form.issuedAt}
              format={storeSettings.dateFormat}
              onChange={value => {
                update('issuedAt', value);
                validateField('issuedAt', value ?? '');
              }}
            />
          </Grid>
        )}
        {storeSettings && (
          <Grid size={{ xs: 12, md: 6 }}>
            <Datepicker
              label={`${t('common.dueDate')}`}
              value={form.dueDate}
              format={storeSettings.dateFormat}
              onChange={value => update('dueDate', value)}
            />
          </Grid>
        )}
      </Grid>
    </PageFormDrawer>
  );
};

export const InvoiceInformationDropdown = memo(InvoiceInformationDropdownComponent);
