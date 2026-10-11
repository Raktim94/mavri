import type { Item, ItemFromData } from '../../shared/types/item';
import type { Rows } from '../../shared/types/excel';
import { validators } from '../../shared/utils/validatorFunctions';

export type ItemValidationField = 'name' | 'amount';

export interface ItemFieldErrors {
  name: boolean;
  amount: boolean;
}

export const ITEM_EXCEL_COLUMNS = ['name', 'amount', 'unitName', 'categoryName', 'description', 'isArchived'];

export const ITEM_EXCEL_TEMPLATE: Rows = [
  {
    name: 'Paper A4',
    amount: '5',
    categoryName: 'Goods',
    unitName: 'pack',
    description: 'Standard white A4 paper',
    isArchived: false
  },
  {
    name: 'Pen Blue',
    amount: '150',
    categoryName: 'Goods',
    unitName: 'pcs',
    description: 'Blue ballpoint pen',
    isArchived: false
  }
];

const itemFieldRequired: Record<ItemValidationField, (value: string) => boolean> = {
  name: value => validators.required(value),
  amount: value => validators.required(value)
};

export const createItemDraft = (item?: Item): ItemFromData => ({
  id: item?.id,
  name: item?.name ?? '',
  amount: item?.amount ?? '0',
  unitId: item?.unitId,
  categoryId: item?.categoryId,
  description: item?.description ?? '',
  isArchived: item?.isArchived ?? false
});

export const createItemFieldErrors = (): ItemFieldErrors => ({
  name: false,
  amount: false
});

export const evaluateItemField = (field: ItemValidationField, value: string): boolean =>
  !itemFieldRequired[field](value);

export const applyItemFieldEvaluation = (
  errors: ItemFieldErrors,
  field: ItemValidationField,
  value: string
): ItemFieldErrors => ({ ...errors, [field]: evaluateItemField(field, value) });

export const isItemDraftReady = (draft: ItemFromData): boolean =>
  draft.name.trim() !== '' && draft.amount !== undefined && draft.amount.trim() !== '';
