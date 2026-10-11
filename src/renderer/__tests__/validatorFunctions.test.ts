import { describe, expect, it } from 'vitest';
import { validateOnlyNumbersLetters, validators } from '../shared/utils/validatorFunctions';

describe('validators.email', () => {
  it('accepts a local part, domain and tld', () => {
    expect(validators.email('a@b.co')).toBe(true);
    expect(validators.email(' hello@mail.io ')).toBe(false);
    expect(validators.email('a@b')).toBe(false);
    expect(validators.email('')).toBe(false);
  });
});

describe('validators.phone', () => {
  it('requires a country code prefix', () => {
    expect(validators.phone('+123456789')).toBe(true);
    expect(validators.phone('(+44) 20 1234')).toBe(true);
    expect(validators.phone('+1')).toBe(false);
    expect(validators.phone('123456789')).toBe(false);
  });
});

describe('validators.required', () => {
  it('rejects blank values', () => {
    expect(validators.required('x')).toBe(true);
    expect(validators.required('  ')).toBe(false);
    expect(validators.required('')).toBe(false);
  });
});

describe('validators.sortCode', () => {
  it('accepts six digits with spaces or dashes', () => {
    expect(validators.sortCode('012-456')).toBe(true);
    expect(validators.sortCode('012456')).toBe(true);
    expect(validators.sortCode('12345')).toBe(false);
    expect(validators.sortCode('')).toBe(false);
  });
});

describe('validators.accountNumber', () => {
  it('accepts 4 to 34 alphanumeric characters', () => {
    expect(validators.accountNumber('AB1234')).toBe(true);
    expect(validators.accountNumber('ab12 34')).toBe(true);
    expect(validators.accountNumber('1234')).toBe(true);
    expect(validators.accountNumber('123')).toBe(false);
    expect(validators.accountNumber('')).toBe(false);
  });
});

describe('validators.swift', () => {
  it('accepts eight or eleven characters', () => {
    expect(validators.swift('GB82WEST')).toBe(true);
    expect(validators.swift('12345678')).toBe(true);
    expect(validators.swift('ABCDEF12345')).toBe(true);
    expect(validators.swift('SWIFTCODE')).toBe(false);
    expect(validators.swift('1234567')).toBe(false);
    expect(validators.swift('')).toBe(false);
  });
});

describe('validators.routingNumber', () => {
  it('requires exactly nine digits', () => {
    expect(validators.routingNumber('012345678')).toBe(true);
    expect(validators.routingNumber('0123456')).toBe(false);
  });
});

describe('validators.branchCode', () => {
  it('allows an empty value or three to six digits', () => {
    expect(validators.branchCode('')).toBe(true);
    expect(validators.branchCode('012')).toBe(true);
    expect(validators.branchCode('012345')).toBe(true);
    expect(validators.branchCode('0123456')).toBe(false);
  });
});

describe('validators.upiOrPix', () => {
  it('accepts UPI handles, emails, phone numbers, CPFs and UUIDs', () => {
    expect(validators.upiOrPix('foo.bar@upi')).toBe(true);
    expect(validators.upiOrPix('a@b.co')).toBe(true);
    expect(validators.upiOrPix('+5511999999999')).toBe(true);
    expect(validators.upiOrPix('12345678901')).toBe(true);
    expect(validators.upiOrPix('550e8400-e29b-41d4-a716-446655440000')).toBe(true);
    expect(validators.upiOrPix('nope')).toBe(false);
    expect(validators.upiOrPix('')).toBe(false);
  });
});

describe('validators.countryCode', () => {
  it('accepts two letter ISO codes', () => {
    expect(validators.countryCode('us')).toBe(true);
    expect(validators.countryCode('USA')).toBe(false);
    expect(validators.countryCode('U')).toBe(false);
  });
});

describe('validators.peppol helpers', () => {
  it('validates endpoint ids', () => {
    expect(validators.peppolEndpointId('00.123-abc')).toBe(true);
    expect(validators.peppolEndpointId('a b')).toBe(false);
    expect(validators.peppolEndpointId('')).toBe(false);
  });

  it('validates scheme ids', () => {
    expect(validators.peppolEndpointSchemeId('001')).toBe(true);
    expect(validators.peppolEndpointSchemeId('001-002')).toBe(false);
    expect(validators.peppolEndpointSchemeId('')).toBe(false);
  });
});

describe('validateOnlyNumbersLetters', () => {
  it('accepts only alphanumeric characters', () => {
    expect(validateOnlyNumbersLetters('')).toBe(true);
    expect(validateOnlyNumbersLetters('abc123')).toBe(true);
    expect(validateOnlyNumbersLetters('a 1')).toBe(false);
    expect(validateOnlyNumbersLetters('a-b')).toBe(false);
  });
});
