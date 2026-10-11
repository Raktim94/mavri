import { describe, expect, it } from 'vitest';
import type { Client } from '../shared/types/client';
import {
  applyClientFieldEvaluation,
  buyerReferenceHelperText,
  createClientDraft,
  createClientFieldErrors,
  evaluateClientField,
  isClientDraftReady,
  CLIENT_EXCEL_COLUMNS,
  CLIENT_EXCEL_TEMPLATE
} from '../pages/clients/clientModel';

const client = (overrides: Partial<Client> = {}): Client =>
  ({
    id: 11,
    name: 'John Doe',
    shortName: 'JD',
    address: '123 Main St',
    email: 'john.doe@email.com',
    phone: '+14155552671',
    code: 'A001',
    additional: 'extra',
    vatCode: 'VAT DE123456789',
    peppolEndpointId: '0192',
    countryCode: 'GB',
    peppolEndpointSchemeId: '123456785',
    buyerReference: 'Accounting',
    description: 'desc',
    isArchived: false,
    createdAt: '',
    updatedAt: '',
    invoiceCount: 0,
    quotesCount: 0,
    ...overrides
  }) as Client;

describe('createClientDraft', () => {
  it('produces blank required fields without a client', () => {
    const draft = createClientDraft();

    expect(draft.name).toBe('');
    expect(draft.shortName).toBe('');
    expect(draft.buyerReference).toBe('');
    expect(draft.isArchived).toBe(false);
  });

  it('copies stored values including buyer reference', () => {
    const draft = createClientDraft(client());

    expect(draft.id).toBe(11);
    expect(draft.buyerReference).toBe('Accounting');
    expect(draft.peppolEndpointSchemeId).toBe('123456785');
  });
});

describe('evaluateClientField', () => {
  it('requires name and short name', () => {
    expect(evaluateClientField('name', '')).toBe(true);
    expect(evaluateClientField('shortName', 'JD')).toBe(false);
  });

  it('validates optional fields only when filled', () => {
    expect(evaluateClientField('email', '')).toBe(false);
    expect(evaluateClientField('email', 'nope')).toBe(true);
    expect(evaluateClientField('countryCode', 'GB')).toBe(false);
    expect(evaluateClientField('countryCode', '1')).toBe(true);
    expect(evaluateClientField('peppolEndpointId', '0192')).toBe(false);
    expect(evaluateClientField('peppolEndpointSchemeId', '123456785')).toBe(false);
  });
});

describe('applyClientFieldEvaluation', () => {
  it('flags only the edited field', () => {
    const next = applyClientFieldEvaluation(createClientFieldErrors(), 'phone', 'nope');

    expect(next.phone).toBe(true);
    expect(next.email).toBe(false);
  });
});

describe('isClientDraftReady', () => {
  it('needs both name and short name and clean errors', () => {
    expect(isClientDraftReady(createClientDraft(client()), createClientFieldErrors())).toBe(true);
    expect(isClientDraftReady(createClientDraft(client({ shortName: '' })), createClientFieldErrors())).toBe(false);

    const errors = applyClientFieldEvaluation(createClientFieldErrors(), 'email', 'bad');
    expect(isClientDraftReady(createClientDraft(client()), errors)).toBe(false);
  });
});

describe('buyerReferenceHelperText', () => {
  const translate = (key: string) => key;

  it('combines both standards when both are enabled', () => {
    expect(buyerReferenceHelperText({ translate, ublOn: true, xrechnungOn: true })).toBe(
      'common.buyerReferenceUBL\ncommon.buyerReferenceXRechnung'
    );
  });

  it('picks the single enabled standard', () => {
    expect(buyerReferenceHelperText({ translate, ublOn: true, xrechnungOn: false })).toBe('common.buyerReferenceUBL');
    expect(buyerReferenceHelperText({ translate, ublOn: false, xrechnungOn: true })).toBe(
      'common.buyerReferenceXRechnung'
    );
  });
});

describe('excel config', () => {
  it('lists buyer reference and two template rows', () => {
    expect(CLIENT_EXCEL_COLUMNS).toContain('buyerReference');
    expect(CLIENT_EXCEL_TEMPLATE).toHaveLength(2);
  });
});
