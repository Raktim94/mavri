import { describe, expect, it } from 'vitest';
import { englishLabels, formatDate, formatMoneyIn, isRtl, labelsFor, LANGUAGES, type Key } from './i18n';

describe('i18n', () => {
  it('falls back to English for an unknown language', () => {
    expect(labelsFor('')('invoice')).toBe('Invoice');
    expect(labelsFor('xx')('total')).toBe('Total');
  });

  it('every draft translates every label', () => {
    const keys = Object.keys(englishLabels) as Key[];
    for (const l of LANGUAGES.filter(l => l.code)) {
      const t = labelsFor(l.code);
      for (const k of keys) expect(t(k), `${l.code}.${k}`).not.toBe('');
      // a label that is identical to English in a non-Latin script means the translation is missing
      if (l.code === 'ar' || l.code === 'hi')
        for (const k of keys) if (k !== 'madeWith') expect(t(k), `${l.code}.${k}`).not.toBe(englishLabels[k]);
    }
  });

  it('Arabic and Urdu are right-to-left', () => {
    expect(isRtl('ar')).toBe(true);
    expect(isRtl('ur')).toBe(true);
    expect(isRtl('ja')).toBe(false);
    expect(isRtl('fr')).toBe(false);
    expect(isRtl('')).toBe(false);
  });

  it('formats dates and money for the language, and leaves the default alone', () => {
    expect(formatDate('2026-10-16', '')).toBe('2026-10-16');
    expect(formatDate('2026-10-16', 'de')).toBe('16.10.2026');
    expect(formatMoneyIn(123456, 2, 'EUR', '')).toBeNull();
    expect(formatMoneyIn(123456, 2, 'EUR', 'de')).toMatch(/1\.234,56\s?€/);
    expect(formatMoneyIn(123456, 2, 'NOPE', 'de')).toBeNull();
  });
});
