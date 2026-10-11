const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PHONE_PATTERN = /^(\+\d{1,3}|\(\+\d{1,3}\))\s*\d{4,14}$/;
const SORT_CODE_PATTERN = /^\d{6}$/;
const SORT_CODE_SEPARATORS = /[\s-]/g;
const ACCOUNT_NUMBER_PATTERN = /^[A-Z0-9\\-]{4,34}$/i;
const WHITESPACE_PATTERN = /\s+/g;
const SWIFT_PATTERN = /^[A-Z0-9]{8}([A-Z0-9]{3})?$/;
const ROUTING_NUMBER_PATTERN = /^\d{9}$/;
const BRANCH_CODE_PATTERN = /^\d{3,6}$/;
const UPI_PATTERN = /^[a-zA-Z0-9._]+@[a-zA-Z0-9]+$/;
const PAYMENT_PHONE_PATTERN = /^\+[1-9]\d{6,14}$/;
const CPF_PATTERN = /^\d{11}$/;
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const COUNTRY_CODE_PATTERN = /^[A-Z]{2}$/;
const PEPPOL_ENDPOINT_ID_PATTERN = /^[a-zA-Z0-9.-]{1,256}$/;
const PEPPOL_SCHEME_ID_PATTERN = /^[a-zA-Z0-9]{1,20}$/;
const ALPHANUMERIC_PATTERN = /^[a-zA-Z0-9]*$/;

export const validators = {
  email: (v: string) => EMAIL_PATTERN.test(v),
  phone: (v: string) => PHONE_PATTERN.test(v.replace(WHITESPACE_PATTERN, '')),
  required: (v: string) => v.trim() !== '',
  sortCode: (v: string) => {
    if (!v) return false;

    return SORT_CODE_PATTERN.test(v.replace(SORT_CODE_SEPARATORS, ''));
  },
  accountNumber: (v: string) => {
    if (!v) return false;

    return ACCOUNT_NUMBER_PATTERN.test(v.replace(WHITESPACE_PATTERN, ''));
  },
  swift: (v: string) => SWIFT_PATTERN.test(v.toUpperCase()),
  routingNumber: (v: string) => ROUTING_NUMBER_PATTERN.test(v),
  branchCode: (v: string) => v === '' || BRANCH_CODE_PATTERN.test(v),
  upiOrPix: (v: string) => {
    if (!v) return false;

    const isUpi = UPI_PATTERN.test(v);
    const isEmail = EMAIL_PATTERN.test(v);
    const isPhone = PAYMENT_PHONE_PATTERN.test(v);
    const isCpf = CPF_PATTERN.test(v);
    const isUuid = UUID_PATTERN.test(v);

    return isUpi || isEmail || isPhone || isCpf || isUuid;
  },
  countryCode: (v: string) => {
    if (!v) return false;

    return COUNTRY_CODE_PATTERN.test(v.toUpperCase());
  },
  peppolEndpointId: (v: string) => {
    if (!v) return false;

    return PEPPOL_ENDPOINT_ID_PATTERN.test(v);
  },
  peppolEndpointSchemeId: (v: string) => {
    if (!v) return false;

    return PEPPOL_SCHEME_ID_PATTERN.test(v);
  }
} as const;

export const validateOnlyNumbersLetters = (value: string) => {
  return ALPHANUMERIC_PATTERN.test(value);
};
