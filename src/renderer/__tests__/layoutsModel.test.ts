import { describe, expect, it } from 'vitest';
import type { LayoutSchema } from '../shared/types/layouts';
import {
  buildLayoutDraftChange,
  formatLayoutSchemaErrors,
  formatLayoutSchemaText
} from '../pages/layouts/layoutsModel';

const translate = (key: string) => key;

const validSchema: LayoutSchema = {
  schemaVersion: 1,
  meta: { name: 'Classic' }
};

describe('formatLayoutSchemaText', () => {
  it('renders empty text without a schema', () => {
    expect(formatLayoutSchemaText(undefined)).toBe('');
  });

  it('pretty-prints a schema', () => {
    expect(formatLayoutSchemaText(validSchema)).toBe(JSON.stringify(validSchema, null, 2));
  });
});

describe('formatLayoutSchemaErrors', () => {
  it('joins path and translated message', () => {
    const text = formatLayoutSchemaErrors([{ path: 'meta.name', message: 'layouts.validation.name' }], translate);

    expect(text).toBe('meta.name: layouts.validation.name');
  });
});

describe('buildLayoutDraftChange', () => {
  it('marks an empty schema invalid with the generic fallback', () => {
    const change = buildLayoutDraftChange({ schemaText: '   ', isArchived: false, translate });

    expect(change.isFormValid).toBe(false);
    expect(change.description).toBe('common.invalidForm');
    expect(change.layout.schema).toEqual({ schemaVersion: 1, meta: { name: '' } });
    expect(change.layout.isArchived).toBe(false);
    expect('id' in change.layout).toBe(false);
  });

  it('accepts a valid schema and keeps the id when present', () => {
    const change = buildLayoutDraftChange({
      id: 4,
      schemaText: JSON.stringify(validSchema),
      isArchived: true,
      translate
    });

    expect(change.isFormValid).toBe(true);
    expect(change.layout).toMatchObject({ id: 4, isArchived: true, schema: validSchema });
    expect(change.description).toBe('common.invalidForm');
  });

  it('surfaces parse errors in the description', () => {
    const change = buildLayoutDraftChange({ schemaText: '{oops', isArchived: false, translate });

    expect(change.isFormValid).toBe(false);
    expect(change.description).toContain('$: layouts.validation.invalidJson');
  });
});
