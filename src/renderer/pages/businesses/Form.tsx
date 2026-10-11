import InfoOutlinedIcon from '@mui/icons-material/InfoOutlined';
import { Box, FormControlLabel, Grid, Switch, TextField, Tooltip } from '@mui/material';
import { useEffect, useRef, useState, type FC } from 'react';
import { useTranslation } from 'react-i18next';
import { UploadImage } from '../../shared/components/inputs/uploadImage/UploadImage';
import { useForm } from '../../shared/hooks/form/useForm';
import { useFormDirtyCheck } from '../../shared/hooks/form/useFormDirtyCheck';
import type { Business, BusinessFromData } from '../../shared/types/business';
import { toDataUrl, toUint8Array } from '../../shared/utils/dataUrlFunctions';
import { useAppSelector } from '../../state/configureStore';
import { selectSettings } from '../../state/pageSlice';
import {
  applyBusinessFieldEvaluation,
  createBusinessDraft,
  createBusinessFieldErrors,
  isBusinessDraftReady,
  type BusinessFieldErrors,
  type BusinessValidationField
} from './businessModel';

interface Props {
  business?: Business;
  handleChange?: (data: { business: BusinessFromData; isFormValid: boolean; description?: string }) => void;
}

export const Form: FC<Props> = ({ business, handleChange = () => {} }) => {
  const { t } = useTranslation();
  const baselineRef = useRef<BusinessFromData | undefined>(undefined);
  const settings = useAppSelector(selectSettings);
  const { form, setForm, update } = useForm<BusinessFromData>(createBusinessDraft(business));
  const [errors, setErrors] = useState<BusinessFieldErrors>(createBusinessFieldErrors);
  const [logoImageUrl, setLogoImageUrl] = useState<string | undefined>(undefined);

  useFormDirtyCheck(form, baselineRef);

  const syncField = (field: BusinessValidationField, value: string) => {
    update(field, value);
    setErrors(prev => applyBusinessFieldEvaluation(prev, field, value));
  };

  const handleLogoUpload = async (file?: Blob, filename?: string) => {
    if (file) {
      const bytes = await toUint8Array(t, file);
      if (bytes)
        setForm(prev => ({
          ...prev,
          logo: bytes,
          fileSize: file.size,
          fileType: file.type,
          fileName: filename
        }));
    } else {
      setForm(prev => ({ ...prev, logo: undefined, fileSize: undefined, fileType: undefined, fileName: undefined }));
    }
  };

  useEffect(() => {
    const next = createBusinessDraft(business);
    baselineRef.current = next;
    setForm(next);
    void (async () => {
      const url = business && business.logo ? await toDataUrl(business.logo, business.fileType) : undefined;
      setLogoImageUrl(url);
    })();
  }, [business, setForm]);

  useEffect(() => {
    handleChange({
      business: form,
      isFormValid: isBusinessDraftReady(form, errors),
      description: t('common.invalidForm')
    });
  }, [form, errors, handleChange, t]);

  const eInvoiceOn = Boolean(settings?.ublON || settings?.xrechnungON);

  return (
    <Grid container spacing={2}>
      <Grid size={{ xs: 12, md: 12 }} sx={{ display: 'flex', justifyContent: 'center' }}>
        <UploadImage onUpload={handleLogoUpload} imgUrl={logoImageUrl} />
      </Grid>
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
          label={t('common.code')}
          fullWidth
          value={form.code}
          onChange={e => update('code', e.target.value)}
        />
      </Grid>
      <Grid size={{ xs: 12, md: 6 }}>
        <TextField
          label={t('common.address')}
          fullWidth
          helperText={t('common.addressHelper')}
          value={form.address}
          onChange={e => update('address', e.target.value)}
        />
      </Grid>
      <Grid size={{ xs: 12, md: 6 }}>
        <TextField
          label={t('businesses.role')}
          fullWidth
          value={form.role}
          onChange={e => update('role', e.target.value)}
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
          label={t('businesses.website')}
          fullWidth
          value={form.website}
          onChange={e => update('website', e.target.value)}
        />
      </Grid>
      <Grid size={{ xs: 12, md: 6 }}>
        <TextField
          label={t('common.description')}
          fullWidth
          rows={5}
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
      {form.paymentInformation && (
        <Grid size={{ xs: 12, md: 12 }}>
          <TextField
            multiline
            rows={5}
            fullWidth
            value={form.paymentInformation}
            disabled={true}
            label={
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                {t('common.paymentInfo')}
                <Tooltip title={t('common.paymentInfoLegacy')}>
                  <InfoOutlinedIcon fontSize="small" sx={{ color: 'action.active', cursor: 'pointer' }} />
                </Tooltip>
              </Box>
            }
          />
        </Grid>
      )}
      <Grid size={{ xs: 12, md: 12 }}>
        <FormControlLabel
          control={<Switch checked={form.isArchived} onChange={e => update('isArchived', e.target.checked)} />}
          label={t('common.archived')}
        />
      </Grid>
    </Grid>
  );
};
