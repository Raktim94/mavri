import { describe, expect, it } from 'vitest';
import { PaymentType } from '../shared/enums/paymentType';
import { emptyPaymentForm, paymentChoices, paymentFormValid } from '../pages/invoices/Form/drawers/paymentDrawerModel';

const t = (key: string) => key;

describe('paymentChoices', () => {
  it('lists the six payment methods in order', () => {
    expect(paymentChoices(t).map(choice => choice.label)).toEqual([
      'common.cash',
      'common.cheque',
      'common.bank',
      'common.creditCard',
      'common.paypal',
      'common.other'
    ]);
  });
});

describe('emptyPaymentForm', () => {
  it('defaults to cash with zero amounts', () => {
    expect(emptyPaymentForm()).toEqual({
      paymentMethod: PaymentType.cash,
      paidAmount: 0,
      paidAt: '',
      notes: '',
      id: undefined
    });
  });

  it('keeps existing values', () => {
    expect(
      emptyPaymentForm({
        paymentMethod: PaymentType.bank,
        paidAmount: 5,
        paidAt: '2026-01-01',
        notes: 'part',
        id: 9
      })
    ).toEqual({ paymentMethod: PaymentType.bank, paidAmount: 5, paidAt: '2026-01-01', notes: 'part', id: 9 });
  });
});

describe('paymentFormValid', () => {
  it('requires a date and defined amount and method', () => {
    expect(paymentFormValid(emptyPaymentForm({ paidAt: '2026-01-01' }))).toBe(true);
    expect(paymentFormValid(emptyPaymentForm())).toBe(false);
    expect(
      paymentFormValid({
        paymentMethod: PaymentType.cash,
        paidAmount: undefined as unknown as number,
        paidAt: '2026-01-01',
        notes: ''
      })
    ).toBe(false);
  });
});
