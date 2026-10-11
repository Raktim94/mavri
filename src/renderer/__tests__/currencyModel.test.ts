import { describe, expect, it } from 'vitest';
import type { Currency } from '../shared/types/currency';
import {
  applyCurrencyFieldEvaluation,
  createCurrencyDraft,
  createCurrencyFieldErrors,
  evaluateCurrencyField,
  hasCurrencyFormat,
  isCurrencyDraftReady,
  isCurrencyFormatLocked,
  CURRENCY_EXCEL_COLUMNS,
  CURRENCY_EXCEL_TEMPLATE
} from '../pages/currencies/currencyModel';

const currency = (overrides: Partial<Currency> = {}): Currency =>
  ({
    id: 2,
    code: 'USD',
    symbol: '$',
    text: 'United States Dollar',
    format: '{symbol}{amount}',
    isArchived: false,
    subunit: 100,
    createdAt: '',
    updatedAt: '',
    invoiceCount: 0,
    quotesCount: 0,
    ...overrides
  }) as Currency;

describe('createCurrencyDraft', () => {
  it('defaults to a blank, zero-subunit draft', () => {
    const draft = createCurrencyDraft();

    expect(draft.code).toBe('');
    expect(draft.symbol).toBe('');
    expect(draft.subunit).toBe(0);
    expect(draft.isArchived).toBe(false);
  });

  it('copies stored values', () => {
    const draft = createCurrencyDraft(currency());

    expect(draft.id).toBe(2);
    expect(draft.code).toBe('USD');
    expect(draft.subunit).toBe(100);
    expect(draft.format).toBe('{symbol}{amount}');
  });
});

describe('evaluateCurrencyField', () => {
  it('treats blanks as errors and filled values as clean', () => {
    expect(evaluateCurrencyField('')).toBe(true);
    expect(evaluateCurrencyField(' ')).toBe(true);
    expect(evaluateCurrencyField('USD')).toBe(false);
  });
});

describe('applyCurrencyFieldEvaluation', () => {
  it('flags only the edited field', () => {
    const next = applyCurrencyFieldEvaluation(createCurrencyFieldErrors(), 'code', '');

    expect(next.code).toBe(true);
    expect(next.symbol).toBe(false);
  });
});

describe('format availability', () => {
  it('locks the format picker until code and symbol exist', () => {
    expect(isCurrencyFormatLocked(createCurrencyDraft())).toBe(true);
    expect(isCurrencyFormatLocked(createCurrencyDraft(currency({ symbol: '' })))).toBe(true);
    expect(isCurrencyFormatLocked(createCurrencyDraft(currency({ code: ' ' })))).toBe(true);
    expect(isCurrencyFormatLocked(createCurrencyDraft(currency()))).toBe(false);
  });

  it('detects whether a format is already chosen', () => {
    expect(hasCurrencyFormat(createCurrencyDraft())).toBe(false);
    expect(hasCurrencyFormat(createCurrencyDraft(currency()))).toBe(true);
  });
});

describe('isCurrencyDraftReady', () => {
  it('requires every field', () => {
    expect(isCurrencyDraftReady(createCurrencyDraft())).toBe(false);
    expect(isCurrencyDraftReady(createCurrencyDraft(currency()))).toBe(true);
    expect(isCurrencyDraftReady(createCurrencyDraft(currency({ text: ' ' })))).toBe(false);
    expect(isCurrencyDraftReady(createCurrencyDraft(currency({ subunit: 0 })))).toBe(true);
  });
});

describe('excel config', () => {
  it('lists core columns and two template rows', () => {
    expect(CURRENCY_EXCEL_COLUMNS).toEqual(['code', 'symbol', 'text', 'format', 'subunit', 'isArchived']);
    expect(CURRENCY_EXCEL_TEMPLATE).toHaveLength(2);
    expect(CURRENCY_EXCEL_TEMPLATE[0].code).toBe('USD');
  });
});
