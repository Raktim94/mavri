import { describe, expect, it } from 'vitest';
import { handlers } from '../mocks/handlers';
import i18n from '../i18n';
import { a11yProps } from '../shared/utils/generalFunctions';
import {
  AMOUNT_FORMAT_ITEMS,
  AMOUNT_FORMAT_ITEMS_ARRAY,
  CURRENCY_FORMAT_ITEMS,
  CURRENCY_FORMAT_ITEMS_ARRAY,
  DATE_FORMAT_ITEMS,
  DATE_FORMAT_ITEMS_ARRAY,
  DEFAULT_TABLE_FIELD_SORT_ORDERS,
  FONT_ITEMS_ARRAY,
  LANGUAGE_ITEMS,
  LANGUAGE_ITEMS_ARRAY,
  MONTH_NAMES
} from '../state/constant';

describe('a11yProps', () => {
  it('builds tab and tabpanel accessibility ids', () => {
    expect(a11yProps(0)).toEqual({ id: 'mui-tab-0', 'aria-controls': 'mui-tabpanel-0' });
    expect(a11yProps(12)).toEqual({ id: 'mui-tab-12', 'aria-controls': 'mui-tabpanel-12' });
  });
});

describe('language constants', () => {
  it('lists the five supported languages', () => {
    expect(LANGUAGE_ITEMS).toEqual({
      lt: { label: 'Lithuanian', value: 'lt' },
      en: { label: 'English', value: 'en' },
      fr: { label: 'French', value: 'fr' },
      de: { label: 'German', value: 'de' },
      pt: { label: 'Portuguese', value: 'pt' }
    });
    expect(LANGUAGE_ITEMS_ARRAY).toHaveLength(5);
    expect(LANGUAGE_ITEMS_ARRAY).toEqual(Object.values(LANGUAGE_ITEMS));
  });
});

describe('amount format constants', () => {
  it('covers decimal and no-decimal variants for four locales', () => {
    expect(Object.keys(AMOUNT_FORMAT_ITEMS)).toEqual([
      'en-US',
      'en-US-no-decimal',
      'lt-LT',
      'lt-LT-no-decimal',
      'de-DE',
      'de-DE-no-decimal',
      'en-IN',
      'en-IN-no-decimal'
    ]);
    expect(AMOUNT_FORMAT_ITEMS['en-US'].label).toBe('1,234.10');
    expect(AMOUNT_FORMAT_ITEMS['en-US-no-decimal'].label).toBe('1,234');
    expect(AMOUNT_FORMAT_ITEMS['de-DE'].label).toBe('1.234,10');
    expect(AMOUNT_FORMAT_ITEMS['en-IN'].label).toBe('12,34,567.10');
    expect(AMOUNT_FORMAT_ITEMS_ARRAY).toHaveLength(8);
  });
});

describe('date format constants', () => {
  it('covers twelve display patterns with sample labels', () => {
    expect(DATE_FORMAT_ITEMS_ARRAY).toHaveLength(12);
    expect(DATE_FORMAT_ITEMS['MM/dd/yyyy'].label).toBe('11/11/2025 (MM.dd.yyyy)');
    expect(DATE_FORMAT_ITEMS['MMM d, yyyy'].label).toBe('Nov 11, 2025 (MMM d, yyyy)');
    expect(DATE_FORMAT_ITEMS['yyyy.MM.dd']).toEqual({
      label: '2025.11.2025 (yyyy.MM.dd)',
      value: 'yyyy.MM.dd'
    });
  });
});

describe('currency format constants', () => {
  it('offers symbol, code and bare amount placements', () => {
    expect(Object.keys(CURRENCY_FORMAT_ITEMS)).toEqual([
      '{symbol}{amount}',
      '{symbol} {amount}',
      '{amount}{symbol}',
      '{amount} {symbol}',
      '{code}{amount}',
      '{code} {amount}',
      '{amount}{code}',
      '{amount} {code}',
      '{amount}'
    ]);
    expect(CURRENCY_FORMAT_ITEMS['{symbol}{amount}'].label).toBe('{symbol}123');
    expect(CURRENCY_FORMAT_ITEMS['{amount}'].label).toBe('123');
    expect(CURRENCY_FORMAT_ITEMS_ARRAY).toHaveLength(9);
  });
});

describe('table and font constants', () => {
  it('provides the default column sort order', () => {
    expect(DEFAULT_TABLE_FIELD_SORT_ORDERS).toEqual({
      no: 0,
      item: 1,
      unit: 2,
      quantity: 3,
      unitCost: 4,
      total: 5
    });
  });

  it('lists the supported pdf fonts', () => {
    expect(FONT_ITEMS_ARRAY.map(item => item.value)).toEqual([
      'Helvetica',
      'Times-Roman',
      'Courier',
      'Roboto',
      'Inter'
    ]);
  });

  it('lists all twelve month names', () => {
    expect(MONTH_NAMES).toEqual([
      'January',
      'February',
      'March',
      'April',
      'May',
      'June',
      'July',
      'August',
      'September',
      'October',
      'November',
      'December'
    ]);
  });
});

describe('i18n setup', () => {
  it('boots in english with all five bundles', () => {
    expect(i18n.language).toBe('en');
    expect(i18n.resolvedLanguage).toBe('en');
    expect(i18n.options.fallbackLng).toEqual(['en']);
    expect(i18n.options.lng).toBe('en');
    expect(i18n.options.interpolation?.escapeValue).toBe(false);
    expect(Object.keys(i18n.services.resourceStore.data ?? {})).toEqual(['en', 'lt', 'fr', 'de', 'pt']);
  });

  it('translates menu entries and shared errors', () => {
    expect(i18n.t('menuItems.invoices')).toBe('Invoices');
    expect(i18n.t('error.unsupportedImage')).toBe('Unsupported image type');
  });
});

describe('mock handlers', () => {
  it('registers no rest handlers by default', () => {
    expect(handlers).toHaveLength(0);
  });
});
