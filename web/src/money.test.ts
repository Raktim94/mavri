import { describe, expect, it } from 'vitest';
import { computeTotals, formatMoney, fromCents, toCents } from './money';

const none = { type: null, cents: 0, percent: 0 } as const;
const line = (
  quantity: number,
  unitPriceCents: number,
  taxRate = 0,
  taxType: 'exclusive' | 'inclusive' | null = null
) => ({
  quantity,
  unitPriceCents,
  taxRate,
  taxType
});

describe('computeTotals', () => {
  it('adds tax on top for exclusive lines', () => {
    const t = computeTotals([line(3, 10000, 10, 'exclusive')], none, none, 0, { rate: 0, type: null });
    expect(t).toMatchObject({ subtotal: 30000, tax: 3000, total: 33000 });
  });
  it('splits tax out of inclusive lines without changing the total', () => {
    const t = computeTotals([line(1, 11000, 10, 'inclusive')], none, none, 0, { rate: 0, type: null });
    expect(t).toMatchObject({ subtotal: 10000, tax: 1000, total: 11000 });
  });
  it('applies a percentage discount before document tax and adds shipping', () => {
    const t = computeTotals([line(1, 20000)], { type: 'percentage', cents: 0, percent: 10 }, none, 500, {
      rate: 20,
      type: 'exclusive'
    });
    expect(t).toMatchObject({ discount: 2000, tax: 3600, total: 18000 + 3600 + 500 });
  });
  it('subtracts deducted tax', () => {
    const t = computeTotals([line(1, 10000)], none, none, 0, { rate: 10, type: 'deducted' });
    expect(t.total).toBe(9000);
  });
  it('adds a fixed surcharge', () => {
    expect(
      computeTotals([line(2, 500)], none, { type: 'fixed', cents: 250, percent: 0 }, 0, { rate: 0, type: null }).total
    ).toBe(1250);
  });
});

describe('money helpers', () => {
  it('formats with the currency pattern', () => {
    expect(formatMoney(123456, { code: 'USD', symbol: '$', subunit: 100, format: '{symbol}{amount}' })).toMatch(
      /^\$1.?234[.,]56$/
    );
    expect(formatMoney(500, { code: 'JPY', symbol: '¥', subunit: 1 })).toBe('¥500');
  });
  it('round-trips cents', () => {
    expect(toCents('19.99', 100)).toBe(1999);
    expect(fromCents(1999, 100)).toBe('19.99');
  });
});
