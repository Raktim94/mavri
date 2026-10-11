import { Box, FormControlLabel, Grid, Switch, TextField, Typography } from '@mui/material';
import { useEffect, useRef, useState, type FC } from 'react';
import { useTranslation } from 'react-i18next';
import { UploadImage } from '../../shared/components/inputs/uploadImage/UploadImage';
import { useForm } from '../../shared/hooks/form/useForm';
import { useFormDirtyCheck } from '../../shared/hooks/form/useFormDirtyCheck';
import type { Bank, BankFromData } from '../../shared/types/bank';
import { toDataUrl, toUint8Array } from '../../shared/utils/dataUrlFunctions';
import {
  applyBankFieldEvaluation,
  createBankDraft,
  createBankFieldErrors,
  isBankDraftReady,
  type BankFieldErrors,
  type BankValidationField
} from './banksModel';

interface Props {
  bank?: Bank;
  handleChange?: (data: { bank: BankFromData; isFormValid: boolean; description?: string }) => void;
}

export const Form: FC<Props> = ({ bank, handleChange = () => {} }) => {
  const { t } = useTranslation();
  const baselineRef = useRef<BankFromData | undefined>(undefined);
  const { form, setForm, update } = useForm<BankFromData>(createBankDraft(bank));
  const [errors, setErrors] = useState<BankFieldErrors>(createBankFieldErrors);
  const [qrImageUrl, setQrImageUrl] = useState<string | undefined>(undefined);

  useFormDirtyCheck(form, baselineRef);

  const syncField = (field: BankValidationField, value: string) => {
    update(field, value);
    setErrors(prev => applyBankFieldEvaluation(prev, field, value));
  };

  const handleQrUpload = async (file?: Blob, filename?: string) => {
    if (file) {
      const bytes = await toUint8Array(t, file);
      if (bytes)
        setForm(prev => ({
          ...prev,
          qrCode: bytes,
          qrCodeFileSize: file.size,
          qrCodeFileType: file.type,
          qrCodeFileName: filename
        }));
    } else {
      setForm(prev => ({
        ...prev,
        qrCode: undefined,
        qrCodeFileSize: undefined,
        qrCodeFileType: undefined,
        qrCodeFileName: undefined
      }));
    }
  };

  useEffect(() => {
    const next = createBankDraft(bank);
    baselineRef.current = next;
    setForm(next);
    void (async () => {
      const url = bank && bank.qrCode ? await toDataUrl(bank.qrCode, bank.qrCodeFileType) : undefined;
      setQrImageUrl(url);
    })();
  }, [bank, setForm]);

  useEffect(() => {
    handleChange({
      bank: form,
      isFormValid: isBankDraftReady(form, errors),
      description: t('common.invalidForm')
    });
  }, [form, errors, handleChange, t]);

  return (
    <Grid container spacing={2}>
      <Grid size={{ xs: 12, md: 6 }}>
        <TextField
          label={t('common.name')}
          fullWidth
          required
          value={form.name}
          error={errors.name}
          helperText={errors.name ? t('common.fieldRequired') : ''}
          onChange={e => syncField('name', e.target.value)}
        />
      </Grid>
      <Grid size={{ xs: 12, md: 6 }}>
        <TextField
          label={t('common.accountHolder')}
          fullWidth
          value={form.accountHolder}
          onChange={e => update('accountHolder', e.target.value)}
        />
      </Grid>
      <Grid size={{ xs: 12, md: 6 }}>
        <TextField
          label={t('common.bankName')}
          fullWidth
          value={form.bankName}
          onChange={e => update('bankName', e.target.value)}
        />
      </Grid>
      <Grid size={{ xs: 12, md: 6 }}>
        <TextField
          label={t('common.type')}
          fullWidth
          value={form.type}
          onChange={e => update('type', e.target.value)}
        />
      </Grid>
      <Grid size={{ xs: 12, md: 6 }}>
        <TextField
          label={t('common.accountNumber')}
          fullWidth
          value={form.accountNumber}
          error={errors.accountNumber}
          helperText={errors.accountNumber ? t('common.accountNumberInvalid') : ''}
          onChange={e => syncField('accountNumber', e.target.value)}
        />
      </Grid>
      <Grid size={{ xs: 12, md: 6 }}>
        <TextField
          label={t('common.swiftCode')}
          fullWidth
          value={form.swiftCode}
          error={errors.swiftCode}
          helperText={errors.swiftCode ? t('common.swiftCodeInvalid') : ''}
          onChange={e => syncField('swiftCode', e.target.value)}
        />
      </Grid>
      <Grid size={{ xs: 12, md: 6 }}>
        <TextField
          label={t('common.sortOrder')}
          fullWidth
          value={form.sortOrder}
          error={errors.sortOrder}
          helperText={errors.sortOrder ? t('common.sortCodeInvalid') : ''}
          onChange={e => syncField('sortOrder', e.target.value)}
        />
      </Grid>
      <Grid size={{ xs: 12, md: 6 }}>
        <TextField
          label={t('common.address')}
          fullWidth
          value={form.address}
          onChange={e => update('address', e.target.value)}
        />
      </Grid>
      <Grid size={{ xs: 12, md: 6 }}>
        <TextField
          label={t('common.branchCode')}
          fullWidth
          value={form.branchCode}
          error={errors.branchCode}
          helperText={errors.branchCode ? t('common.branchCodeInvalid') : ''}
          onChange={e => syncField('branchCode', e.target.value)}
        />
      </Grid>
      <Grid size={{ xs: 12, md: 6 }}>
        <TextField
          label={t('common.routingNumber')}
          fullWidth
          value={form.routingNumber}
          error={errors.routingNumber}
          helperText={errors.routingNumber ? t('common.routingNumberInvalid') : ''}
          onChange={e => syncField('routingNumber', e.target.value)}
        />
      </Grid>
      <Grid size={{ xs: 12, md: 6 }}>
        <TextField
          label={t('common.upiCode')}
          fullWidth
          value={form.upiCode}
          error={errors.upiCode}
          helperText={errors.upiCode ? t('common.upiCodeInvalid') : ''}
          onChange={e => syncField('upiCode', e.target.value)}
        />
      </Grid>
      <Grid size={{ xs: 12, md: 6 }}>
        <Typography
          component="legend"
          variant="body1"
          sx={{ fontWeight: 400, color: 'text.secondary', marginBottom: 1 }}
        >
          {t('common.qrCode')}
        </Typography>
        <Box
          sx={{
            display: 'flex',
            flexDirection: 'row',
            justifyContent: 'start',
            alignItems: 'start',
            width: '100%',
            gap: 1
          }}
        >
          <UploadImage onUpload={handleQrUpload} imgUrl={qrImageUrl} size={100} />
        </Box>
      </Grid>
      <Grid size={{ xs: 12, md: 12 }}>
        <FormControlLabel
          control={<Switch checked={form.isArchived} onChange={e => update('isArchived', e.target.checked)} />}
          label={t('common.archived')}
        />
      </Grid>
    </Grid>
  );
};
