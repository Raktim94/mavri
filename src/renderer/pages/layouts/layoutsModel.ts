import {
  parseLayoutSchema,
  type LayoutAdd,
  type LayoutSchema,
  type LayoutValidationError
} from '../../shared/types/layouts';

export interface LayoutDraftChange {
  layout: LayoutAdd & { id?: number };
  isFormValid: boolean;
  description: string;
}

export type LayoutTranslate = (key: string, params?: Record<string, string>) => string;

export const formatLayoutSchemaText = (schema?: LayoutSchema): string =>
  schema ? JSON.stringify(schema, null, 2) : '';

export const formatLayoutSchemaErrors = (errors: LayoutValidationError[], translate: LayoutTranslate): string =>
  errors.map(error => `${error.path}: ${translate(error.message, error.params)}`).join(' | ');

export const buildLayoutDraftChange = (params: {
  id?: number;
  schemaText: string;
  isArchived: boolean;
  translate: LayoutTranslate;
}): LayoutDraftChange => {
  const parsed = parseLayoutSchema(params.schemaText);
  const hasSchemaText = params.schemaText.trim() !== '';

  return {
    layout: {
      ...(params.id !== undefined ? { id: params.id } : {}),
      isArchived: params.isArchived,
      schema: parsed.schema ?? { schemaVersion: 1, meta: { name: '' } }
    },
    isFormValid: hasSchemaText && parsed.errors.length === 0,
    description:
      (hasSchemaText ? formatLayoutSchemaErrors(parsed.errors, params.translate) : '') ||
      params.translate('common.invalidForm')
  };
};
