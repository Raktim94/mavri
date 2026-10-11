import type { Client, ClientFromData } from '../../shared/types/client';
import type { Rows } from '../../shared/types/excel';
import { validators } from '../../shared/utils/validatorFunctions';

export type ClientValidationField =
  'name' | 'shortName' | 'email' | 'phone' | 'peppolEndpointId' | 'peppolEndpointSchemeId' | 'countryCode';

export interface ClientFieldErrors {
  email: boolean;
  phone: boolean;
  name: boolean;
  shortName: boolean;
  peppolEndpointSchemeId: boolean;
  peppolEndpointId: boolean;
  countryCode: boolean;
}

export const CLIENT_EXCEL_COLUMNS = [
  'name',
  'shortName',
  'address',
  'email',
  'phone',
  'code',
  'description',
  'additional',
  'vatCode',
  'isArchived',
  'peppolEndpointId',
  'countryCode',
  'peppolEndpointSchemeId',
  'buyerReference'
];

export const CLIENT_EXCEL_TEMPLATE: Rows = [
  {
    name: 'John Doe',
    shortName: 'JD',
    address: '123 Main St, Springfield',
    email: 'john.doe@email.com',
    phone: '+14155552671',
    code: 'A001',
    description: 'Some description',
    vatCode: 'VAT DE123456789',
    isArchived: false,
    peppolEndpointId: '0192',
    countryCode: 'GB',
    peppolEndpointSchemeId: '123456785',
    buyerReference: 'Accounting'
  },
  {
    name: 'Jane Smith',
    shortName: 'JS',
    address: '456 Elm St, Shelbyville',
    email: 'jane.smith@email.com',
    phone: '+14155552671',
    code: 'B002',
    isArchived: false,
    peppolEndpointId: '0192',
    countryCode: 'GB',
    peppolEndpointSchemeId: '123456785',
    buyerReference: 'Accounting'
  }
];

const clientFieldAccepts: Record<ClientValidationField, (value: string) => boolean> = {
  name: value => validators.required(value),
  shortName: value => validators.required(value),
  email: value => value === '' || validators.email(value),
  phone: value => value === '' || validators.phone(value),
  peppolEndpointId: value => value === '' || validators.peppolEndpointId(value),
  peppolEndpointSchemeId: value => value === '' || validators.peppolEndpointSchemeId(value),
  countryCode: value => value === '' || validators.countryCode(value)
};

export const createClientDraft = (client?: Client): ClientFromData => ({
  id: client?.id,
  email: client?.email ?? '',
  phone: client?.phone ?? '',
  name: client?.name ?? '',
  shortName: client?.shortName ?? '',
  code: client?.code ?? '',
  address: client?.address ?? '',
  vatCode: client?.vatCode ?? '',
  additional: client?.additional ?? '',
  description: client?.description ?? '',
  peppolEndpointSchemeId: client?.peppolEndpointSchemeId ?? '',
  buyerReference: client?.buyerReference ?? '',
  peppolEndpointId: client?.peppolEndpointId ?? '',
  countryCode: client?.countryCode ?? '',
  isArchived: client?.isArchived ?? false
});

export const createClientFieldErrors = (): ClientFieldErrors => ({
  email: false,
  phone: false,
  name: false,
  shortName: false,
  peppolEndpointSchemeId: false,
  peppolEndpointId: false,
  countryCode: false
});

export const evaluateClientField = (field: ClientValidationField, value: string): boolean =>
  !clientFieldAccepts[field](value);

export const applyClientFieldEvaluation = (
  errors: ClientFieldErrors,
  field: ClientValidationField,
  value: string
): ClientFieldErrors => ({ ...errors, [field]: evaluateClientField(field, value) });

export const isClientDraftReady = (draft: ClientFromData, errors: ClientFieldErrors): boolean =>
  draft.name.trim() !== '' &&
  draft.shortName.trim() !== '' &&
  !errors.email &&
  !errors.phone &&
  !errors.name &&
  !errors.shortName &&
  !errors.countryCode &&
  !errors.peppolEndpointId &&
  !errors.peppolEndpointSchemeId;

export const buyerReferenceHelperText = (params: {
  translate: (key: string) => string;
  ublOn: boolean;
  xrechnungOn: boolean;
}): string =>
  params.ublOn && params.xrechnungOn
    ? `${params.translate('common.buyerReferenceUBL')}\n${params.translate('common.buyerReferenceXRechnung')}`
    : params.ublOn
      ? params.translate('common.buyerReferenceUBL')
      : params.translate('common.buyerReferenceXRechnung');
