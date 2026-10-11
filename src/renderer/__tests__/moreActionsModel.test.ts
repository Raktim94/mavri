import { describe, expect, it } from 'vitest';
import { InvoiceType } from '../shared/enums/invoiceType';
import { moreActionEntries, type MoreActionConfig } from '../pages/invoices/Form/drawers/moreActionsModel';

const t = (key: string) => key;

const config = (overrides: Partial<MoreActionConfig> = {}): MoreActionConfig => ({
  showDelete: true,
  showDuplicate: true,
  showMakeInvoice: true,
  isPDFReady: false,
  type: InvoiceType.invoice,
  ...overrides
});

describe('moreActionEntries', () => {
  it('builds the default invoice action list in order', () => {
    const entries = moreActionEntries(t, config());
    expect(entries.map(entry => entry.id)).toEqual(['makeInvoice', 'exportPdf', 'duplicate', 'delete']);
  });

  it('hides make invoice, duplicate and delete when disabled', () => {
    const entries = moreActionEntries(t, config({ showMakeInvoice: false, showDuplicate: false, showDelete: false }));
    expect(entries.map(entry => entry.id)).toEqual(['exportPdf']);
  });

  it('adds receipt and xml exports for invoices when the settings allow it', () => {
    const entries = moreActionEntries(t, config({ ublON: true, xrechnungON: true }));
    expect(entries.map(entry => entry.id)).toEqual([
      'makeInvoice',
      'exportPdf',
      'pdfUbl',
      'ublXml',
      'xrechnungXml',
      'duplicate',
      'delete'
    ]);
  });

  it('skips invoice-only exports for quotations', () => {
    const entries = moreActionEntries(t, config({ type: InvoiceType.quotation, ublON: true, xrechnungON: true }));
    expect(entries.map(entry => entry.id)).toEqual(['makeInvoice', 'exportPdf', 'duplicate', 'delete']);
  });

  it('disables xml exports until the pdf is ready and labels tooltips', () => {
    const notReady = moreActionEntries(t, config({ ublON: true, xrechnungON: true, isPDFReady: false }));
    const ready = moreActionEntries(t, config({ ublON: true, xrechnungON: true, isPDFReady: true }));

    const xmlIds = ['pdfUbl', 'ublXml', 'xrechnungXml'];
    for (const id of xmlIds) {
      expect(notReady.find(entry => entry.id === id)?.disabled).toBe(true);
      expect(ready.find(entry => entry.id === id)?.disabled).toBe(false);
    }
    expect(notReady.find(entry => entry.id === 'pdfUbl')?.tooltip).toBe('common.tooltipPDFXML');
    expect(notReady.find(entry => entry.id === 'ublXml')?.tooltip).toBe('common.tooltipXML');
  });

  it('keeps the plain pdf export always enabled', () => {
    const entries = moreActionEntries(t, config({ isPDFReady: false, ublON: true }));
    expect(entries.find(entry => entry.id === 'exportPdf')?.disabled).toBeFalsy();
  });
});
