import { describe, expect, it } from 'vitest';
import { Language } from '../shared/enums/language';
import type { Preset } from '../shared/types/preset';
import {
  applyPresetFieldEvaluation,
  createPresetDraft,
  createPresetFieldErrors,
  evaluatePresetField,
  isPresetDraftReady,
  PRESET_EXCEL_COLUMNS,
  PRESET_EXCEL_TEMPLATE
} from '../pages/presets/presetModel';

const preset = (overrides: Partial<Preset> = {}): Preset =>
  ({
    id: 9,
    name: 'Core preset',
    businessId: 1,
    businessName: 'Acme',
    clientId: 2,
    clientName: 'John',
    currencyId: 3,
    currencyCode: 'USD',
    currencySymbol: '$',
    bankId: 4,
    bankName: 'Main',
    styleProfilesId: 5,
    styleProfileName: 'Blue',
    customerNotes: 'Customer notes',
    thanksNotes: 'Thanks notes',
    termsConditionNotes: 'Terms and conditions',
    language: Language.de,
    signatureSize: 120,
    signatureType: 'image/png',
    signatureName: 'sig.png',
    signatureData: new Uint8Array([3]),
    isArchived: true,
    createdAt: '',
    updatedAt: '',
    ...overrides
  }) as Preset;

describe('createPresetDraft', () => {
  it('produces a blank draft without a preset', () => {
    const draft = createPresetDraft();

    expect(draft.name).toBe('');
    expect(draft.businessId).toBeUndefined();
    expect(draft.language).toBeUndefined();
    expect(draft.isArchived).toBe(false);
  });

  it('copies selections and signature payload', () => {
    const draft = createPresetDraft(preset());

    expect(draft.id).toBe(9);
    expect(draft.businessName).toBe('Acme');
    expect(draft.currencyCode).toBe('USD');
    expect(draft.bankName).toBe('Main');
    expect(draft.language).toBe(Language.de);
    expect(draft.signatureData).toEqual(new Uint8Array([3]));
    expect(draft.isArchived).toBe(true);
  });
});

describe('evaluatePresetField', () => {
  it('requires the name', () => {
    expect(evaluatePresetField('')).toBe(true);
    expect(evaluatePresetField('Core')).toBe(false);
  });
});

describe('applyPresetFieldEvaluation', () => {
  it('updates the name error', () => {
    expect(applyPresetFieldEvaluation(createPresetFieldErrors(), 'name', '').name).toBe(true);
    expect(applyPresetFieldEvaluation(createPresetFieldErrors(), 'name', 'Core').name).toBe(false);
  });
});

describe('isPresetDraftReady', () => {
  it('needs a name without errors', () => {
    expect(isPresetDraftReady(createPresetDraft(), createPresetFieldErrors())).toBe(false);
    expect(isPresetDraftReady(createPresetDraft(preset()), createPresetFieldErrors())).toBe(true);
    expect(
      isPresetDraftReady(createPresetDraft(preset()), applyPresetFieldEvaluation(createPresetFieldErrors(), 'name', ''))
    ).toBe(false);
  });
});

describe('excel config', () => {
  it('lists preset columns and an English template row', () => {
    expect(PRESET_EXCEL_COLUMNS).toContain('styleProfilesId');
    expect(PRESET_EXCEL_TEMPLATE).toHaveLength(1);
    expect(PRESET_EXCEL_TEMPLATE[0].language).toBe(Language.en);
  });
});
