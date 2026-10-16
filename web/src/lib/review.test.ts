import { describe, expect, it } from 'vitest';
import { blankDoc } from '../docs';
import { reviewDoc } from './review';

describe('reviewDoc', () => {
  it('blocks a blank invoice and names what is missing', () => {
    const r = reviewDoc(blankDoc('invoice'), { kind: 'invoice' });
    expect(r.ready).toBe(false);
    expect(r.required.filter(c => !c.ok).map(c => c.id)).toEqual(['issuer', 'customer', 'currency', 'lines']);
  });

  it('is ready once the business, customer, currency and lines are filled in', () => {
    const d = blankDoc('invoice');
    d.issuerId = 1;
    d.customerId = 2;
    d.currencyId = 3;
    d.lines = [{ productId: null, name: 'Work', unit: '', quantity: 1, unitCents: 1000, taxRate: 0, taxMode: '' }];
    expect(reviewDoc(d, { kind: 'invoice' }).ready).toBe(true);
  });

  it('flags a due date before the invoice date', () => {
    const d = blankDoc('invoice');
    d.issuedOn = '2026-10-10';
    d.dueOn = '2026-10-01';
    expect(reviewDoc(d, { kind: 'invoice' }).required.find(c => c.id === 'dates-order')?.ok).toBe(false);
  });

  it('asks for the business tax ID only when tax is charged', () => {
    const d = blankDoc('invoice');
    const issuer = { taxId: '' } as never;
    expect(reviewDoc(d, { kind: 'invoice', issuer }).recommended.find(c => c.id === 'issuer-tax')?.ok).toBe(true);
    d.lines[0].taxRate = 18;
    d.lines[0].taxMode = 'add';
    expect(reviewDoc(d, { kind: 'invoice', issuer }).recommended.find(c => c.id === 'issuer-tax')?.ok).toBe(false);
  });

  it('lists missing tax facts from the guidance', () => {
    const r = reviewDoc(blankDoc('invoice'), { kind: 'invoice', taxMissing: ['Your GSTIN'] });
    expect(r.recommended.find(c => c.id === 'tax-facts')).toMatchObject({ ok: false, why: 'Your GSTIN.' });
    expect(r.ready).toBe(false); // still driven by the required list only
    expect(
      reviewDoc(blankDoc('invoice'), { kind: 'invoice', taxMissing: [] }).recommended.find(c => c.id === 'tax-facts')
        ?.ok
    ).toBe(true);
  });
});
