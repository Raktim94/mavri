import { describe, expect, it } from 'vitest';
import type { InvoiceFromData } from '../shared/types/invoice';
import {
  businessInfoLines,
  clientInfoLines,
  notesSections,
  paymentInfoLines
} from '../pages/invoices/Preview/models/infoLinesModel';

const invoice = (overrides: Partial<InvoiceFromData> = {}): InvoiceFromData => ({ ...overrides }) as InvoiceFromData;

describe('clientInfoLines', () => {
  it('always starts with the name and appends present fields', () => {
    const lines = clientInfoLines(
      invoice({
        invoiceClientSnapshot: {
          clientName: 'Acme',
          clientAddress: 'Main St 1',
          clientEmail: 'a@b.c',
          clientPhone: '123',
          clientCode: 'C-1',
          clientVatCode: 'VAT-1',
          clientAdditional: 'Extra'
        } as InvoiceFromData['invoiceClientSnapshot']
      })
    );

    expect(lines).toEqual(['Acme', 'Main St 1', 'a@b.c', '123', 'C-1', 'VAT-1', 'Extra']);
  });

  it('skips missing fields but keeps the name slot', () => {
    expect(clientInfoLines(invoice({ invoiceClientSnapshot: { clientName: 'Acme' } as never }))).toEqual(['Acme']);
    expect(clientInfoLines(undefined)).toEqual(['']);
  });
});

describe('businessInfoLines', () => {
  it('collects the business snapshot fields in order', () => {
    const lines = businessInfoLines(
      invoice({
        invoiceBusinessSnapshot: {
          businessName: 'Mavri',
          businessRole: 'Studio',
          businessEmail: 'hi@mavri.dev'
        } as never
      })
    );

    expect(lines).toEqual(['Mavri', 'Studio', 'hi@mavri.dev']);
  });

  it('returns just the name slot without a snapshot', () => {
    expect(businessInfoLines(invoice())).toEqual(['']);
  });
});

describe('paymentInfoLines', () => {
  it('returns null without a bank snapshot', () => {
    expect(paymentInfoLines(invoice())).toBeNull();
  });

  it('collects present bank fields in order', () => {
    const lines = paymentInfoLines(
      invoice({
        invoiceBankSnapshot: {
          accountHolder: 'Holder',
          bankName: 'Bank',
          accountNumber: '1234',
          upiCode: 'upi@ok'
        } as never
      })
    );

    expect(lines).toEqual(['Holder', 'Bank', '1234', 'upi@ok']);
  });

  it('uses the legacy business payment information when requested', () => {
    const form = invoice({ invoiceBusinessSnapshot: { businessPaymentInformation: 'Legacy details' } as never });

    expect(paymentInfoLines(form, 'legacyBusiness')).toEqual(['Legacy details']);
    expect(paymentInfoLines(invoice(), 'legacyBusiness')).toBeNull();
  });
});

describe('notesSections', () => {
  it('returns the sections in order with labels', () => {
    const sections = notesSections(
      invoice({
        thanksNotes: 'Thanks!',
        customerNotes: 'Note to customer',
        termsConditionNotes: 'Net 14'
      }),
      { customerNoteLabel: 'Customer note', termsConditionsLabel: 'Terms' }
    );

    expect(sections).toEqual([
      { kind: 'thanks', text: 'Thanks!' },
      { kind: 'customer', label: 'Customer note', text: 'Note to customer' },
      { kind: 'terms', label: 'Terms', text: 'Net 14' }
    ]);
  });

  it('skips empty notes', () => {
    expect(notesSections(invoice({ thanksNotes: '' }), { customerNoteLabel: 'C', termsConditionsLabel: 'T' })).toEqual(
      []
    );
    expect(notesSections(undefined, { customerNoteLabel: 'C', termsConditionsLabel: 'T' })).toEqual([]);
  });
});
