import type { Currency, CurrencyFromData } from '../../shared/types/currency';
import type { Rows } from '../../shared/types/excel';
import { validators } from '../../shared/utils/validatorFunctions';

export type CurrencyValidationField = 'code' | 'symbol' | 'text' | 'format' | 'subunit';

export interface CurrencyFieldErrors {
  code: boolean;
  symbol: boolean;
  text: boolean;
  format: boolean;
  subunit: boolean;
}

export const CURRENCY_EXCEL_COLUMNS = ['code', 'symbol', 'text', 'format', 'subunit', 'isArchived'];

export const CURRENCY_EXCEL_TEMPLATE: Rows = [
  {
    code: 'USD',
    symbol: '$',
    text: 'United States Dollar',
    format: '{symbol}{amount}',
    subunit: 100,
    isArchived: false
  },
  {
    code: 'EUR',
    symbol: '€',
    text: 'Euro',
    subunit: 100,
    format: '{symbol}{amount}',
    isArchived: false
  }
];

export const createCurrencyDraft = (currency?: Currency): CurrencyFromData => ({
  id: currency?.id,
  code: currency?.code ?? '',
  symbol: currency?.symbol ?? '',
  text: currency?.text ?? '',
  format: currency?.format ?? '',
  isArchived: currency?.isArchived ?? false,
  subunit: currency?.subunit ?? 0
});

export const createCurrencyFieldErrors = (): CurrencyFieldErrors => ({
  code: false,
  symbol: false,
  text: false,
  format: false,
  subunit: false
});

export const evaluateCurrencyField = (value: string): boolean => !validators.required(value);

export const applyCurrencyFieldEvaluation = (
  errors: CurrencyFieldErrors,
  field: CurrencyValidationField,
  value: string
): CurrencyFieldErrors => ({ ...errors, [field]: evaluateCurrencyField(value) });

export const isCurrencyFormatLocked = (draft: CurrencyFromData): boolean =>
  draft.code.trim() === '' || draft.symbol.trim() === '';

export const hasCurrencyFormat = (draft: CurrencyFromData): boolean => draft.format.trim() !== '';

export const isCurrencyDraftReady = (draft: CurrencyFromData): boolean =>
  draft.code.trim() !== '' &&
  draft.symbol.trim() !== '' &&
  draft.text.trim() !== '' &&
  draft.format.trim() !== '' &&
  draft.subunit.toString().trim() !== '';
