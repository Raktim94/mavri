import { DiscountType } from '../../../../shared/enums/discountType';

export type TFn = (key: string, options?: Record<string, unknown>) => string;

export interface RateChoice {
  label: string;
  value: DiscountType | undefined;
}

export const rateChoices = (t: TFn): RateChoice[] => [
  { label: t('invoices.none'), value: undefined },
  { label: t('invoices.fixed'), value: DiscountType.fixed },
  { label: t('invoices.percentage'), value: DiscountType.percentage }
];

export const rateChoiceIndex = (choices: RateChoice[], selected: DiscountType | undefined): number => {
  const index = choices.findIndex(choice => choice.value === selected);
  return index >= 0 ? index : 0;
};

export const rateFormValid = (args: { type?: DiscountType; amount?: number; rate?: number }): boolean =>
  (args.type === DiscountType.fixed && typeof args.amount !== 'undefined') ||
  (args.type === DiscountType.percentage && typeof args.rate !== 'undefined') ||
  !args.type;
