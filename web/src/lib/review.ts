import type { Bank, Doc, Party } from '../types';

export type Section = 'customer' | 'items' | 'tax' | 'dates' | 'payment' | 'brand';
export interface Check {
  id: string;
  ok: boolean;
  text: string;
  /** Why it matters, shown under the item. */
  why?: string;
  section: Section;
}
export interface Review {
  required: Check[];
  recommended: Check[];
  optional: Check[];
  /** True when nothing under "Required to save" is open. */
  ready: boolean;
}

interface Context {
  issuer?: Party;
  customer?: Party;
  bank?: Bank;
  kind: Doc['kind'];
  /** Facts the tax guidance says are missing, if it has run. */
  taxMissing?: string[];
}

/** Explains what is missing before a document is saved. Pure, so it is easy to test. */
export function reviewDoc(d: Doc, c: Context): Review {
  const taxed = d.lines.some(l => l.taxMode && l.taxRate > 0) || (d.taxMode !== '' && d.taxRate > 0);
  const named = d.lines.filter(l => l.name.trim());
  const required: Check[] = [
    { id: 'issuer', ok: d.issuerId > 0, text: 'Choose your business', section: 'customer' },
    { id: 'customer', ok: d.customerId > 0, text: 'Choose or add a customer', section: 'customer' },
    { id: 'currency', ok: d.currencyId > 0, text: 'Choose a currency', section: 'payment' },
    { id: 'date', ok: d.issuedOn !== '', text: 'Set the date', section: 'dates' },
    {
      id: 'lines',
      ok: named.length > 0 && named.length === d.lines.length,
      text: 'Give every line a description',
      why: 'A line without a description cannot be saved.',
      section: 'items'
    },
    {
      id: 'dates-order',
      ok: !d.dueOn || !d.issuedOn || d.dueOn >= d.issuedOn,
      text: 'The due date is not before the invoice date',
      section: 'dates'
    }
  ];
  const recommended: Check[] = [
    {
      id: 'due',
      ok: d.kind !== 'invoice' || d.dueOn !== '',
      text: 'Set a due date',
      why: 'Reminders and the overdue list need one.',
      section: 'dates'
    },
    {
      id: 'bank',
      ok: d.bankId != null || !!c.bank,
      text: 'Choose a bank account so the client knows where to pay',
      section: 'payment'
    },
    {
      id: 'customer-email',
      ok: !c.customer || !!c.customer.email,
      text: 'The customer has an email address',
      why: 'Needed to email the invoice and reminders.',
      section: 'customer'
    },
    {
      id: 'issuer-tax',
      ok: !taxed || !c.issuer || !!c.issuer.taxId,
      text: 'Your business has a tax ID, since this document charges tax',
      why: 'Most countries require your registration number on a tax invoice.',
      section: 'tax'
    },
    {
      id: 'tax-facts',
      ok: !c.taxMissing || c.taxMissing.length === 0,
      text: 'The tax facts are complete',
      why: c.taxMissing && c.taxMissing.length > 0 ? c.taxMissing.join('; ') + '.' : undefined,
      section: 'tax'
    },
    {
      id: 'amount',
      ok: d.lines.some(l => l.quantity * l.unitCents > 0),
      text: 'At least one line has an amount',
      section: 'items'
    }
  ];
  const optional: Check[] = [
    { id: 'notes', ok: !!(d.noteCustomer || d.noteTerms), text: 'Add a note or payment terms', section: 'brand' },
    { id: 'style', ok: d.styleId != null, text: 'Pick a template and style', section: 'brand' },
    { id: 'logo', ok: !c.issuer || !!c.issuer.logo, text: 'Add a logo to your business', section: 'brand' }
  ];
  return { required, recommended, optional, ready: required.every(r => r.ok) };
}
