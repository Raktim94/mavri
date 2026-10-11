import { FormControlLabel, Grid, Switch, TextField } from '@mui/material';
import { useEffect, useRef, useState, type FC } from 'react';
import { useTranslation } from 'react-i18next';
import { useForm } from '../../shared/hooks/form/useForm';
import { useFormDirtyCheck } from '../../shared/hooks/form/useFormDirtyCheck';
import type { Client, ClientFromData } from '../../shared/types/client';
import { useAppSelector } from '../../state/configureStore';
import { selectSettings } from '../../state/pageSlice';
import {
  applyClientFieldEvaluation,
  buyerReferenceHelperText,
  createClientDraft,
  createClientFieldErrors,
  isClientDraftReady,
  type ClientFieldErrors,
  type ClientValidationField
} from './clientModel';

interface Props {
  client?: Client;
  handleChange?: (data: { client: ClientFromData; isFormValid: boolean; description?: string }) => void;
}

export const Form: FC<Props> = ({ client, handleChange = () => {} }) => {
  const { t } = useTranslation();
  const baselineRef = useRef<ClientFromData | undefined>(undefined);
  const settings = useAppSelector(selectSettings);
  const { form, setForm, update } = useForm<ClientFromData>(createClientDraft(client));
  const [errors, setErrors] = useState<ClientFieldErrors>(createClientFieldErrors);

  useFormDirtyCheck(form, baselineRef);

  const syncField = (field: ClientValidationField, value: string) => {
    update(field, value);
    setErrors(prev => applyClientFieldEvaluation(prev, field, value));
  };

  useEffect(() => {
    const next = createClientDraft(client);
    baselineRef.current = next;
    setForm(next);
  }, [client, setForm]);

  useEffect(() => {
    handleChange({
      client: form,
      isFormValid: isClientDraftReady(form, errors),
      description: t('common.invalidForm')
    });
  }, [form, errors, handleChange, t]);

  const eInvoiceOn = Boolean(settings?.ublON || settings?.xrechnungON);

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
          label={t('common.shortName')}
          fullWidth
          required
          value={form.shortName}
          error={errors.shortName}
          helperText={errors.shortName ? t('common.fieldRequired') : t('common.shortNameHelper')}
          onChange={e => syncField('shortName', e.target.value)}
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
          helperText={t('common.addressHelper')}
          onChange={e => update('address', e.target.value)}
        />
      </Grid>
      <Grid size={{ xs: 12, md: 6 }}>
        <TextField
          label={t('common.code')}
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
          error={errors.email}
          helperText={errors.email ? t('common.invalidEmail') : ''}
          onChange={e => syncField('email', e.target.value)}
        />
      </Grid>
      <Grid size={{ xs: 12, md: 6 }}>
        <TextField
          label={t('common.phone')}
          fullWidth
          value={form.phone}
          error={errors.phone}
          helperText={errors.phone ? t('common.invalidPhone') : t('common.phoneHelper')}
          onChange={e => syncField('phone', e.target.value)}
          slotProps={{
            htmlInput: {
              maxLength: 20
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
      {eInvoiceOn && (
        <Grid size={{ xs: 12, md: 6 }}>
          <TextField
            label={t('common.peppolEndpointId')}
            fullWidth
            value={form.peppolEndpointId}
            error={errors.peppolEndpointId}
            helperText={
              errors.peppolEndpointId ? t('common.invalidPeppolEndpointId') : t('common.peppolEndpointIdHelper')
            }
            onChange={e => syncField('peppolEndpointId', e.target.value)}
          />
        </Grid>
      )}
      {eInvoiceOn && (
        <Grid size={{ xs: 12, md: 6 }}>
          <TextField
            label={t('common.peppolEndpointSchemeId')}
            fullWidth
            value={form.peppolEndpointSchemeId}
            error={errors.peppolEndpointSchemeId}
            helperText={
              errors.peppolEndpointSchemeId
                ? t('common.invalidPeppolEndpointSchemeId')
                : t('common.peppolEndpointSchemeIdHelper')
            }
            onChange={e => syncField('peppolEndpointSchemeId', e.target.value)}
          />
        </Grid>
      )}
      {eInvoiceOn && (
        <Grid size={{ xs: 12, md: 6 }}>
          <TextField
            label={t('common.buyerReference')}
            fullWidth
            value={form.buyerReference}
            helperText={buyerReferenceHelperText({
              translate: t,
              ublOn: Boolean(settings?.ublON),
              xrechnungOn: Boolean(settings?.xrechnungON)
            })}
            slotProps={{ formHelperText: { style: { whiteSpace: 'pre-line' } } }}
            onChange={e => update('buyerReference', e.target.value)}
          />
        </Grid>
      )}
      <Grid size={{ xs: 12, md: 6 }}>
        <TextField
          label={t('common.countryCode')}
          fullWidth
          value={form.countryCode}
          error={errors.countryCode}
          helperText={errors.countryCode ? t('common.invalidCountryCode') : t('common.countryCodeHelper')}
          onChange={e => syncField('countryCode', e.target.value)}
          slotProps={{
            htmlInput: {
              maxLength: 2
            }
          }}
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
