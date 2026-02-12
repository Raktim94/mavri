import { FormControlLabel, Grid, Switch, TextField } from '@mui/material';
import { useEffect, useState, type FC } from 'react';
import { useTranslation } from 'react-i18next';
import { useForm } from '../../shared/hooks/useForm';
import type { Client, ClientFromData } from '../../shared/types/client';
import { validators } from '../../shared/utils/validatorFunctions';

interface Props {
  client?: Client;
  handleChange?: (data: { client: ClientFromData; isFormValid: boolean; description?: string }) => void;
}
export const Form: FC<Props> = ({ handleChange = () => {}, client }) => {
  const { t } = useTranslation();
  const { form, setForm, update } = useForm<ClientFromData>({
    id: client?.id,
    email: client?.email ?? '',
    phone: client?.phone ?? '',
    name: client?.name ?? '',
    shortName: client?.shortName ?? '',
    code: client?.code ?? '',
    address: client?.address ?? '',
    vatCode: client?.vatCode ?? '',
    additional: client?.additional ?? '',
    description: client?.description ?? '',
    isArchived: client?.isArchived ?? false
  });
  const [errors, setErrors] = useState({
    email: false,
    phone: false,
    name: false,
    shortName: false
  });

  const validateField = (field: keyof typeof errors, value: string) => {
    if (!validators.required(value) && (field === 'name' || field === 'shortName')) {
      setErrors(e => ({ ...e, [field]: true }));
    } else if (field === 'email') {
      setErrors(e => ({ ...e, email: value !== '' && !validators.email(value) }));
    } else if (field === 'phone') {
      setErrors(e => ({ ...e, phone: value !== '' && !validators.phone(value) }));
    } else {
      setErrors(e => ({ ...e, [field]: false }));
    }
  };

  useEffect(() => {
    setForm({
      id: client?.id,
      email: client?.email ?? '',
      phone: client?.phone ?? '',
      name: client?.name ?? '',
      shortName: client?.shortName ?? '',
      code: client?.code ?? '',
      address: client?.address ?? '',
      vatCode: client?.vatCode ?? '',
      additional: client?.additional ?? '',
      description: client?.description ?? '',
      isArchived: client?.isArchived ?? false
    });
  }, [client, setForm]);

  useEffect(() => {
    const valid =
      form.name.trim() !== '' &&
      form.shortName.trim() !== '' &&
      !errors.email &&
      !errors.phone &&
      !errors.name &&
      !errors.shortName;

    handleChange({
      client: form,
      isFormValid: valid,
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
          onChange={e => {
            update('name', e.target.value);
            validateField('name', e.target.value);
          }}
        />
      </Grid>
      <Grid size={{ xs: 12, md: 6 }}>
        <TextField
          label={t('common.shortName')}
          fullWidth
          required
          value={form.shortName}
          error={errors.shortName}
          helperText={errors.shortName ? t('common.fieldRequired') : t('common.shortNameHelper')}
          onChange={e => {
            update('shortName', e.target.value);
            validateField('shortName', e.target.value);
          }}
          slotProps={{
            htmlInput: {
              maxLength: 2
            }
          }}
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
          label={t('clients.code')}
          fullWidth
          value={form.code}
          onChange={e => update('code', e.target.value)}
        />
      </Grid>
      <Grid size={{ xs: 12, md: 6 }}>
        <TextField
          type="email"
          label={t('common.email')}
          fullWidth
          value={form.email}
          onChange={e => {
            update('email', e.target.value);
            validateField('email', e.target.value);
          }}
          error={errors.email}
          helperText={errors.email ? t('common.invalidEmail') : ''}
        />
      </Grid>
      <Grid size={{ xs: 12, md: 6 }}>
        <TextField
          label={t('common.phone')}
          fullWidth
          value={form.phone}
          onChange={e => {
            update('phone', e.target.value);
            validateField('phone', e.target.value);
          }}
          error={errors.phone}
          helperText={errors.phone ? t('common.invalidPhone') : t('common.phoneHelper')}
          slotProps={{
            htmlInput: {
              maxLength: 16
            }
          }}
        />
      </Grid>
      <Grid size={{ xs: 12, md: 6 }}>
        <TextField
          label={t('common.description')}
          fullWidth
          value={form.description}
          onChange={e => update('description', e.target.value)}
        />
      </Grid>
      <Grid size={{ xs: 12, md: 6 }}>
        <TextField
          label={t('common.vatCode')}
          fullWidth
          rows={5}
          value={form.vatCode}
          onChange={e => update('vatCode', e.target.value)}
        />
      </Grid>
      <Grid size={{ xs: 12, md: 12 }}>
        <TextField
          multiline
          label={t('common.additional')}
          fullWidth
          rows={5}
          value={form.additional}
          onChange={e => update('additional', e.target.value)}
        />
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
