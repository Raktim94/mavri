import { describe, expect, it } from 'vitest';
import { invoiceInfoFormValid } from '../pages/invoices/Form/drawers/invoiceInfoModel';

const noErrors = { issuedAt: false, invoiceNumber: false };

describe('invoiceInfoFormValid', () => {
  it('is valid with an issued date and a number', () => {
    expect(invoiceInfoFormValid({ issuedAt: '2026-01-01', invoiceNumber: '0001' }, noErrors)).toBe(true);
  });

  it('rejects missing or blank values and raised errors', () => {
    expect(invoiceInfoFormValid({ issuedAt: undefined, invoiceNumber: '0001' }, noErrors)).toBe(false);
    expect(invoiceInfoFormValid({ issuedAt: '   ', invoiceNumber: '0001' }, noErrors)).toBe(false);
    expect(invoiceInfoFormValid({ issuedAt: '2026-01-01', invoiceNumber: '' }, noErrors)).toBe(false);
    expect(
      invoiceInfoFormValid({ issuedAt: '2026-01-01', invoiceNumber: '0001' }, { ...noErrors, issuedAt: true })
    ).toBe(false);
    expect(
      invoiceInfoFormValid({ issuedAt: '2026-01-01', invoiceNumber: '0001' }, { ...noErrors, invoiceNumber: true })
    ).toBe(false);
  });
});
