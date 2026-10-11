import { describe, expect, it } from 'vitest';
import { noteEntries, NoteKind } from '../pages/invoices/Form/notes/noteEntries';

const t = (key: string) => key;

describe('noteEntries', () => {
  it('lists the three note kinds in order with their values', () => {
    const entries = noteEntries(t, {
      customerNotes: 'Pay on time',
      thanksNotes: 'Thanks!',
      termsConditionNotes: 'Net 30'
    });

    expect(entries).toEqual([
      { kind: NoteKind.customer, label: 'invoices.customerNote', value: 'Pay on time' },
      { kind: NoteKind.thankyou, label: 'invoices.thankNote', value: 'Thanks!' },
      { kind: NoteKind.termsconditions, label: 'invoices.termsConditions', value: 'Net 30' }
    ]);
  });

  it('keeps entries without a value undefined', () => {
    const entries = noteEntries(t, {});
    expect(entries.map(entry => entry.value)).toEqual([undefined, undefined, undefined]);
  });
});
