import type { Bank, BankFromData } from '../../shared/types/bank';
import type { Rows } from '../../shared/types/excel';
import { validators } from '../../shared/utils/validatorFunctions';

export type BankValidationField =
  'name' | 'accountNumber' | 'swiftCode' | 'sortOrder' | 'branchCode' | 'routingNumber' | 'upiCode';

export interface BankFieldErrors {
  name: boolean;
  accountNumber: boolean;
  swiftCode: boolean;
  sortOrder: boolean;
  branchCode: boolean;
  routingNumber: boolean;
  upiCode: boolean;
}

export const BANK_EXCEL_COLUMNS = [
  'name',
  'bankName',
  'accountNumber',
  'swiftCode',
  'address',
  'branchCode',
  'routingNumber',
  'accountHolder',
  'sortOrder',
  'type',
  'upiCode',
  'qrCodeFileSize',
  'qrCodeFileType',
  'qrCodeFileName',
  'isArchived'
];

export const BANK_EXCEL_TEMPLATE: Rows = [
  {
    name: 'Swedbank Business Account',
    bankName: 'Swedbank AB',
    accountNumber: 'LT12 7300 0101 2345 6789',
    swiftCode: 'HABALT22',
    address: 'Konstitucijos pr. 20A, 09321 Vilnius, Lithuania',
    branchCode: '73000',
    routingNumber: null,
    type: 'Business Current Account',
    upiCode: null,
    isArchived: false,
    accountHolder: 'Tom Hanks',
    sortOrder: null
  },
  {
    name: 'Stripe Payout Account',
    bankName: 'Bank of America',
    accountNumber: '123456789',
    swiftCode: 'BOFAUS3N',
    address: '100 N Tryon St, Charlotte, NC 28202, USA',
    branchCode: null,
    routingNumber: '026009593',
    type: 'Checking',
    upiCode: null,
    isArchived: false,
    accountHolder: 'Tom Hanks',
    sortOrder: null
  },
  {
    name: 'Personal UPI Wallet',
    bankName: 'HDFC Bank',
    accountNumber: '50100234567890',
    swiftCode: 'HDFCINBBXXX',
    address: 'HDFC Bank, Sion Branch, Mumbai, Maharashtra, India',
    branchCode: '044',
    routingNumber: null,
    type: 'Savings Account',
    upiCode: 'rahul.verma@okhdfcbank',
    isArchived: false,
    accountHolder: 'Tom Hanks',
    sortOrder: null
  }
];

const bankFieldAccepts: Record<BankValidationField, (value: string) => boolean> = {
  name: value => validators.required(value),
  accountNumber: value => value === '' || validators.accountNumber(value),
  swiftCode: value => value === '' || validators.swift(value),
  sortOrder: value => value === '' || validators.sortCode(value),
  branchCode: value => value === '' || validators.branchCode(value),
  routingNumber: value => value === '' || validators.routingNumber(value),
  upiCode: value => value === '' || validators.upiOrPix(value)
};

export const createBankDraft = (bank?: Bank): BankFromData => ({
  id: bank?.id,
  qrCode: bank?.qrCode ?? undefined,
  name: bank?.name ?? '',
  bankName: bank?.bankName ?? '',
  accountNumber: bank?.accountNumber ?? '',
  swiftCode: bank?.swiftCode ?? '',
  address: bank?.address ?? '',
  branchCode: bank?.branchCode ?? '',
  type: bank?.type ?? '',
  routingNumber: bank?.routingNumber ?? '',
  accountHolder: bank?.accountHolder ?? '',
  sortOrder: bank?.sortOrder ?? '',
  upiCode: bank?.upiCode ?? '',
  qrCodeFileSize: bank?.qrCodeFileSize,
  qrCodeFileType: bank?.qrCodeFileType,
  qrCodeFileName: bank?.qrCodeFileName,
  isArchived: bank?.isArchived ?? false
});

export const createBankFieldErrors = (): BankFieldErrors => ({
  name: false,
  accountNumber: false,
  swiftCode: false,
  sortOrder: false,
  branchCode: false,
  routingNumber: false,
  upiCode: false
});

export const evaluateBankField = (field: BankValidationField, value: string): boolean =>
  !bankFieldAccepts[field](value);

export const applyBankFieldEvaluation = (
  errors: BankFieldErrors,
  field: BankValidationField,
  value: string
): BankFieldErrors => ({ ...errors, [field]: evaluateBankField(field, value) });

export const isBankDraftReady = (draft: BankFromData, errors: BankFieldErrors): boolean =>
  draft.name.trim() !== '' && !Object.values(errors).some(Boolean);
