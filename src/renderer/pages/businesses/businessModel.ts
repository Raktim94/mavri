import type { Business, BusinessFromData } from '../../shared/types/business';
import type { Rows } from '../../shared/types/excel';
import { validators } from '../../shared/utils/validatorFunctions';

export type BusinessValidationField =
  'name' | 'shortName' | 'email' | 'phone' | 'peppolEndpointId' | 'peppolEndpointSchemeId' | 'countryCode';

export interface BusinessFieldErrors {
  email: boolean;
  phone: boolean;
  name: boolean;
  shortName: boolean;
  peppolEndpointSchemeId: boolean;
  peppolEndpointId: boolean;
  countryCode: boolean;
}

export const BUSINESS_EXCEL_COLUMNS = [
  'name',
  'shortName',
  'address',
  'role',
  'email',
  'phone',
  'website',
  'description',
  'additional',
  'vatCode',
  'paymentInformation',
  'isArchived',
  'fileSize',
  'fileType',
  'fileName',
  'peppolEndpointId',
  'countryCode',
  'code',
  'peppolEndpointSchemeId'
];

export const BUSINESS_EXCEL_TEMPLATE: Rows = [
  {
    name: 'Acme Corp',
    shortName: 'AC',
    address: '123 Main St',
    role: 'Manager',
    email: 'acme@example.com',
    phone: '+14155552671',
    website: 'https://acme.com',
    additional: 'AC',
    description: 'Some description',
    isArchived: false,
    peppolEndpointId: '0192',
    countryCode: 'GB',
    code: undefined,
    peppolEndpointSchemeId: '123456785',
    paymentInformation:
      '`Cardholder Name: John Doe; Card Type: Visa; Card Number: 4111 1111 1111 1111; Expiration Date: 12/2026; CVV: 123; Billing Address: 123 Main Street, Apt 4B, Springfield, IL 62704; Payment Method: Credit Card; Transaction ID: TXN1234567890; Payment Status: Completed; Amount Paid: $250.00 USD; Currency: USD; Payment Date: 2025-11-17`'
  },
  {
    name: 'Beta Industries',
    shortName: 'BI',
    address: '456 Second Ave',
    email: 'beta@example.com',
    phone: '+14155552671',
    website: 'https://beta.com',
    additional: 'BI',
    isArchived: true,
    peppolEndpointId: '0192',
    countryCode: 'GB',
    peppolEndpointSchemeId: '123456785'
  }
];

const businessFieldAccepts: Record<BusinessValidationField, (value: string) => boolean> = {
  name: value => validators.required(value),
  shortName: value => validators.required(value),
  email: value => value === '' || validators.email(value),
  phone: value => value === '' || validators.phone(value),
  peppolEndpointId: value => value === '' || validators.peppolEndpointId(value),
  peppolEndpointSchemeId: value => value === '' || validators.peppolEndpointSchemeId(value),
  countryCode: value => value === '' || validators.countryCode(value)
};

export const createBusinessDraft = (business?: Business): BusinessFromData => ({
  id: business?.id,
  logo: business?.logo ?? undefined,
  email: business?.email ?? '',
  phone: business?.phone ?? '',
  name: business?.name ?? '',
  shortName: business?.shortName ?? '',
  role: business?.role ?? '',
  address: business?.address ?? '',
  website: business?.website ?? '',
  additional: business?.additional ?? '',
  vatCode: business?.vatCode ?? '',
  paymentInformation: business?.paymentInformation ?? '',
  fileSize: business?.fileSize,
  fileType: business?.fileType,
  fileName: business?.fileName,
  description: business?.description ?? '',
  peppolEndpointSchemeId: business?.peppolEndpointSchemeId ?? '',
  peppolEndpointId: business?.peppolEndpointId ?? '',
  countryCode: business?.countryCode ?? '',
  code: business?.code ?? '',
  isArchived: business?.isArchived ?? false
});

export const createBusinessFieldErrors = (): BusinessFieldErrors => ({
  email: false,
  phone: false,
  name: false,
  shortName: false,
  peppolEndpointSchemeId: false,
  peppolEndpointId: false,
  countryCode: false
});

export const evaluateBusinessField = (field: BusinessValidationField, value: string): boolean =>
  !businessFieldAccepts[field](value);

export const applyBusinessFieldEvaluation = (
  errors: BusinessFieldErrors,
  field: BusinessValidationField,
  value: string
): BusinessFieldErrors => ({ ...errors, [field]: evaluateBusinessField(field, value) });

export const isBusinessDraftReady = (draft: BusinessFromData, errors: BusinessFieldErrors): boolean =>
  draft.name.trim() !== '' &&
  draft.shortName.trim() !== '' &&
  !errors.email &&
  !errors.phone &&
  !errors.name &&
  !errors.shortName &&
  !errors.countryCode &&
  !errors.peppolEndpointId &&
  !errors.peppolEndpointSchemeId;
