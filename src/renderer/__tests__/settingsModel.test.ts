import { describe, expect, it } from 'vitest';
import { AmountFormat } from '../shared/enums/amountFormat';
import { DateFormat } from '../shared/enums/dateFormat';
import { Language } from '../shared/enums/language';
import type { Settings } from '../shared/types/settings';
import {
  applyInvoiceNumberingToggle,
  createLanguageFormatValues,
  resolveLanguageFormatChange
} from '../pages/settings/settingsModel';

describe('createLanguageFormatValues', () => {
  it('falls back to English defaults without settings', () => {
    expect(createLanguageFormatValues(undefined)).toEqual({
      language: Language.en,
      amountFormat: AmountFormat.enUS,
      dateFormat: DateFormat.MMddyyyy
    });
  });

  it('reads stored preferences', () => {
    const values = createLanguageFormatValues({
      language: Language.de,
      amountFormat: AmountFormat.deDE,
      dateFormat: DateFormat.ddMMyyyy
    } as Settings);

    expect(values.language).toBe(Language.de);
    expect(values.amountFormat).toBe(AmountFormat.deDE);
    expect(values.dateFormat).toBe(DateFormat.ddMMyyyy);
  });
});

describe('resolveLanguageFormatChange', () => {
  const current = createLanguageFormatValues();

  it('updates only the changed field using the option map value', () => {
    expect(resolveLanguageFormatChange('language', Language.de, current)).toEqual({
      language: Language.de,
      amountFormat: AmountFormat.enUS,
      dateFormat: DateFormat.MMddyyyy
    });
    expect(resolveLanguageFormatChange('amountFormat', AmountFormat.ltLT, current)).toEqual({
      language: Language.en,
      amountFormat: AmountFormat.ltLT,
      dateFormat: DateFormat.MMddyyyy
    });
    expect(resolveLanguageFormatChange('dateFormat', DateFormat.yyyyMMdd, current)).toEqual({
      language: Language.en,
      amountFormat: AmountFormat.enUS,
      dateFormat: DateFormat.yyyyMMdd
    });
  });
});

describe('applyInvoiceNumberingToggle', () => {
  const numbering = {
    prefix: 'INV',
    suffix: 'A',
    includeMonth: true,
    includeYear: true,
    includeBusinessName: true
  };

  it('flips the addressed switch and keeps the rest', () => {
    expect(applyInvoiceNumberingToggle(numbering, 'includeMonth', false)).toEqual({
      prefix: 'INV',
      suffix: 'A',
      includeMonth: false,
      includeYear: true,
      includeBusinessName: true
    });
    expect(applyInvoiceNumberingToggle(numbering, 'includeYear', false).includeYear).toBe(false);
    expect(applyInvoiceNumberingToggle(numbering, 'includeBusinessName', false).includeBusinessName).toBe(false);
  });
});
