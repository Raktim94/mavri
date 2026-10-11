import { Language } from '../../shared/enums/language';
import type { Rows } from '../../shared/types/excel';
import type { Preset, PresetFromData } from '../../shared/types/preset';
import { validators } from '../../shared/utils/validatorFunctions';

export type PresetValidationField = 'name';

export interface PresetFieldErrors {
  name: boolean;
}

export const PRESET_EXCEL_COLUMNS = [
  'name',
  'businessId',
  'clientId',
  'currencyId',
  'bankId',
  'styleProfilesId',
  'customerNotes',
  'thanksNotes',
  'termsConditionNotes',
  'language',
  'signatureSize',
  'signatureType',
  'signatureName',
  'isArchived'
];

export const PRESET_EXCEL_TEMPLATE: Rows = [
  {
    name: 'Core preset',
    businessId: null,
    clientId: null,
    currencyId: null,
    bankId: null,
    styleProfilesId: null,
    customerNotes: 'Customer notes',
    thanksNotes: 'Thanks notes',
    termsConditionNotes: 'Terms and conditions',
    language: Language.en,
    signatureSize: null,
    signatureType: null,
    signatureName: null,
    isArchived: false
  }
];

export const createPresetDraft = (preset?: Preset): PresetFromData => ({
  id: preset?.id,
  name: preset?.name ?? '',
  businessId: preset?.businessId,
  businessName: preset?.businessName,
  clientId: preset?.clientId,
  clientName: preset?.clientName,
  currencyId: preset?.currencyId,
  currencyCode: preset?.currencyCode,
  currencySymbol: preset?.currencySymbol,
  bankId: preset?.bankId,
  bankName: preset?.bankName,
  styleProfilesId: preset?.styleProfilesId,
  styleProfileName: preset?.styleProfileName,
  customerNotes: preset?.customerNotes,
  thanksNotes: preset?.thanksNotes,
  termsConditionNotes: preset?.termsConditionNotes,
  language: preset?.language,
  signatureSize: preset?.signatureSize,
  signatureType: preset?.signatureType,
  signatureName: preset?.signatureName,
  signatureData: preset?.signatureData,
  isArchived: preset?.isArchived ?? false
});

export const createPresetFieldErrors = (): PresetFieldErrors => ({
  name: false
});

export const evaluatePresetField = (value: string): boolean => !validators.required(value);

export const applyPresetFieldEvaluation = (
  errors: PresetFieldErrors,
  field: PresetValidationField,
  value: string
): PresetFieldErrors => ({ ...errors, [field]: evaluatePresetField(value) });

export const isPresetDraftReady = (draft: PresetFromData, errors: PresetFieldErrors): boolean =>
  draft.name.trim() !== '' && !errors.name;
