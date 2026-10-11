import { describe, expect, it } from 'vitest';
import { Alignment } from '../shared/enums/alignment';
import type { CustomFieldMeta, ItemForm } from '../shared/types/invoice';
import {
  initialItemForm,
  itemFormValid,
  mergeHeaderOptions,
  metadataErrors,
  metadataPresent,
  toggleAlignment,
  type TouchedFields
} from '../pages/invoices/Form/Modals/itemMetadataModel';

const untouched: TouchedFields = { header: false, sortOrder: false, value: false, alignment: false };

const form = (overrides: Partial<ItemForm> = {}): ItemForm => ({
  quantity: 1,
  unitPrice: 0,
  ...overrides
});

describe('initialItemForm', () => {
  it('defaults quantity to 1 and unit price to 0', () => {
    expect(initialItemForm({})).toEqual({
      quantity: 1,
      header: undefined,
      value: undefined,
      sortOrder: undefined,
      alignment: undefined,
      unitPrice: 0
    });
  });

  it('keeps current values and custom field data', () => {
    expect(
      initialItemForm({
        currQuantity: '3',
        currUnitPrice: 250,
        customField: { header: 'SKU', value: 'A-1', sortOrder: 2, alignment: Alignment.left }
      })
    ).toEqual({
      quantity: 3,
      header: 'SKU',
      value: 'A-1',
      sortOrder: 2,
      alignment: Alignment.left,
      unitPrice: 250
    });
  });
});

describe('metadataPresent', () => {
  it('detects any custom field content', () => {
    expect(metadataPresent(form())).toBe(false);
    expect(metadataPresent(form({ header: '' }))).toBe(false);
    expect(metadataPresent(form({ header: 'SKU' }))).toBe(true);
    expect(metadataPresent(form({ value: 'A-1' }))).toBe(true);
    expect(metadataPresent(form({ sortOrder: 1 }))).toBe(true);
    expect(metadataPresent(form({ alignment: Alignment.left }))).toBe(true);
  });
});

describe('itemFormValid', () => {
  it('accepts forms without custom metadata', () => {
    expect(itemFormValid(form())).toBe(true);
    expect(itemFormValid(form({ header: '', value: '' }))).toBe(true);
  });

  it('accepts fully filled metadata only', () => {
    expect(itemFormValid(form({ header: 'SKU', value: 'A-1', sortOrder: 1, alignment: Alignment.left }))).toBe(true);
    expect(itemFormValid(form({ header: 'SKU' }))).toBe(false);
    expect(itemFormValid(form({ header: 'SKU', value: 'A-1' }))).toBe(false);
    expect(itemFormValid(form({ header: 'SKU', value: 'A-1', sortOrder: 1 }))).toBe(false);
  });

  it('rejects missing quantity or unit price', () => {
    expect(itemFormValid(form({ quantity: undefined }))).toBe(false);
    expect(itemFormValid(form({ unitPrice: undefined }))).toBe(false);
  });
});

describe('metadataErrors', () => {
  it('stays quiet without metadata', () => {
    expect(metadataErrors({ form: form(), touched: { ...untouched, header: true, value: true } })).toEqual({
      header: false,
      value: false,
      sortOrder: false,
      alignment: false
    });
  });

  it('flags touched but empty fields once metadata exists', () => {
    const result = metadataErrors({
      form: form({ value: '', sortOrder: undefined, alignment: undefined, header: 'SKU' }),
      touched: { header: true, value: true, sortOrder: true, alignment: true }
    });
    expect(result).toEqual({ header: false, value: true, sortOrder: true, alignment: true });
  });

  it('ignores untouched fields', () => {
    const result = metadataErrors({
      form: form({ header: '', value: '', sortOrder: undefined, alignment: undefined }),
      touched: untouched
    });
    expect(result).toEqual({ header: false, value: false, sortOrder: false, alignment: false });
  });

  it('keeps a numeric sort order of zero valid', () => {
    const result = metadataErrors({
      form: form({ header: 'SKU', sortOrder: 0, value: 'x', alignment: Alignment.left }),
      touched: { ...untouched, sortOrder: true }
    });
    expect(result.sortOrder).toBe(false);
  });
});

describe('mergeHeaderOptions', () => {
  it('merges and de-duplicates by header keeping the later entry', () => {
    const base = [{ header: 'SKU', sortOrder: 1, alignment: Alignment.left }] as CustomFieldMeta[];
    const fetched = [
      { header: 'SKU', sortOrder: 5, alignment: Alignment.right },
      { header: 'BIN', sortOrder: 2, alignment: Alignment.center }
    ] as CustomFieldMeta[];

    const merged = mergeHeaderOptions(base, fetched);
    expect(merged).toHaveLength(2);
    expect(merged.find(entry => entry.header === 'SKU')?.sortOrder).toBe(5);
    expect(merged.find(entry => entry.header === 'BIN')?.sortOrder).toBe(2);
  });
});

describe('toggleAlignment', () => {
  it('clears when clicking the active alignment', () => {
    expect(toggleAlignment(Alignment.left, Alignment.left)).toBe(undefined);
    expect(toggleAlignment(Alignment.left, Alignment.right)).toBe(Alignment.right);
    expect(toggleAlignment(undefined, Alignment.center)).toBe(Alignment.center);
  });
});
