import { describe, expect, it } from 'vitest';
import { computeTotals, formatMoney, toMajor, toMinor } from './money';
import type { Adjustment, Line } from './types';

const none: Adjustment = { mode: '', cents: 0, percent: 0 };
const line = (quantity: number, unitCents: number, taxRate = 0, taxMode: Line['taxMode'] = ''): Line => ({
  productId: null,
  name: 'x',
  unit: '',
  quantity,
  unitCents,
  taxRate,
  taxMode,
  code: '',
  taxCode: '',
  period: '',
  lineType: '',
  taxCategory: ''
});
const doc = (over: Partial<Parameters<typeof computeTotals>[0]> & { lines: Line[] }) => ({
  discount: none,
  surcharge: none,
  shippingCents: 0,
  taxRate: 0,
  taxMode: '' as const,
  ...over
});

// These cases mirror server/internal/money/money_test.go so both sides agree.
describe('computeTotals', () => {
  it('adds tax on top per line', () => {
    expect(computeTotals(doc({ lines: [line(3, 10000, 10, 'add')] }))).toMatchObject({
      subtotalCents: 30000,
      taxCents: 3000,
      totalCents: 33000
    });
  });
  it('splits tax out of an included price', () => {
    expect(computeTotals(doc({ lines: [line(1, 11000, 10, 'included')] }))).toMatchObject({
      subtotalCents: 10000,
      taxCents: 1000,
      totalCents: 11000
    });
  });
  it('discounts before document tax and adds shipping last', () => {
    expect(
      computeTotals(
        doc({
          lines: [line(1, 20000)],
          discount: { mode: 'percent', cents: 0, percent: 10 },
          taxRate: 20,
          taxMode: 'add',
          shippingCents: 500
        })
      )
    ).toMatchObject({ discountCents: 2000, taxCents: 3600, totalCents: 22100 });
  });
  it('subtracts withheld tax', () => {
    expect(computeTotals(doc({ lines: [line(1, 10000)], taxRate: 10, taxMode: 'withheld' }))).toMatchObject({
      taxCents: -1000,
      totalCents: 9000
    });
  });
  it('adds a fixed surcharge', () => {
    expect(
      computeTotals(doc({ lines: [line(2, 500)], surcharge: { mode: 'fixed', cents: 250, percent: 0 } })).totalCents
    ).toBe(1250);
  });
  it('reports the tax inside a document-level included rate', () => {
    expect(computeTotals(doc({ lines: [line(1, 12000)], taxRate: 20, taxMode: 'included' }))).toMatchObject({
      taxCents: 2000,
      totalCents: 12000
    });
  });
  it('rounds half cents away from zero', () => {
    expect(computeTotals(doc({ lines: [line(1, 5, 10, 'add')] }))).toMatchObject({ taxCents: 1, totalCents: 6 });
  });
  it('handles fractional quantities', () => {
    expect(computeTotals(doc({ lines: [line(1.5, 1001)] })).totalCents).toBe(1502);
  });
});

describe('money helpers', () => {
  const usd = { code: 'USD', symbol: '$', pattern: '{symbol}{amount}', decimals: 2 };
  it('formats with the currency pattern', () => {
    expect(formatMoney(123456, usd)).toBe('$1,234.56');
    expect(formatMoney(5, usd)).toBe('$0.05');
    expect(formatMoney(-250, { code: 'EUR', symbol: '€', pattern: '{amount} {symbol}', decimals: 2 })).toBe('-2.50 €');
    expect(formatMoney(500, { code: 'JPY', symbol: '¥', pattern: '{symbol}{amount}', decimals: 0 })).toBe('¥500');
  });
  it('converts between major and minor units', () => {
    expect(toMinor('19.99', 2)).toBe(1999);
    expect(toMajor(1999, 2)).toBe('19.99');
    expect(toMinor('', 2)).toBe(0);
  });
});
