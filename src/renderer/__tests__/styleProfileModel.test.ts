import { describe, expect, it } from 'vitest';
import { FontFamily } from '../shared/enums/fontFamily';
import { SizeType } from '../shared/enums/sizeType';
import type { StyleProfile } from '../shared/types/styleProfiles';
import { DEFAULT_TABLE_FIELD_SORT_ORDERS } from '../state/constant';
import {
  applyCustomizationToDraft,
  applyStyleProfileFieldEvaluation,
  createStyleProfileDraft,
  createStyleProfileFieldErrors,
  evaluateStyleProfileField,
  isStyleProfileDraftReady,
  toCustomizationPreview
} from '../pages/styleProfiles/styleProfileModel';

const profile = (overrides: Partial<StyleProfile> = {}): StyleProfile =>
  ({
    id: 8,
    name: 'Blue profile',
    color: '#123456',
    logoSize: SizeType.medium,
    fontSize: SizeType.small,
    fontFamily: FontFamily.helvetica,
    layoutId: 2,
    labelUpperCase: true,
    isArchived: true,
    invoiceCount: 0,
    quotesCount: 0,
    createdAt: '',
    updatedAt: '',
    showQuantity: false,
    showUnit: false,
    showRowNo: false,
    fieldSortOrders: { no: 4, item: 5 },
    ...overrides
  }) as StyleProfile;

describe('createStyleProfileDraft', () => {
  it('applies defaults for an empty source', () => {
    const draft = createStyleProfileDraft();

    expect(draft.name).toBe('');
    expect(draft.fontFamily).toBe(FontFamily.roboto);
    expect(draft.labelUpperCase).toBe(false);
    expect(draft.showQuantity).toBe(true);
    expect(draft.showUnit).toBe(true);
    expect(draft.showRowNo).toBe(true);
    expect(draft.fieldSortOrders).toEqual(DEFAULT_TABLE_FIELD_SORT_ORDERS);
    expect(draft.isArchived).toBe(false);
  });

  it('copies stored values', () => {
    const draft = createStyleProfileDraft(profile());

    expect(draft.id).toBe(8);
    expect(draft.color).toBe('#123456');
    expect(draft.fontFamily).toBe(FontFamily.helvetica);
    expect(draft.showRowNo).toBe(false);
    expect(draft.fieldSortOrders).toEqual({ no: 4, item: 5 });
    expect(draft.isArchived).toBe(true);
  });
});

describe('applyCustomizationToDraft', () => {
  it('replaces customization fields while keeping identity fields', () => {
    const draft = createStyleProfileDraft(profile());
    const next = applyCustomizationToDraft(
      draft,
      { color: '#abcdef', showQuantity: true, fieldSortOrders: { no: 9 } as never },
      draft.id
    );

    expect(next.id).toBe(8);
    expect(next.name).toBe('Blue profile');
    expect(next.isArchived).toBe(true);
    expect(next.color).toBe('#abcdef');
    expect(next.showQuantity).toBe(true);
    expect(next.fieldSortOrders).toEqual({ no: 9 });
  });

  it('falls back to defaults for missing customization values', () => {
    const next = applyCustomizationToDraft(createStyleProfileDraft(), {}, undefined);

    expect(next.fontFamily).toBe(FontFamily.roboto);
    expect(next.labelUpperCase).toBe(false);
    expect(next.showUnit).toBe(true);
    expect(next.showRowNo).toBe(true);
    expect(next.fieldSortOrders).toEqual(DEFAULT_TABLE_FIELD_SORT_ORDERS);
  });
});

describe('toCustomizationPreview', () => {
  it('projects the draft into the customization form', () => {
    const preview = toCustomizationPreview(createStyleProfileDraft(profile()));

    expect(preview.color).toBe('#123456');
    expect(preview.fontSize).toBe(SizeType.small);
    expect(preview.labelUpperCase).toBe(true);
    expect(preview.showQuantity).toBe(false);
    expect(preview.fieldSortOrders).toEqual({ no: 4, item: 5 });
  });

  it('fills defaults for an empty draft', () => {
    const preview = toCustomizationPreview(createStyleProfileDraft());

    expect(preview.fontFamily).toBe(FontFamily.roboto);
    expect(preview.showQuantity).toBe(true);
    expect(preview.fieldSortOrders).toEqual(DEFAULT_TABLE_FIELD_SORT_ORDERS);
  });
});

describe('name validation', () => {
  it('requires a non-blank name', () => {
    expect(evaluateStyleProfileField('')).toBe(true);
    expect(evaluateStyleProfileField('Blue')).toBe(false);
    expect(applyStyleProfileFieldEvaluation(createStyleProfileFieldErrors(), '').name).toBe(true);
  });

  it('gates draft readiness on name and errors', () => {
    const draft = createStyleProfileDraft(profile());

    expect(isStyleProfileDraftReady(draft, createStyleProfileFieldErrors())).toBe(true);
    expect(isStyleProfileDraftReady(createStyleProfileDraft(), createStyleProfileFieldErrors())).toBe(false);
    expect(isStyleProfileDraftReady(draft, applyStyleProfileFieldEvaluation(createStyleProfileFieldErrors(), ''))).toBe(
      false
    );
  });
});
