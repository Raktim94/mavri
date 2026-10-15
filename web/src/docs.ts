import type { Doc, Kind } from './types';

export const statusLabel: Record<string, string> = {
  unpaid: 'Unpaid',
  partial: 'Partly paid',
  paid: 'Paid',
  void: 'Void',
  open: 'Open',
  accepted: 'Accepted',
  declined: 'Declined'
};

export const statusesOf: Record<Kind, string[]> = {
  invoice: ['unpaid', 'partial', 'paid', 'void'],
  quote: ['open', 'accepted', 'declined']
};

export const today = () => new Date().toISOString().slice(0, 10);

export const routeOf = (kind: Kind) => (kind === 'invoice' ? '/invoices' : '/quotes');

export function blankDoc(kind: Kind): Doc {
  return {
    kind,
    numberPrefix: '',
    number: '',
    numberSuffix: '',
    fullNumber: '',
    issuerId: 0,
    customerId: 0,
    currencyId: 0,
    bankId: null,
    styleId: null,
    convertedFrom: null,
    issuedOn: today(),
    dueOn: '',
    status: '',
    discount: { mode: '', cents: 0, percent: 0 },
    surcharge: { mode: '', cents: 0, percent: 0 },
    shippingCents: 0,
    taxRate: 0,
    taxMode: '',
    noteCustomer: '',
    noteTerms: '',
    noteThanks: '',
    lines: [{ productId: null, name: '', unit: '', quantity: 1, unitCents: 0, taxRate: 0, taxMode: '' }],
    payments: []
  } as unknown as Doc;
}

/** An unpaid or partly paid invoice whose due date has passed. */
export const isOverdue = (r: { kind: Kind; status: string; dueOn: string }) =>
  r.kind === 'invoice' && (r.status === 'unpaid' || r.status === 'partial') && r.dueOn !== '' && r.dueOn < today();
