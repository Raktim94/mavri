import { AmountFormat } from '../../shared/enums/amountFormat';
import { DateFormat } from '../../shared/enums/dateFormat';
import { Language } from '../../shared/enums/language';
import type { Settings } from '../../shared/types/settings';
import { AMOUNT_FORMAT_ITEMS, DATE_FORMAT_ITEMS, LANGUAGE_ITEMS } from '../../state/constant';

export type LanguageFormatField = 'language' | 'amountFormat' | 'dateFormat';

export interface LanguageFormatValues {
  language: Language;
  amountFormat: AmountFormat;
  dateFormat: DateFormat;
}

export interface InvoiceNumbering {
  prefix: string;
  suffix: string;
  includeMonth: boolean;
  includeYear: boolean;
  includeBusinessName: boolean;
}

export type InvoiceNumberingToggle = 'includeMonth' | 'includeYear' | 'includeBusinessName';

export const createLanguageFormatValues = (settings?: Settings | null): LanguageFormatValues => ({
  language: settings?.language ?? Language.en,
  amountFormat: settings?.amountFormat ?? AmountFormat.enUS,
  dateFormat: settings?.dateFormat ?? DateFormat.MMddyyyy
});

export const resolveLanguageFormatChange = (
  field: LanguageFormatField,
  value: Language | AmountFormat | DateFormat,
  current: LanguageFormatValues
): LanguageFormatValues => ({
  language: field === 'language' ? LANGUAGE_ITEMS[value as Language].value : current.language,
  amountFormat: field === 'amountFormat' ? AMOUNT_FORMAT_ITEMS[value as AmountFormat].value : current.amountFormat,
  dateFormat: field === 'dateFormat' ? DATE_FORMAT_ITEMS[value as DateFormat].value : current.dateFormat
});

export const applyInvoiceNumberingToggle = (
  current: InvoiceNumbering,
  toggle: InvoiceNumberingToggle,
  checked: boolean
): InvoiceNumbering => ({
  ...current,
  includeMonth: toggle === 'includeMonth' ? checked : current.includeMonth,
  includeYear: toggle === 'includeYear' ? checked : current.includeYear,
  includeBusinessName: toggle === 'includeBusinessName' ? checked : current.includeBusinessName
});
