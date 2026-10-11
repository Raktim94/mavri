import { describe, expect, it } from 'vitest';
import type { Business } from '../shared/types/business';
import {
  applyBusinessFieldEvaluation,
  createBusinessDraft,
  createBusinessFieldErrors,
  evaluateBusinessField,
  isBusinessDraftReady,
  BUSINESS_EXCEL_COLUMNS,
  BUSINESS_EXCEL_TEMPLATE
} from '../pages/businesses/businessModel';

const business = (overrides: Partial<Business> = {}): Business =>
  ({
    id: 3,
    name: 'Acme Corp',
    shortName: 'AC',
    address: '123 Main St',
    role: 'Manager',
    email: 'acme@example.com',
    phone: '+14155552671',
    website: 'https://acme.com',
    additional: 'extra',
    vatCode: 'VAT123',
    paymentInformation: 'legacy',
    fileSize: 5,
    fileType: 'image/png',
    fileName: 'logo.png',
    description: 'desc',
    peppolEndpointSchemeId: '123456785',
    peppolEndpointId: '0192',
    countryCode: 'GB',
    code: 'X1',
    isArchived: false,
    createdAt: '',
    updatedAt: '',
    invoiceCount: 0,
    quotesCount: 0,
    logo: new Uint8Array([9]),
    ...overrides
  }) as Business;

describe('createBusinessDraft', () => {
  it('produces blank required fields without a business', () => {
    const draft = createBusinessDraft();

    expect(draft.name).toBe('');
    expect(draft.shortName).toBe('');
    expect(draft.email).toBe('');
    expect(draft.paymentInformation).toBe('');
    expect(draft.isArchived).toBe(false);
  });

  it('copies stored values including legacy payment info', () => {
    const draft = createBusinessDraft(business());

    expect(draft.id).toBe(3);
    expect(draft.shortName).toBe('AC');
    expect(draft.paymentInformation).toBe('legacy');
    expect(draft.peppolEndpointId).toBe('0192');
    expect(draft.logo).toEqual(new Uint8Array([9]));
  });
});

describe('evaluateBusinessField', () => {
  it('requires name and short name', () => {
    expect(evaluateBusinessField('name', '')).toBe(true);
    expect(evaluateBusinessField('shortName', ' ')).toBe(true);
    expect(evaluateBusinessField('shortName', 'AC')).toBe(false);
  });

  it('validates optional fields only when filled', () => {
    expect(evaluateBusinessField('email', '')).toBe(false);
    expect(evaluateBusinessField('email', 'acme@example.com')).toBe(false);
    expect(evaluateBusinessField('email', 'acme@')).toBe(true);
    expect(evaluateBusinessField('phone', '+14155552671')).toBe(false);
    expect(evaluateBusinessField('phone', 'abc')).toBe(true);
    expect(evaluateBusinessField('countryCode', 'GB')).toBe(false);
    expect(evaluateBusinessField('countryCode', 'GBR')).toBe(true);
    expect(evaluateBusinessField('peppolEndpointId', '0192')).toBe(false);
    expect(evaluateBusinessField('peppolEndpointId', 'a b')).toBe(true);
    expect(evaluateBusinessField('peppolEndpointSchemeId', '123456785')).toBe(false);
    expect(evaluateBusinessField('peppolEndpointSchemeId', 'scheme id!')).toBe(true);
  });
});

describe('applyBusinessFieldEvaluation', () => {
  it('flags only the edited field', () => {
    const next = applyBusinessFieldEvaluation(createBusinessFieldErrors(), 'email', 'bad');

    expect(next.email).toBe(true);
    expect(next.phone).toBe(false);
  });
});

describe('isBusinessDraftReady', () => {
  it('needs both name and short name', () => {
    const onlyName = { ...createBusinessDraft(business({ shortName: '' })) };

    expect(isBusinessDraftReady(onlyName, createBusinessFieldErrors())).toBe(false);
    expect(isBusinessDraftReady(createBusinessDraft(business()), createBusinessFieldErrors())).toBe(true);
  });

  it('rejects drafts with field errors', () => {
    const errors = applyBusinessFieldEvaluation(createBusinessFieldErrors(), 'countryCode', 'G');

    expect(isBusinessDraftReady(createBusinessDraft(business()), errors)).toBe(false);
  });
});

describe('excel config', () => {
  it('lists legacy payment info column and two template rows', () => {
    expect(BUSINESS_EXCEL_COLUMNS).toContain('paymentInformation');
    expect(BUSINESS_EXCEL_TEMPLATE).toHaveLength(2);
    expect(BUSINESS_EXCEL_TEMPLATE[0].shortName).toBe('AC');
  });
});
