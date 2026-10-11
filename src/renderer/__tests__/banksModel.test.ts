import { describe, expect, it } from 'vitest';
import type { Bank } from '../shared/types/bank';
import {
  applyBankFieldEvaluation,
  createBankDraft,
  createBankFieldErrors,
  evaluateBankField,
  isBankDraftReady,
  BANK_EXCEL_COLUMNS,
  BANK_EXCEL_TEMPLATE
} from '../pages/banks/banksModel';

const bank = (overrides: Partial<Bank> = {}): Bank =>
  ({
    id: 7,
    name: 'Main account',
    bankName: 'Swedbank',
    accountNumber: 'LT12 7300 0101 2345 6789',
    swiftCode: 'HABALT22',
    address: 'Vilnius',
    branchCode: '73000',
    type: 'Checking',
    routingNumber: '026009593',
    accountHolder: 'Tom Hanks',
    sortOrder: '01',
    upiCode: 'name@okbank',
    qrCodeFileSize: 10,
    qrCodeFileType: 'image/png',
    qrCodeFileName: 'qr.png',
    isArchived: true,
    createdAt: '',
    updatedAt: '',
    invoiceCount: 0,
    quotesCount: 0,
    qrCode: new Uint8Array([1, 2]),
    ...overrides
  }) as Bank;

describe('createBankDraft', () => {
  it('produces an empty draft without a bank', () => {
    const draft = createBankDraft();

    expect(draft.name).toBe('');
    expect(draft.accountNumber).toBe('');
    expect(draft.sortOrder).toBe('');
    expect(draft.isArchived).toBe(false);
    expect(draft.qrCode).toBeUndefined();
    expect(draft.id).toBeUndefined();
  });

  it('copies every editable value from an existing bank', () => {
    const draft = createBankDraft(bank());

    expect(draft.id).toBe(7);
    expect(draft.name).toBe('Main account');
    expect(draft.bankName).toBe('Swedbank');
    expect(draft.accountNumber).toBe('LT12 7300 0101 2345 6789');
    expect(draft.swiftCode).toBe('HABALT22');
    expect(draft.upiCode).toBe('name@okbank');
    expect(draft.qrCodeFileName).toBe('qr.png');
    expect(draft.isArchived).toBe(true);
    expect(draft.qrCode).toEqual(new Uint8Array([1, 2]));
  });
});

describe('evaluateBankField', () => {
  it('requires a non-blank name', () => {
    expect(evaluateBankField('name', '')).toBe(true);
    expect(evaluateBankField('name', '   ')).toBe(true);
    expect(evaluateBankField('name', 'Main')).toBe(false);
  });

  it('ignores empty optional fields but flags invalid ones', () => {
    expect(evaluateBankField('accountNumber', '')).toBe(false);
    expect(evaluateBankField('accountNumber', '12')).toBe(true);
    expect(evaluateBankField('accountNumber', 'ABCD1234')).toBe(false);
    expect(evaluateBankField('swiftCode', 'HABALT22')).toBe(false);
    expect(evaluateBankField('swiftCode', 'SHORT')).toBe(true);
    expect(evaluateBankField('routingNumber', '026009593')).toBe(false);
    expect(evaluateBankField('routingNumber', '123')).toBe(true);
    expect(evaluateBankField('upiCode', 'name@okbank')).toBe(false);
    expect(evaluateBankField('upiCode', 'nope')).toBe(true);
  });
});

describe('applyBankFieldEvaluation', () => {
  it('updates only the targeted field', () => {
    const next = applyBankFieldEvaluation(createBankFieldErrors(), 'swiftCode', 'SHORT');

    expect(next.swiftCode).toBe(true);
    expect(next.name).toBe(false);
    expect(next.accountNumber).toBe(false);
  });
});

describe('isBankDraftReady', () => {
  it('rejects a blank name even without field errors', () => {
    expect(isBankDraftReady(createBankDraft(), createBankFieldErrors())).toBe(false);
  });

  it('accepts a named draft with clean errors', () => {
    expect(isBankDraftReady(createBankDraft(bank()), createBankFieldErrors())).toBe(true);
  });

  it('rejects while any field error remains', () => {
    const errors = applyBankFieldEvaluation(createBankFieldErrors(), 'swiftCode', 'SHORT');

    expect(isBankDraftReady(createBankDraft(bank()), errors)).toBe(false);
  });
});

describe('excel config', () => {
  it('exposes the bank columns and three template rows', () => {
    expect(BANK_EXCEL_COLUMNS).toContain('accountNumber');
    expect(BANK_EXCEL_COLUMNS).toContain('isArchived');
    expect(BANK_EXCEL_TEMPLATE).toHaveLength(3);
    expect(BANK_EXCEL_TEMPLATE[0].name).toBe('Swedbank Business Account');
  });
});
