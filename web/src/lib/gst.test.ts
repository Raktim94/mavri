import { describe, expect, it } from 'vitest';
import { gstSplit } from './gst';

describe('gstSplit', () => {
  it('same state is CGST + SGST, other state is IGST', () => {
    expect(gstSplit('27AAPFU0939F1ZV', '27AAGFF2194N1Z4')).toBe('intra');
    expect(gstSplit('27AAPFU0939F1ZV', '07AAGFF2194N1Z1')).toBe('inter');
  });
  it('does not guess when either number is missing or malformed', () => {
    expect(gstSplit('27AAPFU0939F1ZV', '')).toBeNull();
    expect(gstSplit('', '07AAGFF2194N1Z1')).toBeNull();
    expect(gstSplit('27AAPFU0939F1ZV', 'not a gstin')).toBeNull();
  });
  it('ignores spaces and case', () => {
    expect(gstSplit('27 aapfu 0939 f1zv', '27AAGFF2194N1Z4')).toBe('intra');
  });
});
