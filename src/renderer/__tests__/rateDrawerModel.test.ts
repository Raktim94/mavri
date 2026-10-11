import { describe, expect, it } from 'vitest';
import { DiscountType } from '../shared/enums/discountType';
import { rateChoiceIndex, rateChoices, rateFormValid } from '../pages/invoices/Form/drawers/rateDrawerModel';

const t = (key: string) => key;

describe('rateChoices', () => {
  it('lists none, fixed and percentage in order', () => {
    expect(rateChoices(t)).toEqual([
      { label: 'invoices.none', value: undefined },
      { label: 'invoices.fixed', value: DiscountType.fixed },
      { label: 'invoices.percentage', value: DiscountType.percentage }
    ]);
  });
});

describe('rateChoiceIndex', () => {
  it('finds the selected choice and defaults to the first', () => {
    const choices = rateChoices(t);
    expect(rateChoiceIndex(choices, undefined)).toBe(0);
    expect(rateChoiceIndex(choices, DiscountType.fixed)).toBe(1);
    expect(rateChoiceIndex(choices, DiscountType.percentage)).toBe(2);
    expect(rateChoiceIndex(choices, 'bogus' as DiscountType)).toBe(0);
  });
});

describe('rateFormValid', () => {
  it('is valid without a type', () => {
    expect(rateFormValid({})).toBe(true);
    expect(rateFormValid({ type: undefined, amount: undefined, rate: undefined })).toBe(true);
  });

  it('is valid for a defined fixed amount or percentage rate', () => {
    expect(rateFormValid({ type: DiscountType.fixed, amount: 0 })).toBe(true);
    expect(rateFormValid({ type: DiscountType.fixed, amount: undefined })).toBe(false);
    expect(rateFormValid({ type: DiscountType.percentage, rate: 5 })).toBe(true);
    expect(rateFormValid({ type: DiscountType.percentage, rate: undefined })).toBe(false);
  });
});
