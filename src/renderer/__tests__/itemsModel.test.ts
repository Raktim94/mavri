import { describe, expect, it } from 'vitest';
import type { Item } from '../shared/types/item';
import {
  applyItemFieldEvaluation,
  createItemDraft,
  createItemFieldErrors,
  evaluateItemField,
  isItemDraftReady,
  ITEM_EXCEL_COLUMNS,
  ITEM_EXCEL_TEMPLATE
} from '../pages/items/itemsModel';

const item = (overrides: Partial<Item> = {}): Item =>
  ({
    id: 5,
    name: 'Paper A4',
    amount: '5',
    unitId: 2,
    categoryId: 3,
    unitName: 'pack',
    categoryName: 'Goods',
    description: 'Standard white A4 paper',
    isArchived: false,
    createdAt: '',
    updatedAt: '',
    invoiceCount: 0,
    quotesCount: 0,
    ...overrides
  }) as Item;

describe('createItemDraft', () => {
  it('defaults a blank item to zero amount', () => {
    const draft = createItemDraft();

    expect(draft.name).toBe('');
    expect(draft.amount).toBe('0');
    expect(draft.unitId).toBeUndefined();
    expect(draft.isArchived).toBe(false);
  });

  it('copies stored values', () => {
    const draft = createItemDraft(item());

    expect(draft.id).toBe(5);
    expect(draft.amount).toBe('5');
    expect(draft.unitId).toBe(2);
    expect(draft.categoryId).toBe(3);
  });
});

describe('evaluateItemField', () => {
  it('requires both name and amount', () => {
    expect(evaluateItemField('name', '')).toBe(true);
    expect(evaluateItemField('name', 'Paper')).toBe(false);
    expect(evaluateItemField('amount', '')).toBe(true);
    expect(evaluateItemField('amount', '0')).toBe(false);
  });
});

describe('applyItemFieldEvaluation', () => {
  it('flags only the edited field', () => {
    const next = applyItemFieldEvaluation(createItemFieldErrors(), 'amount', '');

    expect(next.amount).toBe(true);
    expect(next.name).toBe(false);
  });
});

describe('isItemDraftReady', () => {
  it('needs a name and a filled amount', () => {
    expect(isItemDraftReady(createItemDraft())).toBe(false);
    expect(isItemDraftReady(createItemDraft(item()))).toBe(true);
    expect(isItemDraftReady(createItemDraft(item({ amount: '' })))).toBe(false);
    expect(isItemDraftReady(createItemDraft(item({ amount: undefined })))).toBe(true);
    expect(isItemDraftReady(createItemDraft(item({ name: '  ' })))).toBe(false);
  });
});

describe('excel config', () => {
  it('lists item columns and two template rows', () => {
    expect(ITEM_EXCEL_COLUMNS).toContain('unitName');
    expect(ITEM_EXCEL_TEMPLATE).toHaveLength(2);
    expect(ITEM_EXCEL_TEMPLATE[0].amount).toBe('5');
  });
});
