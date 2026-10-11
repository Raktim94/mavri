import { Alignment } from '../../../../shared/enums/alignment';
import type { CustomField, CustomFieldMeta, ItemForm } from '../../../../shared/types/invoice';

export type TouchedFields = { header: boolean; sortOrder: boolean; value: boolean; alignment: boolean };

export const initialItemForm = (args: {
  currQuantity?: string;
  currUnitPrice?: number;
  customField?: CustomField;
}): ItemForm => ({
  quantity: Number(args.currQuantity ?? 1),
  header: args.customField?.header ?? undefined,
  value: args.customField?.value ?? undefined,
  sortOrder: args.customField?.sortOrder ?? undefined,
  alignment: args.customField?.alignment ?? undefined,
  unitPrice: Number(args.currUnitPrice ?? 0)
});

export const metadataPresent = (form: ItemForm): boolean =>
  (form.header !== undefined && form.header !== '') ||
  (form.value !== undefined && form.value !== '') ||
  form.sortOrder !== undefined ||
  form.alignment !== undefined;

export const itemFormValid = (form: ItemForm): boolean => {
  if (form.quantity === undefined) return false;
  if (form.unitPrice === undefined) return false;

  const { header, value, sortOrder, alignment } = form;

  const allEmpty =
    (header === undefined || header === '') &&
    (value === undefined || value === '') &&
    sortOrder === undefined &&
    alignment === undefined;

  const allFilled =
    typeof header === 'string' &&
    header.trim() !== '' &&
    typeof value === 'string' &&
    value.trim() !== '' &&
    sortOrder != undefined &&
    alignment != undefined;

  return allEmpty || allFilled;
};

const isBlank = (value: string): boolean => value.trim() === '';

export const metadataErrors = (args: {
  form: ItemForm;
  touched: TouchedFields;
}): { header: boolean; value: boolean; sortOrder: boolean; alignment: boolean } => {
  const { form, touched } = args;

  if (!metadataPresent(form)) {
    return { header: false, value: false, sortOrder: false, alignment: false };
  }

  const sortOrderStr = form.sortOrder != undefined ? String(form.sortOrder) : '';

  return {
    header: touched.header ? isBlank(form.header ?? '') : false,
    value: touched.value ? isBlank(form.value ?? '') : false,
    sortOrder: touched.sortOrder ? isBlank(sortOrderStr) : false,
    alignment: touched.alignment ? isBlank(form.alignment ?? '') : false
  };
};

export const mergeHeaderOptions = (base: CustomFieldMeta[], fetched: CustomFieldMeta[]): CustomFieldMeta[] => [
  ...new Map([...base, ...fetched].map(entry => [entry.header, entry])).values()
];

export const toggleAlignment = (current: Alignment | undefined, clicked: Alignment): Alignment | undefined =>
  current === clicked ? undefined : clicked;
