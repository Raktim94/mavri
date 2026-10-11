import { PaymentType } from '../../../../shared/enums/paymentType';
import type { PaymentForm } from '../../../../shared/types/invoice';

export type TFn = (key: string, options?: Record<string, unknown>) => string;

export interface PaymentChoice {
  label: string;
  value: PaymentType;
}

export const paymentChoices = (t: TFn): PaymentChoice[] => [
  { label: t('common.cash'), value: PaymentType.cash },
  { label: t('common.cheque'), value: PaymentType.cheque },
  { label: t('common.bank'), value: PaymentType.bank },
  { label: t('common.creditCard'), value: PaymentType.creditCard },
  { label: t('common.paypal'), value: PaymentType.paypal },
  { label: t('common.other'), value: PaymentType.other }
];

export const emptyPaymentForm = (data?: PaymentForm): PaymentForm => ({
  paymentMethod: data?.paymentMethod ?? PaymentType.cash,
  paidAmount: data?.paidAmount ?? 0,
  paidAt: data?.paidAt ?? '',
  notes: data?.notes ?? '',
  id: data?.id
});

export const paymentFormValid = (form: PaymentForm): boolean =>
  typeof form.paidAmount !== 'undefined' &&
  typeof form.paymentMethod !== 'undefined' &&
  typeof form.paidAt !== 'undefined' &&
  form.paidAt !== '';
