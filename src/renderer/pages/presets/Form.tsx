import { Divider, FormControlLabel, Grid, Switch, TextField } from '@mui/material';
import { useCallback, useEffect, useMemo, useRef, useState, type FC } from 'react';
import { useTranslation } from 'react-i18next';
import type { Language } from '../../shared/enums/language';
import { useForm } from '../../shared/hooks/form/useForm';
import { useFormDirtyCheck } from '../../shared/hooks/form/useFormDirtyCheck';
import type { Bank } from '../../shared/types/bank';
import type { Business } from '../../shared/types/business';
import type { Client } from '../../shared/types/client';
import type { Currency } from '../../shared/types/currency';
import type { SignatureForm } from '../../shared/types/invoice';
import type { Preset, PresetFromData } from '../../shared/types/preset';
import type { StyleProfile } from '../../shared/types/styleProfiles';
import { useAppSelector } from '../../state/configureStore';
import { selectSettings } from '../../state/pageSlice';
import { BankSelector } from '../invoices/Form/BankSelector';
import { BusinessSelector } from '../invoices/Form/BusinessSelector';
import { ClientSelector } from '../invoices/Form/ClientSelector';
import { CurrencySelector } from '../invoices/Form/CurrencySelector';
import { BanksDropdown } from '../invoices/Form/Dropdowns/BanksDropdown';
import { BusinessesDropdown } from '../invoices/Form/Dropdowns/BusinessesDropdown';
import { ClientsDropdown } from '../invoices/Form/Dropdowns/ClientsDropdown';
import { CurrenciesDropdown } from '../invoices/Form/Dropdowns/CurrenciesDropdown';
import { LanguageDropdown } from '../invoices/Form/Dropdowns/LanguageDropdown';
import { StyleProfilesDropdown } from '../invoices/Form/Dropdowns/StyleProfilesDropdown';
import { LanguageSelector } from '../invoices/Form/LanguageSelector';
import { NotesSelector } from '../invoices/Form/NotesSelector';
import { SignatureSelector } from '../invoices/Form/SignatureSelector';
import { StyleProfileSelector } from '../invoices/Form/StyleProfileSelector';
import {
  applyPresetFieldEvaluation,
  createPresetDraft,
  createPresetFieldErrors,
  isPresetDraftReady
} from './presetModel';

interface Props {
  preset?: Preset;
  handleChange?: (data: { preset: PresetFromData; isFormValid: boolean; description?: string }) => void;
}

export const Form: FC<Props> = ({ preset, handleChange = () => {} }) => {
  const storeSettings = useAppSelector(selectSettings);
  const { t } = useTranslation();
  const baselineRef = useRef<PresetFromData | undefined>(undefined);
  const { form, setForm, update } = useForm<PresetFromData>(createPresetDraft(preset));
  const [errors, setErrors] = useState(createPresetFieldErrors);

  const [businessesOpen, setBusinessesOpen] = useState(false);
  const [clientsOpen, setClientsOpen] = useState(false);
  const [currenciesOpen, setCurrenciesOpen] = useState(false);
  const [styleProfilesOpen, setStyleProfilesOpen] = useState(false);
  const [banksOpen, setBanksOpen] = useState(false);
  const [languagesOpen, setLanguagesOpen] = useState(false);

  const signatureView = useMemo(
    () => ({
      signatureData: form.signatureData ?? undefined,
      signatureName: form.signatureName,
      signatureSize: form.signatureSize,
      signatureType: form.signatureType
    }),
    [form.signatureData, form.signatureName, form.signatureSize, form.signatureType]
  );

  const currencyView = useMemo(
    () => ({
      currencyCode: form.currencyCode,
      currencySymbol: form.currencySymbol
    }),
    [form.currencyCode, form.currencySymbol]
  );

  const businessView = useMemo(() => ({ businessName: form?.businessName }), [form.businessName]);

  const notesView = useMemo(
    () => ({
      customerNotes: form.customerNotes,
      thanksNotes: form.thanksNotes,
      termsConditionNotes: form.termsConditionNotes
    }),
    [form.termsConditionNotes, form.thanksNotes, form.customerNotes]
  );

  const syncName = (value: string) => {
    update('name', value);
    setErrors(prev => applyPresetFieldEvaluation(prev, 'name', value));
  };

  const openMenu = useCallback((setter: React.Dispatch<React.SetStateAction<boolean>>) => {
    setter(true);
  }, []);

  const closeMenu = useCallback((setter: React.Dispatch<React.SetStateAction<boolean>>) => {
    setter(false);
  }, []);

  const pickBusiness = useCallback(
    (data: Business) => {
      closeMenu(setBusinessesOpen);
      setForm(prev => ({ ...prev, businessId: data.id, businessName: data.name }));
    },
    [closeMenu, setForm]
  );

  const pickClient = useCallback(
    (data: Client) => {
      closeMenu(setClientsOpen);
      setForm(prev => ({ ...prev, clientId: data.id, clientName: data.name }));
    },
    [closeMenu, setForm]
  );

  const pickCurrency = useCallback(
    (data: Currency) => {
      closeMenu(setCurrenciesOpen);
      setForm(prev => ({
        ...prev,
        currencyId: data.id,
        currencyCode: data.code,
        currencySymbol: data.symbol
      }));
    },
    [closeMenu, setForm]
  );

  const pickStyleProfile = useCallback(
    (data: StyleProfile) => {
      closeMenu(setStyleProfilesOpen);
      setForm(prev => ({ ...prev, styleProfilesId: data.id, styleProfileName: data.name }));
    },
    [closeMenu, setForm]
  );

  const pickBank = useCallback(
    (data: Bank) => {
      closeMenu(setBanksOpen);
      setForm(prev => ({ ...prev, bankId: data.id, bankName: data.name }));
    },
    [closeMenu, setForm]
  );

  const clearBank = useCallback(() => {
    setForm(prev => ({ ...prev, bankId: undefined, bankName: undefined }));
  }, [setForm]);

  const pickLanguage = useCallback(
    (data: Language) => {
      closeMenu(setLanguagesOpen);
      setForm(prev => ({ ...prev, language: data }));
    },
    [closeMenu, setForm]
  );

  const pickSignature = useCallback(
    (data: SignatureForm) => {
      closeMenu(setLanguagesOpen);
      setForm(prev => ({
        ...prev,
        signatureData: data.data,
        signatureName: data.name,
        signatureType: data.type,
        signatureSize: data.size
      }));
    },
    [closeMenu, setForm]
  );

  useFormDirtyCheck(form, baselineRef);

  useEffect(() => {
    const next = createPresetDraft(preset);
    baselineRef.current = next;
    setForm(next);
  }, [preset, setForm]);

  useEffect(() => {
    handleChange({
      preset: form,
      isFormValid: isPresetDraftReady(form, errors),
      description: t('common.invalidForm')
    });
  }, [form, errors, handleChange, t]);

  return (
    <>
      <BusinessesDropdown
        isOpen={businessesOpen}
        onClose={() => closeMenu(setBusinessesOpen)}
        onOpen={() => openMenu(setBusinessesOpen)}
        onClick={pickBusiness}
      />
      <ClientsDropdown
        isOpen={clientsOpen}
        onClose={() => closeMenu(setClientsOpen)}
        onOpen={() => openMenu(setClientsOpen)}
        onClick={pickClient}
      />
      <CurrenciesDropdown
        isOpen={currenciesOpen}
        onClose={() => closeMenu(setCurrenciesOpen)}
        onOpen={() => openMenu(setCurrenciesOpen)}
        onClick={pickCurrency}
      />
      <StyleProfilesDropdown
        isOpen={styleProfilesOpen}
        onClose={() => closeMenu(setStyleProfilesOpen)}
        onOpen={() => openMenu(setStyleProfilesOpen)}
        onClick={pickStyleProfile}
      />
      <BanksDropdown
        isOpen={banksOpen}
        onClose={() => closeMenu(setBanksOpen)}
        onOpen={() => openMenu(setBanksOpen)}
        onClick={pickBank}
      />
      <LanguageDropdown
        isOpen={languagesOpen}
        onClose={() => closeMenu(setLanguagesOpen)}
        onOpen={() => openMenu(setLanguagesOpen)}
        onClick={pickLanguage}
      />

      <Grid container spacing={2}>
        <Grid size={{ xs: 12, md: 6 }}>
          <TextField
            label={t('common.name')}
            fullWidth
            required
            value={form.name}
            error={errors.name}
            helperText={errors.name ? t('common.fieldRequired') : ''}
            onChange={e => syncName(e.target.value)}
          />
        </Grid>
        <Grid size={{ xs: 12, md: 12 }}>
          <Divider flexItem />
        </Grid>
        <Grid size={{ xs: 12, md: storeSettings?.styleProfilesON ? 3 : 4 }}>
          <CurrencySelector onEdit={() => openMenu(setCurrenciesOpen)} data={currencyView} isRequired={false} />
        </Grid>
        <Grid size={{ xs: 12, md: storeSettings?.styleProfilesON ? 3 : 4 }}>
          <BankSelector onEdit={() => openMenu(setBanksOpen)} onClear={clearBank} name={form.bankName} />
        </Grid>
        {storeSettings?.styleProfilesON && (
          <Grid size={{ xs: 12, md: 3 }}>
            <StyleProfileSelector onEdit={() => openMenu(setStyleProfilesOpen)} name={form.styleProfileName} />
          </Grid>
        )}
        <Grid size={{ xs: 12, md: storeSettings?.styleProfilesON ? 3 : 4 }}>
          <LanguageSelector onEdit={() => openMenu(setLanguagesOpen)} language={form.language} isRequired={false} />
        </Grid>
        <Grid size={{ xs: 12, md: 12 }}>
          <Divider flexItem />
        </Grid>
        <Grid size={{ xs: 12, md: 12 }}>
          <BusinessSelector onEdit={() => openMenu(setBusinessesOpen)} data={businessView} isRequired={false} />
        </Grid>
        <Grid size={{ xs: 12, md: 12 }}>
          <Divider flexItem />
        </Grid>
        <Grid size={{ xs: 12, md: 12 }}>
          <ClientSelector onEdit={() => openMenu(setClientsOpen)} clientName={form.clientName} isRequired={false} />
        </Grid>
        <Grid size={{ xs: 12, md: 12 }}>
          <Divider flexItem />
        </Grid>
        <Grid size={{ xs: 12, md: 12 }}>
          <NotesSelector
            data={notesView}
            onCustomerNotesChanged={value => setForm(prev => ({ ...prev, customerNotes: value }))}
            onThanksNotesChanged={value => setForm(prev => ({ ...prev, thanksNotes: value }))}
            onTermsConditionsNotesChanged={value => setForm(prev => ({ ...prev, termsConditionNotes: value }))}
          />
        </Grid>
        <Grid size={{ xs: 12, md: 12 }}>
          <Divider flexItem />
        </Grid>
        <Grid size={{ xs: 12, md: 12 }}>
          <SignatureSelector data={signatureView} onEdit={pickSignature} />
        </Grid>
        <Grid size={{ xs: 12, md: 12 }}>
          <Divider flexItem />
        </Grid>
        <Grid size={{ xs: 12, md: 12 }}>
          <FormControlLabel
            control={<Switch checked={form.isArchived} onChange={e => update('isArchived', e.target.checked)} />}
            label={t('common.archived')}
          />
        </Grid>
      </Grid>
    </>
  );
};
